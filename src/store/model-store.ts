/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';
import { createDownloadResumable } from 'expo-file-system/legacy';
import { mmkvStorage } from './mmkv';
import {
  getChatModelBackend,
  getModelFilename,
  getLiteRtModelPath,
  getLiteRtModelUri,
  getModelDownloadUrl,
  getModelRepoUrl,
  getParentUri,
  isLlamaModelId,
  requiresHuggingFaceAccess,
  toFileUri,
} from '@/models/runtime';
import { isPreparedChatModel, prepareChatModel, releaseChatModel } from '@/providers/llm';
import { useModelBenchmarkStore } from './model-benchmark-store';

type LlamaModule = typeof import('@react-native-ai/llama');

async function loadLlamaModule(): Promise<LlamaModule> {
  if (Platform.OS === 'web') {
    throw new Error('On-device llama models are not available on web.');
  }
  return import('@react-native-ai/llama');
}

function requireLlamaModule(): LlamaModule {
  if (Platform.OS === 'web') {
    throw new Error('On-device llama models are not available on web.');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-ai/llama') as LlamaModule;
}

type ProgressMap = Record<string, number>;

function omitProgressKey(progress: ProgressMap, key: string): ProgressMap {
  const { [key]: _removed, ...rest } = progress;
  return rest;
}

function parseSizeToBytes(sizeStr: string): number {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(GB|MB|KB|B)$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multi: Record<string, number> = {
    GB: 1024 ** 3,
    MB: 1024 ** 2,
    KB: 1024,
    B: 1,
  };
  return value * (multi[unit] || 1);
}

const HUGGING_FACE_TOKEN_URL = 'https://huggingface.co/settings/tokens';
const HUGGING_FACE_TOKEN_KEY = 'hugging-face-read-token';
const MODEL_TEXT_PROBE_BYTES = 8192;

function isTrackedModelId(modelId: string | null | undefined): modelId is string {
  return typeof modelId === 'string' && modelId.includes('/');
}

function shouldDiscardModelAfterLoadFailure(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === 'string'
        ? error.toLowerCase()
        : '';

  return [
    'corrupt',
    'corrupted',
    'incomplete',
    'no such file',
    'file is missing',
    'tensor',
    'gguf',
    'bad magic',
    'unexpected eof',
    'not within the file bounds',
  ].some((fragment) => message.includes(fragment));
}

function shouldSurfaceLoadFailureDirectly(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === 'string'
        ? error.toLowerCase()
        : '';

  return [
    'android 12 or newer',
    'ios 17 or newer',
    'not supported by the current ios bridge',
    'documented for android and web, not ios',
    'android-only use in offlineaid',
    'use android for this model today',
    'native build yet',
  ].some((fragment) => message.includes(fragment));
}

async function isModelOnDisk(modelId: string): Promise<boolean> {
  const path = await getStoredModelPath(modelId);
  return (await getDownloadedModelValidationError(modelId, path)) === null;
}

function readFileHeader(file: File, length = 8): Uint8Array<ArrayBuffer> {
  const handle = file.open();
  try {
    return handle.readBytes(length);
  } finally {
    handle.close();
  }
}

function readFilePrefix(file: File, length = MODEL_TEXT_PROBE_BYTES): Uint8Array<ArrayBuffer> {
  const handle = file.open();
  try {
    return handle.readBytes(Math.min(length, file.size));
  } finally {
    handle.close();
  }
}

function extractLeadingText(file: File): string | null {
  const bytes = readFilePrefix(file);
  if (bytes.length === 0) {
    return null;
  }

  let printable = 0;
  for (const byte of bytes) {
    const isWhitespace = byte === 9 || byte === 10 || byte === 13;
    const isPrintableAscii = byte >= 32 && byte <= 126;
    if (isWhitespace || isPrintableAscii) {
      printable += 1;
    }
  }

  if (printable / bytes.length < 0.85) {
    return null;
  }

  return new TextDecoder().decode(bytes).trim();
}

function formatBytesHex(bytes: Uint8Array<ArrayBuffer>): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(' ');
}

function getRestrictedModelMessage(modelId: string): string {
  const repoUrl = getModelRepoUrl(modelId);
  const repoSpecificHint = modelId.includes('Gemma3-1B-IT')
    ? 'accept the Gemma license'
    : 'request or accept access to the model files';

  return `This model is restricted on Hugging Face. On your phone, open ${repoUrl}, sign in with the same account used for this token, and ${repoSpecificHint}. If you use a fine-grained token, it must include read access to this repo. Then create or update a read token at ${HUGGING_FACE_TOKEN_URL}, save it in OfflineAid, and tap Download. No CLI is required.`;
}

