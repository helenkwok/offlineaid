/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AUDIO_SCRIBE_LITERT_MODEL_ID } from '@/models/runtime';
import { mmkvStorage } from './mmkv';

interface PreferencesState {
  voiceAutoSend: boolean;
  setVoiceAutoSend: (value: boolean) => void;
  ragEnabled: boolean;
  setRagEnabled: (value: boolean) => void;
  toggleRagEnabled: () => void;
  // FAIL-LADDER-1 / 11-DESIGN-BRIEF rev 6 section 7: when ON, refusal blocks
  // also surface the closest stricter-threshold chunk (paraphrased variant).
  // Default OFF (safer; section 8 Settings copy).
  suggestClosestPackOnRefusals: boolean;
  setSuggestClosestPackOnRefusals: (value: boolean) => void;
  // Audio Scribe default model. Persists the user's chosen on-device model
  // for AI-based audio transcription. Factory default is Gemma 4 E2B-it.
  // The Audio Scribe screen reads this on mount but allows per-session
  // override via the in-screen path selector (override does NOT write back).
  audioScribeDefaultModelId: string;
  setAudioScribeDefaultModelId: (modelId: string) => void;
  // SUNLIGHT-1 / 11-DESIGN-BRIEF rev 6 section 3 + section 7. In-app
  // hard-contrast palette opt-in. Independent of system Dark Mode. The OS
  // high-contrast preference always wins via short-circuit in useTheme(),
  // so this toggle CANNOT disable a true OS setting.
  sunlightMode: boolean;
  setSunlightMode: (value: boolean) => void;
  // Saved when the soft auto-switch dialog flips the user from Dark to Light;
  // used to restore Dark on Sunlight OFF.
  previousColorScheme: 'light' | 'dark' | null;
  setPreviousColorScheme: (value: 'light' | 'dark' | null) => void;
  // Honour user choice to suppress the soft auto-switch dialog on this device.
  sunlightAutoSwitchDontAskAgain: boolean;
  setSunlightAutoSwitchDontAskAgain: (value: boolean) => void;
  // i18n: user-selected interface language override. null = follow OS locale
  // (resolved via expo-localization getLocales()). Picker writes here; i18n
  // store subscriber calls i18n.changeLanguage() on change.
  userLanguage: 'en' | 'zh-Hans' | 'zh-Hant' | 'ar' | null;
  setUserLanguage: (value: 'en' | 'zh-Hans' | 'zh-Hant' | 'ar' | null) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      voiceAutoSend: false,
      setVoiceAutoSend: (value) => set({ voiceAutoSend: value }),
      ragEnabled: true,
      setRagEnabled: (value) => set({ ragEnabled: value }),
      toggleRagEnabled: () => set({ ragEnabled: !get().ragEnabled }),
      suggestClosestPackOnRefusals: false,
      setSuggestClosestPackOnRefusals: (value) => set({ suggestClosestPackOnRefusals: value }),
      audioScribeDefaultModelId: AUDIO_SCRIBE_LITERT_MODEL_ID,
      setAudioScribeDefaultModelId: (modelId) => set({ audioScribeDefaultModelId: modelId }),
      sunlightMode: false,
      setSunlightMode: (value) => set({ sunlightMode: value }),
      previousColorScheme: null,
      setPreviousColorScheme: (value) => set({ previousColorScheme: value }),
      sunlightAutoSwitchDontAskAgain: false,
      setSunlightAutoSwitchDontAskAgain: (value) => set({ sunlightAutoSwitchDontAskAgain: value }),
      userLanguage: null,
      setUserLanguage: (value) => set({ userLanguage: value }),
    }),
    {
      name: 'preferences-store',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        voiceAutoSend: state.voiceAutoSend,
        ragEnabled: state.ragEnabled,
        suggestClosestPackOnRefusals: state.suggestClosestPackOnRefusals,
        audioScribeDefaultModelId: state.audioScribeDefaultModelId,
        sunlightMode: state.sunlightMode,
        previousColorScheme: state.previousColorScheme,
        sunlightAutoSwitchDontAskAgain: state.sunlightAutoSwitchDontAskAgain,
        userLanguage: state.userLanguage,
      }),
    }
  )
);
