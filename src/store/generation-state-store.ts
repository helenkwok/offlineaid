/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * Phase 11 PERF-1 — global generation state.
 *
 * useLLM marks isGenerating=true on stream start, flips it false on stream end
 * (success, error, or abort). The header-right perf chip subscribes to this
 * flag instead of threading state through React props from the chat screen.
 */
import { create } from 'zustand';

interface GenerationState {
  isGenerating: boolean;
  setGenerating: (value: boolean) => void;
}

export const useGenerationStateStore = create<GenerationState>()((set) => ({
  isGenerating: false,
  setGenerating: (value) => set({ isGenerating: value }),
}));
