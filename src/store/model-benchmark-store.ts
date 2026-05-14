/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './mmkv';

export interface ModelBenchmarkStats {
  decodeTokensPerSecond?: number;
  loadTimeMs?: number;
  ttftMs?: number;
  updatedAt: number;
}

interface ModelBenchmarkState {
  byModelId: Record<string, ModelBenchmarkStats>;
  recordGenerationMetrics: (modelId: string, stats: {
    decodeTokensPerSecond?: number;
    ttftMs?: number;
  }) => void;
  recordLoadMetric: (modelId: string, loadTimeMs: number) => void;
}

export const useModelBenchmarkStore = create<ModelBenchmarkState>()(
  persist(
    (set) => ({
      byModelId: {},
      recordLoadMetric: (modelId, loadTimeMs) =>
        set((state) => ({
          byModelId: {
            ...state.byModelId,
            [modelId]: {
              ...state.byModelId[modelId],
              loadTimeMs,
              updatedAt: Date.now(),
            },
          },
        })),
      recordGenerationMetrics: (modelId, stats) =>
        set((state) => ({
          byModelId: {
            ...state.byModelId,
            [modelId]: {
              ...state.byModelId[modelId],
              ...stats,
              updatedAt: Date.now(),
            },
          },
        })),
    }),
    {
      name: 'model-benchmark-store',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ byModelId: state.byModelId }),
    }
  )
);