function getWebPageInsteadOfModelMessage(modelId: string): string {
  return `Hugging Face returned a web page instead of the model file. This usually means the saved token belongs to a different account than the one approved for this repo, the fine-grained token does not include read access to this model, or the access request is still pending. Open ${getModelRepoUrl(modelId)} in the same account, confirm the file is downloadable there, then retry.`;
}

function getDownloadedFileDebugLine(modelId: string, modelPath: string): string {
  return `Downloaded file: ${getModelFilename(modelId)}\nLocal path: ${modelPath}`;
}

function getDownloadedFileSignatureDebugLine(
  file: File,
  header: Uint8Array<ArrayBuffer>
): string {
  return `File size: ${file.size} bytes\nFirst bytes: ${formatBytesHex(header) || '(empty)'}`;
}

async function removeModelFromDisk(modelId: string): Promise<void> {
  if (isLlamaModelId(modelId)) {
    const { removeModel } = await loadLlamaModule();
    await removeModel(modelId).catch(() => {});
    return;
  }
  const file = new File(getLiteRtModelUri(modelId));
  if (file.exists) {
    file.delete();
  }
}

async function getStoredModelPath(modelId: string): Promise<string> {
  if (isLlamaModelId(modelId)) {
    const { getModelPath } = await loadLlamaModule();
    return getModelPath(modelId);
  }
  return getLiteRtModelPath(modelId);
}

async function getDownloadedModelValidationError(
  modelId: string,
  modelPath: string
): Promise<string | null> {
  const file = new File(toFileUri(modelPath));
  if (!file.exists) {
    return 'Model file is missing.';
  }

  const downloadedFileDebugLine = getDownloadedFileDebugLine(modelId, modelPath);
  const header = readFileHeader(file, 4);
  const downloadedFileSignatureDebugLine = getDownloadedFileSignatureDebugLine(file, header);
  const isGguf =
    header[0] === 0x47 && header[1] === 0x47 && header[2] === 0x55 && header[3] === 0x46;
  const isLiteRt =
    header[0] === 0x54 && header[1] === 0x46 && header[2] === 0x4C && header[3] === 0x33;

  if (getChatModelBackend(modelId) === 'llama' && isGguf) {
    return null;
  }

  if (getChatModelBackend(modelId) === 'litert' && isLiteRt) {
    return null;
  }

  const leadingText = extractLeadingText(file);
  if (leadingText) {
    const normalizedText = leadingText.toLowerCase();
    if (
      leadingText.includes('Access to model') ||
      leadingText.includes('Please log in') ||
      leadingText.includes('GatedRepo') ||
      leadingText.includes('Authentication required')
    ) {
      return getRestrictedModelMessage(modelId);
    }
    if (leadingText.includes('Repository Not Found') || normalizedText.includes('404')) {
      return 'This model download URL is not publicly accessible.';
    }
    if (normalizedText.includes('<!doctype html') || normalizedText.includes('<html')) {
      return getWebPageInsteadOfModelMessage(modelId);
    }
    if (normalizedText.includes('error') || normalizedText.includes('unauthorized')) {
      const firstLine = leadingText.split('\n')[0]?.trim();
      return firstLine
        ? `Hugging Face returned an error instead of the model file: ${firstLine}\n${downloadedFileDebugLine}\n${downloadedFileSignatureDebugLine}`
        : `${getWebPageInsteadOfModelMessage(modelId)}\n${downloadedFileDebugLine}\n${downloadedFileSignatureDebugLine}`;
    }
  }

  if (getChatModelBackend(modelId) === 'litert') {
    return null;
  }

  return getChatModelBackend(modelId) === 'litert'
    ? `Downloaded file is not a valid LiteRT model bundle.\n${downloadedFileDebugLine}\n${downloadedFileSignatureDebugLine}`
    : `Downloaded file is not a valid GGUF model.\n${downloadedFileDebugLine}\n${downloadedFileSignatureDebugLine}`;
}

