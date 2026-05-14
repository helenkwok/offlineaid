/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { Platform } from 'react-native';
import { type EventSubscription } from 'expo-modules-core';
import {
  addLiteRtTokenListener,
  cancelLiteRtGeneration as nativeCancelLiteRtGeneration,
  generateLiteRtAudioResponse as nativeGenerateLiteRtAudioResponse,
  generateLiteRtResponse as nativeGenerateLiteRtResponse,
  isLiteRtAvailable as nativeIsLiteRtAvailable,
  loadLiteRtModel as nativeLoadLiteRtModel,
  unloadLiteRtModel as nativeUnloadLiteRtModel,
  type LiteRtPreferredBackend,
  type LiteRtTokenEvent,
} from 'expo-litert-lm';

import {
  getLiteRtModelPath,
  getLiteRtModelPlatformBlockReason,
  stripFileUri,
} from '@/models/runtime';

type PreferredBackend = LiteRtPreferredBackend;
type LiteRtLoadConfig = {
  modelId: string;
  maxTokens: number;
  topK: number;
  temperature: number;
  preferredBackend: PreferredBackend;
};

let cachedLiteRtModelId: string | null = null;
let cachedLiteRtConfig: LiteRtLoadConfig | null = null;
const DEFAULT_LITERT_MAX_TOKENS = 2048;
const DEFAULT_LITERT_TOP_K = 40;
const DEFAULT_LITERT_TEMPERATURE = 0.8;
const LITERT_GENERATION_TIMEOUT_MS = 60_000;

type LiteRtModelSupport = {
  reason?: string;
  supported: boolean;
};

function isSameLiteRtConfig(a: LiteRtLoadConfig | null, b: LiteRtLoadConfig): boolean {
  if (!a) return false;
  return (
    a.modelId === b.modelId &&
    a.maxTokens === b.maxTokens &&
    a.topK === b.topK &&
    a.temperature === b.temperature &&
    a.preferredBackend === b.preferredBackend
  );
}

export function getLiteRtRuntimeUnavailableReason(): string {
  if (Platform.OS === 'ios') {
    return 'LiteRT models require iOS 17 or newer.';
  }
  if (Platform.OS === 'android') {
    return 'LiteRT models require Android 12 or newer.';
  }
  return 'LiteRT-LM is only available in the native app.';
}

export async function isLiteRtAvailable(): Promise<boolean> {
  return nativeIsLiteRtAvailable();
}

export async function getLiteRtModelSupport(modelId: string): Promise<LiteRtModelSupport> {
  const platformBlockReason = getLiteRtModelPlatformBlockReason(modelId);
  if (platformBlockReason) {
    return { supported: false, reason: platformBlockReason };
  }

  try {
    const available = await isLiteRtAvailable();
    if (!available) {
      return { supported: false, reason: getLiteRtRuntimeUnavailableReason() };
    }
  } catch (error) {
    return {
      supported: false,
      reason:
        error instanceof Error ? error.message : getLiteRtRuntimeUnavailableReason(),
    };
  }

  return { supported: true };
}

async function assertLiteRtModelSupported(modelId: string): Promise<void> {
  const support = await getLiteRtModelSupport(modelId);
  if (!support.supported) {
    throw new Error(support.reason ?? 'This LiteRT model is not supported on this device.');
  }
}

export async function loadLiteRtModel(
  modelId: string,
  options: {
    maxTokens?: number;
    topK?: number;
    temperature?: number;
    preferredBackend?: PreferredBackend;
  } = {}
): Promise<void> {
  await assertLiteRtModelSupported(modelId);
  const modelPath = getLiteRtModelPath(modelId);
  const maxTokens = options.maxTokens ?? DEFAULT_LITERT_MAX_TOKENS;
  const topK = options.topK ?? DEFAULT_LITERT_TOP_K;
  const temperature = options.temperature ?? DEFAULT_LITERT_TEMPERATURE;
  const preferredBackend =
    options.preferredBackend ?? (modelId.endsWith('.litertlm') ? 'gpu' : 'default');
  const nextConfig: LiteRtLoadConfig = {
    modelId,
    maxTokens,
    topK,
    temperature,
    preferredBackend,
  };

  if (isSameLiteRtConfig(cachedLiteRtConfig, nextConfig)) {
    return;
  }

  if (cachedLiteRtModelId !== null) {
    await nativeUnloadLiteRtModel();
    cachedLiteRtModelId = null;
    cachedLiteRtConfig = null;
  }

  await nativeLoadLiteRtModel(modelPath, {
    maxTokens,
    topK,
    temperature,
    preferredBackend,
  });
  cachedLiteRtModelId = modelId;
  cachedLiteRtConfig = nextConfig;
}

export async function generateLiteRtResponse(
  modelId: string,
  prompt: string,
  onToken?: (token: string) => void
): Promise<string> {
  await loadLiteRtModel(modelId);

  let latestText = '';
  let emittedToken = false;
  let subscription: EventSubscription | null = null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  if (onToken) {
    subscription = addLiteRtTokenListener((event: LiteRtTokenEvent) => {
      latestText = event.text;
      if (event.delta) {
        emittedToken = true;
        onToken(event.delta);
      }
    });
  }

  try {
    const response = await Promise.race<string>([
      nativeGenerateLiteRtResponse(prompt),
      new Promise<string>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          void nativeCancelLiteRtGeneration().catch(() => {});
          reject(
            new Error(
              'LiteRT generation timed out. Try a shorter question, fewer active packs, or reload the model.'
            )
          );
        }, LITERT_GENERATION_TIMEOUT_MS);
      }),
    ]);
    if (onToken && !emittedToken && response) {
      onToken(response);
    }
    return response || latestText;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    subscription?.remove();
  }
}

export async function generateLiteRtAudioResponse(
  modelId: string,
  audioPath: string,
  prompt: string,
  onToken?: (token: string) => void
): Promise<string> {
  if (Platform.OS === 'ios' || Platform.OS === 'web') {
    throw new Error('LiteRT Audio Scribe is only available on Android.');
  }

  await loadLiteRtModel(modelId);

  let latestText = '';
  let emittedToken = false;
  let subscription: EventSubscription | null = null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  if (onToken) {
    subscription = addLiteRtTokenListener((event: LiteRtTokenEvent) => {
      latestText = event.text;
      if (event.delta) {
        emittedToken = true;
        onToken(event.delta);
      }
    });
  }

  try {
    const response = await Promise.race<string>([
      nativeGenerateLiteRtAudioResponse(stripFileUri(audioPath), prompt),
      new Promise<string>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          void nativeCancelLiteRtGeneration().catch(() => {});
          reject(
            new Error(
              'LiteRT Audio Scribe timed out. Try a shorter clip, a smaller file, or reload the model.'
            )
          );
        }, LITERT_GENERATION_TIMEOUT_MS);
      }),
    ]);
    if (onToken && !emittedToken && response) {
      onToken(response);
    }
    return response || latestText;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    subscription?.remove();
  }
}

export async function cancelLiteRtGeneration(): Promise<void> {
  await nativeCancelLiteRtGeneration();
}

export async function unloadLiteRtModel(): Promise<void> {
  await nativeUnloadLiteRtModel();
  cachedLiteRtModelId = null;
  cachedLiteRtConfig = null;
}
