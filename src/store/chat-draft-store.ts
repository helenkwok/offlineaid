/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { create } from 'zustand';

interface ChatDraftState {
  pendingDraft: string | null;
  setPendingDraft: (value: string | null) => void;
  consumePendingDraft: () => string | null;
}

export const useChatDraftStore = create<ChatDraftState>()((set, get) => ({
  pendingDraft: null,
  setPendingDraft: (value) => set({ pendingDraft: value }),
  consumePendingDraft: () => {
    const current = get().pendingDraft;
    set({ pendingDraft: null });
    return current;
  },
}));