interface ModelState {
  loadedModelId: string | null;
  isLoaded: boolean;
  isLoadingModel: boolean; // true while loadModel() is in flight (FAIL-LADDER-1 readiness chip)
  loadingModelId: string | null;
  loadedEmbeddingModelId: string | null;
  downloadedModels: string[];
  downloadProgress: ProgressMap;
  isHuggingFaceTokenLoaded: boolean;
  huggingFaceToken: string;
  hydrateHuggingFaceToken: () => Promise<void>;
  setHuggingFaceToken: (token: string) => Promise<void>;
  clearHuggingFaceToken: () => Promise<void>;
  refreshDownloadedModels: (knownModelIds?: string[]) => Promise<void>;
  isDownloaded: (modelId: string) => Promise<boolean>;
  downloadModel: (modelId: string, sizeHint?: string) => Promise<void>;
  importModel: (modelId: string, sourceUri: string) => Promise<void>;
  loadModel: (modelId: string) => Promise<void>;
  loadEmbeddingModel: (modelId: string) => Promise<void>;
  unloadModel: () => void;
  localPath: (modelId: string) => string;
}

export const useModelStore = create<ModelState>()(
  persist(
    (set, get) => ({
      loadedModelId: null,
      isLoaded: false,
      isLoadingModel: false,
      loadingModelId: null,
      loadedEmbeddingModelId: null,
      downloadedModels: [],
      downloadProgress: {},
      isHuggingFaceTokenLoaded: false,
      huggingFaceToken: '',

      hydrateHuggingFaceToken: async () => {
        if (Platform.OS === 'web') {
          set({ huggingFaceToken: '', isHuggingFaceTokenLoaded: true });
          return;
        }
        const token = (await SecureStore.getItemAsync(HUGGING_FACE_TOKEN_KEY)) ?? '';
        set({ huggingFaceToken: token, isHuggingFaceTokenLoaded: true });
      },

      setHuggingFaceToken: async (token) => {
        const trimmed = token.trim();
        if (Platform.OS !== 'web') {
          if (trimmed) {
            await SecureStore.setItemAsync(HUGGING_FACE_TOKEN_KEY, trimmed);
          } else {
            await SecureStore.deleteItemAsync(HUGGING_FACE_TOKEN_KEY);
          }
        }
        set({ huggingFaceToken: trimmed, isHuggingFaceTokenLoaded: true });
      },

      clearHuggingFaceToken: async () => {
        if (Platform.OS !== 'web') {
          await SecureStore.deleteItemAsync(HUGGING_FACE_TOKEN_KEY);
        }
        set({ huggingFaceToken: '', isHuggingFaceTokenLoaded: true });
      },

      refreshDownloadedModels: async (knownModelIds = []) => {
        if (Platform.OS === 'web') {
          set({ downloadedModels: [] });
          return;
        }
        const state = get();
        const candidateIds = [
          ...new Set([
            ...knownModelIds,
            ...state.downloadedModels,
            state.loadedModelId,
            state.loadedEmbeddingModelId,
          ].filter(isTrackedModelId)),
        ];
        const checks = await Promise.all(
          candidateIds.map(async (modelId) => ((await isModelOnDisk(modelId)) ? modelId : null))
        );
        const downloaded = checks.filter((modelId): modelId is string => modelId !== null);
        const loadedModelId =
          isTrackedModelId(state.loadedModelId) &&
          downloaded.includes(state.loadedModelId) &&
          isPreparedChatModel(state.loadedModelId)
            ? state.loadedModelId
            : null;
        const loadedEmbeddingModelId =
          isTrackedModelId(state.loadedEmbeddingModelId) &&
          downloaded.includes(state.loadedEmbeddingModelId)
            ? state.loadedEmbeddingModelId
            : null;

        set({
          downloadedModels: downloaded,
          loadedModelId,
          isLoaded: loadedModelId !== null,
          loadedEmbeddingModelId,
        });
      },

      isDownloaded: async (modelId: string) => {
        if (Platform.OS === 'web') {
          return false;
        }
        return isModelOnDisk(modelId);
      },

      downloadModel: async (modelId, sizeHint) => {
        if (Platform.OS === 'web') {
          throw new Error('Model downloads are only supported on iOS and Android.');
        }

        if (sizeHint) {
          const requiredBytes = parseSizeToBytes(sizeHint);
          const bufferBytes = 200 * 1024 * 1024; // 200MB buffer
          const availableBytes = Paths.availableDiskSpace;
          if (availableBytes < requiredBytes + bufferBytes) {
            const availableGb = (availableBytes / 1024 ** 3).toFixed(2);
            throw new Error(
              `Insufficient disk space to download this model. Required: ${sizeHint} (+ 200MB buffer). Available: ${availableGb} GB.`
            );
          }
        }

        const huggingFaceToken = get().huggingFaceToken.trim();
        if (requiresHuggingFaceAccess(modelId) && !huggingFaceToken) {
          throw new Error(
            `This model is gated on Hugging Face. On your phone, open ${getModelRepoUrl(modelId)} in your browser and accept access, then create a read token at ${HUGGING_FACE_TOKEN_URL} and paste it into OfflineAid. No CLI is required.`
          );
        }
        const alreadyTracked = get().downloadedModels.includes(modelId);
        const backend = getChatModelBackend(modelId);
        const modelPath = await getStoredModelPath(modelId);
        const existingValidationError = await getDownloadedModelValidationError(modelId, modelPath);

        if (existingValidationError === null) {
          if (alreadyTracked) {
            set((s) => ({
              downloadedModels: s.downloadedModels.includes(modelId)
                ? s.downloadedModels
                : [...s.downloadedModels, modelId],
              downloadProgress: { ...s.downloadProgress, [modelId]: 1 },
            }));
            return;
          }
        } else {
          await removeModelFromDisk(modelId);
        }

        try {
          const downloadUrl = getModelDownloadUrl(modelId);
          const modelUri = toFileUri(modelPath);
          const modelDir = new Directory(getParentUri(modelUri));
          modelDir.create({ idempotent: true, intermediates: true });

          const download = createDownloadResumable(
            downloadUrl,
            modelUri,
            huggingFaceToken
              ? {
                  headers: {
                    Authorization: `Bearer ${huggingFaceToken}`,
                  },
                }
              : {},
            ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
              const ratio =
                totalBytesExpectedToWrite > 0
                  ? totalBytesWritten / totalBytesExpectedToWrite
                  : 0;
              set((s) => ({
                downloadProgress: {
                  ...s.downloadProgress,
                  [modelId]: ratio,
                },
              }));
            }
          );

          const result = await download.downloadAsync();
          if (!result?.uri) {
            throw new Error('No local file was written for the downloaded model.');
          }

          const validationError = await getDownloadedModelValidationError(modelId, modelPath);
          if (validationError) {
            throw new Error(validationError);
          }

          set((s) => ({
            downloadProgress: { ...s.downloadProgress, [modelId]: 1 },
            downloadedModels: s.downloadedModels.includes(modelId)
              ? s.downloadedModels
              : [...s.downloadedModels, modelId],
          }));
        } catch (error) {
          await removeModelFromDisk(modelId);
          set((s) => ({
            downloadedModels: s.downloadedModels.filter((id) => id !== modelId),
            downloadProgress: omitProgressKey(s.downloadProgress, modelId),
            loadedModelId: s.loadedModelId === modelId ? null : s.loadedModelId,
            isLoaded: s.loadedModelId === modelId ? false : s.isLoaded,
            loadedEmbeddingModelId:
              s.loadedEmbeddingModelId === modelId ? null : s.loadedEmbeddingModelId,
          }));

          const detail =
            error instanceof Error
              ? ` ${error.message}`
              : typeof error === 'string'
                ? ` ${error}`
                : '';
          throw new Error(
            `Download failed for the ${backend.toUpperCase()} model. OfflineAid removed the incomplete local file so you can retry.${detail}`
          );
        }
      },

      importModel: async (modelId, sourceUri) => {
        if (Platform.OS === 'web') {
          throw new Error('Model import is only supported on iOS and Android.');
        }

        const sourceFile = new File(sourceUri);
        if (!sourceFile.exists) {
          throw new Error('Source file does not exist.');
        }

        const requiredBytes = sourceFile.size;
        const bufferBytes = 200 * 1024 * 1024; // 200MB buffer
        const availableBytes = Paths.availableDiskSpace;
        if (availableBytes < requiredBytes + bufferBytes) {
          const availableGb = (availableBytes / 1024 ** 3).toFixed(2);
          const requiredGb = (requiredBytes / 1024 ** 3).toFixed(2);
          throw new Error(
            `Insufficient disk space to import this model. Required: ${requiredGb} GB (+ 200MB buffer). Available: ${availableGb} GB.`
          );
        }

        const modelPath = await getStoredModelPath(modelId);
        const modelUri = toFileUri(modelPath);
        const modelDir = new Directory(getParentUri(modelUri));
        const destFile = new File(modelUri);

        modelDir.create({ idempotent: true, intermediates: true });
        if (destFile.exists) {
          destFile.delete();
        }
        sourceFile.copy(destFile);

        const validationError = await getDownloadedModelValidationError(modelId, modelPath);
        if (validationError) {
          if (destFile.exists) {
            destFile.delete();
          }
          throw new Error(validationError);
        }

        set((s) => ({
          downloadProgress: { ...s.downloadProgress, [modelId]: 1 },
          downloadedModels: s.downloadedModels.includes(modelId)
            ? s.downloadedModels
            : [...s.downloadedModels, modelId],
        }));
      },

      loadModel: async (modelId) => {
        if (Platform.OS === 'web') {
          throw new Error('Model loading is only supported on iOS and Android.');
        }
        if (!(await get().isDownloaded(modelId))) {
          set((s) => ({
            downloadedModels: s.downloadedModels.filter((id) => id !== modelId),
            downloadProgress: omitProgressKey(s.downloadProgress, modelId),
            loadedModelId: null,
            isLoaded: false,
          }));
          throw new Error('Model file is missing. Download it again.');
        }

        try {
          set({ isLoadingModel: true, loadingModelId: modelId });
          const loadStartedAt = Date.now();
          await prepareChatModel(modelId);
          useModelBenchmarkStore
            .getState()
            .recordLoadMetric(modelId, Date.now() - loadStartedAt);
          set({ loadedModelId: modelId, isLoaded: true, isLoadingModel: false, loadingModelId: null });
        } catch (error) {
          console.warn('[OfflineAid] model load failed', modelId, error);
          const shouldDiscard = shouldDiscardModelAfterLoadFailure(error);
          const isLiteRtLmModel = modelId.endsWith('.litertlm');
          const shouldSurfaceDirectly = shouldSurfaceLoadFailureDirectly(error);
          set((s) => ({
            downloadedModels: shouldDiscard
              ? s.downloadedModels.filter((id) => id !== modelId)
              : s.downloadedModels,
            downloadProgress: shouldDiscard
              ? omitProgressKey(s.downloadProgress, modelId)
              : { ...s.downloadProgress, [modelId]: 1 },
            loadedModelId: null,
            isLoaded: false,
            isLoadingModel: false,
            loadingModelId: null,
          }));

          if (shouldSurfaceDirectly && error instanceof Error) {
            throw error;
          }

          const detail = error instanceof Error && error.message ? ` ${error.message}` : '';
          throw new Error(
            shouldDiscard
              ? 'This model file looks incomplete or corrupted. Tap Download to repair the local file.' +
                  detail
              : isLiteRtLmModel
                ? 'This LiteRT-LM model could not be started just now, but the downloaded file was kept. Try Load again. If it still fails, restart the app and retry before re-downloading.' +
                    detail
                : 'This model could not be loaded, but the downloaded file was kept. Try Load again after freeing memory, or use a smaller model such as Gemma 3 1B LiteRT or Qwen 3.5 0.8B. If you suspect corruption, tap Download to repair the local file.' +
                    detail
          );
        }
      },

      loadEmbeddingModel: async (modelId) => {
        if (Platform.OS === 'web') {
          throw new Error('Embedding models are only supported on iOS and Android.');
        }
        if (!(await get().isDownloaded(modelId))) {
          set((s) => ({
            downloadedModels: s.downloadedModels.filter((id) => id !== modelId),
            downloadProgress: omitProgressKey(s.downloadProgress, modelId),
            loadedEmbeddingModelId: null,
          }));
          throw new Error('Embedding model file is missing. Download it again.');
        }
        set({ loadedEmbeddingModelId: modelId });
      },

      unloadModel: () => {
        void releaseChatModel();
        set({ loadedModelId: null, isLoaded: false });
      },

      localPath: (modelId: string) =>
        isLlamaModelId(modelId) ? requireLlamaModule().getModelPath(modelId) : getLiteRtModelPath(modelId),
    }),
    {
      name: 'model-store',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        loadedEmbeddingModelId: state.loadedEmbeddingModelId,
        downloadedModels: state.downloadedModels,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<ModelState>),
        loadedModelId: null,
        isLoaded: false,
        isLoadingModel: false,
        loadingModelId: null,
      }),
    }
  )
);
