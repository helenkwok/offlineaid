/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { useModelStore } from '@/store/model-store';
import { usePackStore } from '@/store/pack-store';
import { useGenerationStateStore } from '@/store/generation-state-store';
import { useModelBenchmarkStore } from '@/store/model-benchmark-store';
import { getModelShortName } from '@/models/runtime';
import type { ReadinessState } from '@/components/readiness/types';

// Pure derivation of the 6-state readiness union from the live stores.
// First-match-wins decision tree per 11-DESIGN-BRIEF rev 6 section 6.
//
// DEVIATIONS from plan (documented for SUMMARY):
//   * Pack metadata schema does not expose `languages` or `freshness` keys
//     today. We proxy from `country` (which today is "AU" / "EN+ZH+AR" style
//     scenario tags) and default freshness to 'static'. Future pack-builder
//     work should add explicit `languages` + `freshness_tier` keys to
//     pack_metadata; the readiness sheet's section 8 freshness-tier copy
//     will pick up the real values automatically.
export function useReadinessState(): ReadinessState {
  const isLoadingModel = useModelStore((s) => s.isLoadingModel);
  const loadingModelId = useModelStore((s) => s.loadingModelId);
  const loadedModelId = useModelStore((s) => s.loadedModelId);
  const activePacks = usePackStore((s) => s.activePacks);
  const downloadProgress = usePackStore((s) => s.packDownloadProgress);
  const isGenerating = useGenerationStateStore((s) => s.isGenerating);
  const benchmarks = useModelBenchmarkStore((s) => s.byModelId);

  // 1. Model load is in flight.
  if (isLoadingModel && loadingModelId) {
    return { kind: 'model-loading', modelName: getModelShortName(loadingModelId) };
  }

  // 2. No model loaded.
  if (!loadedModelId) {
    return { kind: 'no-model' };
  }

  // 3. Pack indexing in progress (proxy: any pack with non-zero, non-complete progress).
  const indexingEntry = Object.entries(downloadProgress).find(
    ([, ratio]) => ratio > 0 && ratio < 1
  );
  if (indexingEntry) {
    const [packId] = indexingEntry;
    const pack = activePacks.find((p) => p.id === packId);
    return { kind: 'pack-loading', packName: pack?.name ?? 'pack' };
  }

  // 4. Model loaded but no active packs.
  if (activePacks.length === 0) {
    return { kind: 'model-loaded-no-pack', modelName: getModelShortName(loadedModelId) };
  }

  // 5. Streaming.
  if (isGenerating) {
    const stats = benchmarks[loadedModelId];
    return {
      kind: 'ready-streaming',
      ttftMs: stats?.ttftMs ?? null,
      tokps: stats?.decodeTokensPerSecond ?? null,
    };
  }

  // 6. Ready idle.
  const languages = deriveLanguages(activePacks);
  return {
    kind: 'ready-idle',
    modelName: getModelShortName(loadedModelId),
    packCount: activePacks.length,
    languages,
    freshness: 'static', // TODO: read pack_metadata.freshness_tier when pack-builder ships it
  };
}

function deriveLanguages(packs: { country: string; scenario: string }[]): string[] {
  const set = new Set<string>();
  for (const pack of packs) {
    // Heuristic: scenario tags often look like "scam-resilience-au" or "EN/ZH/AR";
    // also accept country codes. Future schema work will replace this with an
    // explicit `languages` field.
    const tokens = `${pack.scenario} ${pack.country}`.toUpperCase().match(/\b(EN|ZH|AR|VI|FR|ES|DE|JA|KO)\b/g);
    if (tokens) tokens.forEach((t) => set.add(t));
  }
  return Array.from(set);
}
