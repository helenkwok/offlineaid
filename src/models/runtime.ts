/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export type ChatModelBackend = 'llama' | 'litert';

export const AUDIO_SCRIBE_LITERT_MODEL_ID =
  'litert-community/gemma-4-E2B-it-litert-lm/gemma-4-E2B-it.litertlm';

const AUDIO_SCRIBE_MODEL_IDS = new Set([AUDIO_SCRIBE_LITERT_MODEL_ID]);

const GATED_MODEL_IDS = new Set([
  'litert-community/Gemma3-1B-IT/Gemma3-1B-IT_multi-prefill-seq_q4_ekv2048.task',
  'google/gemma-3n-E2B-it-litert-preview/gemma-3n-E2B-it-int4.task',
]);

const IOS_BLOCKED_LITERT_MODEL_REASONS = new Map<string, string>([
  [
    AUDIO_SCRIBE_LITERT_MODEL_ID,
    'Gemma 4 E2B LiteRT-LM still needs a true iOS LiteRT-LM bridge. Use Android for this model today.',
  ],
  [
    'litert-community/Gemma3-1B-IT/Gemma3-1B-IT_multi-prefill-seq_q4_ekv2048.task',
    'Gemma 3 1B LiteRT `.task` is documented for Android and web, not iOS.',
  ],
  [
    'google/gemma-3n-E2B-it-litert-preview/gemma-3n-E2B-it-int4.task',
    'This Gemma 3n LiteRT preview build is still wired for Android-only use in OfflineAid.',
  ],
]);

export function getModelFilename(modelId: string): string {
  const parts = modelId.split('/');
  if (parts.length < 3) {
    throw new Error(
      `Invalid model ID format: "${modelId}". Expected format: "owner/repo/filename"`
    );
  }
  return parts[parts.length - 1];
}

export function getModelDownloadUrl(modelId: string): string {
  const parts = modelId.split('/');
  if (parts.length < 3) {
    throw new Error(
      `Invalid model ID format: "${modelId}". Expected format: "owner/repo/filename"`
    );
  }
  const filename = parts[parts.length - 1];
  const repo = parts.slice(0, -1).join('/');
  return `https://huggingface.co/${repo}/resolve/main/${filename}?download=true`;
}

export function getModelRepoUrl(modelId: string): string {
  const parts = modelId.split('/');
  if (parts.length < 3) {
    throw new Error(
      `Invalid model ID format: "${modelId}". Expected format: "owner/repo/filename"`
    );
  }
  const repo = parts.slice(0, -1).join('/');
  return `https://huggingface.co/${repo}`;
}

export function requiresHuggingFaceAccess(modelId: string): boolean {
  return GATED_MODEL_IDS.has(modelId);
}

/**
 * Derive a compact display name from a HuggingFace-style model ID.
 * Input format: "owner/repo/filename"
 * Returns the repo segment with common noise suffixes stripped.
 * e.g. "google/gemma-3n-E2B-it-litert-preview/..." → "gemma-3n-E2B"
 *      "bartowski/gemma-2-2b-it-GGUF/..."           → "gemma-2-2b"
 */
export function getModelShortName(modelId: string): string {
  const parts = modelId.split('/');
  if (parts.length < 2) return modelId;
  return parts[1]
    .replace(/-gguf$/i, '')
    .replace(/-litert-preview$/i, '')
    .replace(/-it$/i, '')
    .replace(/-instruct$/i, '');
}

export function getChatModelBackend(modelId: string): ChatModelBackend {
  if (modelId.endsWith('.gguf')) {
    return 'llama';
  }
  if (modelId.endsWith('.task') || modelId.endsWith('.litertlm')) {
    return 'litert';
  }
  throw new Error(`Unsupported model format for "${modelId}"`);
}

export function isLiteRtModelId(modelId: string): boolean {
  return modelId.endsWith('.task') || modelId.endsWith('.litertlm');
}

export function getLiteRtModelPlatformBlockReason(
  modelId: string,
  platformOs: string = Platform.OS
): string | null {
  if (!isLiteRtModelId(modelId)) {
    return null;
  }

  if (platformOs === 'web') {
    return 'LiteRT models are only available in the native app.';
  }

  if (platformOs === 'ios' || platformOs === 'tvos') {
    return (
      IOS_BLOCKED_LITERT_MODEL_REASONS.get(modelId) ??
      (modelId.endsWith('.litertlm')
        ? 'LiteRT-LM `.litertlm` bundles are not supported by the current iOS bridge yet.'
        : null)
    );
  }

  if (platformOs === 'android') {
    const androidVersion = Number(Platform.Version);
    if (androidVersion < 31) {
      return 'LiteRT requires Android 12 (API 31) or newer.';
    }
  }

  return null;
}

export function isLlamaModelId(modelId: string): boolean {
  return modelId.endsWith('.gguf');
}

export function supportsAudioScribe(modelId: string): boolean {
  return AUDIO_SCRIBE_MODEL_IDS.has(modelId);
}

export function getAudioScribeModelIds(): string[] {
  return Array.from(AUDIO_SCRIBE_MODEL_IDS);
}

const MODEL_DISPLAY_NAMES = new Map<string, string>([
  [AUDIO_SCRIBE_LITERT_MODEL_ID, 'Gemma 4 E2B'],
]);

// User-facing pretty name. Prefer this in pill labels and prominent UI;
// `getModelShortName` is the denser default for chips and headers where
// the brand-friendly form would be too long.
export function getModelDisplayName(modelId: string): string {
  const explicit = MODEL_DISPLAY_NAMES.get(modelId);
  if (explicit) {
    return explicit;
  }
  return getModelShortName(modelId);
}

export function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

export function stripFileUri(pathOrUri: string): string {
  return pathOrUri.startsWith('file://') ? pathOrUri.slice(7) : pathOrUri;
}

export function getParentUri(fileUri: string): string {
  const lastSlash = fileUri.lastIndexOf('/');
  if (lastSlash <= 'file://'.length) {
    throw new Error(`Could not determine parent directory for "${fileUri}"`);
  }
  return fileUri.slice(0, lastSlash);
}

export function getLiteRtModelsDirectory(): Directory {
  return new Directory(Paths.document, 'litert-models');
}

export function getLiteRtModelUri(modelId: string): string {
  return new File(getLiteRtModelsDirectory(), getModelFilename(modelId)).uri;
}

export function getLiteRtModelPath(modelId: string): string {
  return stripFileUri(getLiteRtModelUri(modelId));
}
