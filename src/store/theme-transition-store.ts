/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * SUNLIGHT-1 / 11-DESIGN-BRIEF rev 6 section 11 (animation restraint).
 *
 * Transient (NOT persisted) store of one-shot flags consumed by the
 * root-layout theme-fade decision. The auto-switch dialog primary-button
 * handler sets autoSwitchJustConfirmed=true immediately before flipping
 * the OS color scheme; the root-layout effect reads the flag during the
 * subsequent theme-key change and clears it. This implements case (c) of
 * the 4-case spec: UI underneath snaps instantly, dialog dismiss-fade is
 * the only visible motion.
 *
 * Kept out of preferences-store because it must NEVER persist across
 * sessions (a stale flag would suppress the case-b crossfade on the next
 * launch).
 */
import { create } from 'zustand';

interface ThemeTransitionState {
  autoSwitchJustConfirmed: boolean;
  setAutoSwitchJustConfirmed: (value: boolean) => void;
}

export const useThemeTransitionStore = create<ThemeTransitionState>()((set) => ({
  autoSwitchJustConfirmed: false,
  setAutoSwitchJustConfirmed: (value) => set({ autoSwitchJustConfirmed: value }),
}));
