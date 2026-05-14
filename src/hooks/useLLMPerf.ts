/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * Phase 11 PERF-1 — selector hook for the live perf chip + per-message footer.
 *
 * Returns the latest TTFT/tok-s for the currently-loaded model plus a
 * generation-active flag, sourced from the existing benchmark store +
 * generation-state store. No new state is introduced here.
 */
import {
  useGenerationStateStore,
  useModelBenchmarkStore,
  useModelStore,
} from '@/store';

export interface LLMPerfSnapshot {
  ttftMs: number | null;
  tokps: number | null;
  isGenerating: boolean;
}

export function useLLMPerf(): LLMPerfSnapshot {
  const loadedModelId = useModelStore((s) => s.loadedModelId);
  const stats = useModelBenchmarkStore((s) =>
    loadedModelId ? s.byModelId[loadedModelId] : undefined,
  );
  const isGenerating = useGenerationStateStore((s) => s.isGenerating);

  return {
    ttftMs: stats?.ttftMs ?? null,
    tokps: stats?.decodeTokensPerSecond ?? null,
    isGenerating,
  };
}
