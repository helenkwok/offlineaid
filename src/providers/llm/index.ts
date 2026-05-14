/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * LLM provider — backend-aware on-device chat model cache.
 *
 * Uses @react-native-ai/llama (Vercel AI SDK v6 provider over llama.rn) for
 * GGUF models and a native LiteRT bridge for Google AI Edge `.task` /
 * `.litertlm` models.
 *
 * The active backend instance is cached in module scope so it is only prepared
 * once. On model switch the old instance is unloaded before the new one is
 * prepared.
 *
 * Path resolution:
 *   llama.languageModel() expects a local filesystem path, not a model ID.
 *   We resolve modelId → path via getModelPath() from @react-native-ai/llama
 *   before creating the model instance.
 *
 * Cactus note:
 *   Cactus is optional. If its v1 React Native bindings ship and can run
 *   fully offline without vendor dependency, we can swap the model instance
 *   here without touching useLLM or any UI code.
 */
import { Platform } from 'react-native';
import type { LanguageModelV2 } from '@ai-sdk/provider';
import type { LlamaModelOptions } from '@react-native-ai/llama';

import { getChatModelBackend, type ChatModelBackend } from '@/models/runtime';
import { loadLiteRtModel, unloadLiteRtModel } from '@/providers/litert';

type LlamaModule = typeof import('@react-native-ai/llama');
type PreparedLlamaModel = ReturnType<LlamaModule['llama']['languageModel']>;

async function loadLlamaModule(): Promise<LlamaModule> {
  if (Platform.OS === 'web') {
    throw new Error('On-device llama models are not available on web.');
  }
  return import('@react-native-ai/llama');
}

function getLanguageModelOptions(): LlamaModelOptions {
  if (Platform.OS === 'android') {
    return {
      contextParams: {
        n_ctx: 1024,
        n_batch: 64,
        n_ubatch: 32,
        n_parallel: 1,
        n_gpu_layers: 0,
        devices: ['CPU'],
        flash_attn_type: 'off',
        no_extra_bufts: true,
        use_mmap: true,
      },
    };
  }

  return {};
}

// ---------------------------------------------------------------------------
// Model instance cache
// ---------------------------------------------------------------------------
let cachedModelId: string | null = null;
let cachedModel: PreparedLlamaModel | null = null;
let cachedBackend: ChatModelBackend | null = null;

const MODEL_LOAD_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  });
}

export function isPreparedChatModel(modelId: string | null | undefined): boolean {
  if (!modelId) {
    return false;
  }
  return cachedModelId === modelId && cachedBackend === getChatModelBackend(modelId);
}

/**
 * Return (or create) a prepared llama language model for the given model id.
 *
 * The model id format follows HuggingFace convention:
 *   "owner/repo/filename.gguf"
 *   e.g. "unsloth/gemma-4-E4B-it-GGUF/gemma-4-E4B-it-Q4_K_M.gguf"
 *
 * Resolves the id to a local path via getModelPath() before creating the
 * model instance, as required by llama.languageModel().
 *
 * Throws if the model has not been downloaded yet (download via
 * downloadModel() from @react-native-ai/llama or ModelStore.downloadModel()).
 */
export async function getLlamaModel(
  modelId: string
): Promise<PreparedLlamaModel> {
  if (cachedModel && cachedModelId === modelId) {
    return cachedModel;
  }

  // Unload previous model before loading a new one
  if (cachedModel) {
    await cachedModel.unload();
    cachedModel = null;
    cachedModelId = null;
  }

  // Resolve model ID to local filesystem path
  const { llama, getModelPath } = await loadLlamaModule();
  const modelPath = getModelPath(modelId);
  const model = llama.languageModel(modelPath, getLanguageModelOptions());

  try {
    await withTimeout(
      model.prepare(),
      MODEL_LOAD_TIMEOUT_MS,
      'The Llama model took too long to prepare (60s). This usually happens if the device is out of memory or the file is very large. Try a smaller model.'
    );
  } catch (error) {
    await model.unload().catch(() => {});
    throw error;
  }

  cachedModel = model;
  cachedModelId = modelId;
  cachedBackend = 'llama';

  return cachedModel;
}

export async function prepareChatModel(modelId: string): Promise<void> {
  const backend = getChatModelBackend(modelId);

  if (cachedModelId === modelId && cachedBackend === backend) {
    return;
  }

  await releaseChatModel();

  try {
    if (backend === 'litert') {
      await withTimeout(
        loadLiteRtModel(modelId),
        MODEL_LOAD_TIMEOUT_MS,
        'The LiteRT model took too long to load (60s). Try restarting the app or using a smaller model.'
      );
      cachedModelId = modelId;
      cachedBackend = backend;
      return;
    }

    await getLlamaModel(modelId);
  } catch (error) {
    // Ensure we clean up if loading failed/timed out
    await releaseChatModel().catch(() => {});
    throw error;
  }
}

/**
 * Unload the cached model (call on app background / model change).
 */
export async function releaseChatModel(): Promise<void> {
  if (cachedBackend === 'litert') {
    await unloadLiteRtModel();
    cachedModelId = null;
    cachedBackend = null;
    return;
  }
  if (cachedModel) {
    await cachedModel.unload();
    cachedModel = null;
    cachedModelId = null;
  }
  cachedBackend = null;
}

export const releaseLlamaModel = releaseChatModel;

/**
 * Return the cached model as an AI SDK LanguageModelV2 — for callers that
 * need the typed provider interface.
 */
export async function getLlamaLanguageModel(modelId: string): Promise<LanguageModelV2> {
  return (await getLlamaModel(modelId)) as unknown as LanguageModelV2;
}
