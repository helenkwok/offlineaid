/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// i18n bootstrap. Side-effect module: importing this once at app startup
// (from src/app/_layout.tsx) registers i18next with all namespaces, picks
// the initial locale from either the persisted user override or the OS
// locale, and wires the runtime layout direction for RTL languages.
//
// Locale set: en · zh-Hans (Mandarin Simplified) · zh-Hant (Mandarin
// Traditional) · ar. Anything else falls back to en.
//
// See .planning/notes/2026-05-11-i18n-pre-submission-plan.md for the
// surrounding context.

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import { getLocales } from 'expo-localization';

import { usePreferencesStore } from '@/store';

import en_a11y from '@/locales/en/a11y.json';
import en_camera from '@/locales/en/camera.json';
import en_chat from '@/locales/en/chat.json';
import en_common from '@/locales/en/common.json';
import en_errors from '@/locales/en/errors.json';
import en_explore from '@/locales/en/explore.json';
import en_models from '@/locales/en/models.json';
import en_packs from '@/locales/en/packs.json';
import en_permissions from '@/locales/en/permissions.json';
import en_scribe from '@/locales/en/scribe.json';
import en_settings from '@/locales/en/settings.json';
import en_tabs from '@/locales/en/tabs.json';

import zhHans_a11y from '@/locales/zh-Hans/a11y.json';
import zhHans_camera from '@/locales/zh-Hans/camera.json';
import zhHans_chat from '@/locales/zh-Hans/chat.json';
import zhHans_common from '@/locales/zh-Hans/common.json';
import zhHans_errors from '@/locales/zh-Hans/errors.json';
import zhHans_explore from '@/locales/zh-Hans/explore.json';
import zhHans_models from '@/locales/zh-Hans/models.json';
import zhHans_packs from '@/locales/zh-Hans/packs.json';
import zhHans_permissions from '@/locales/zh-Hans/permissions.json';
import zhHans_scribe from '@/locales/zh-Hans/scribe.json';
import zhHans_settings from '@/locales/zh-Hans/settings.json';
import zhHans_tabs from '@/locales/zh-Hans/tabs.json';

import zhHant_a11y from '@/locales/zh-Hant/a11y.json';
import zhHant_camera from '@/locales/zh-Hant/camera.json';
import zhHant_chat from '@/locales/zh-Hant/chat.json';
import zhHant_common from '@/locales/zh-Hant/common.json';
import zhHant_errors from '@/locales/zh-Hant/errors.json';
import zhHant_explore from '@/locales/zh-Hant/explore.json';
import zhHant_models from '@/locales/zh-Hant/models.json';
import zhHant_packs from '@/locales/zh-Hant/packs.json';
import zhHant_permissions from '@/locales/zh-Hant/permissions.json';
import zhHant_scribe from '@/locales/zh-Hant/scribe.json';
import zhHant_settings from '@/locales/zh-Hant/settings.json';
import zhHant_tabs from '@/locales/zh-Hant/tabs.json';

import ar_a11y from '@/locales/ar/a11y.json';
import ar_camera from '@/locales/ar/camera.json';
import ar_chat from '@/locales/ar/chat.json';
import ar_common from '@/locales/ar/common.json';
import ar_errors from '@/locales/ar/errors.json';
import ar_explore from '@/locales/ar/explore.json';
import ar_models from '@/locales/ar/models.json';
import ar_packs from '@/locales/ar/packs.json';
import ar_permissions from '@/locales/ar/permissions.json';
import ar_scribe from '@/locales/ar/scribe.json';
import ar_settings from '@/locales/ar/settings.json';
import ar_tabs from '@/locales/ar/tabs.json';

export const SUPPORTED_LOCALES = ['en', 'zh-Hans', 'zh-Hant', 'ar'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const RTL_LOCALES: SupportedLocale[] = ['ar'];

export const NAMESPACES = [
  'a11y',
  'camera',
  'chat',
  'common',
  'errors',
  'explore',
  'models',
  'packs',
  'permissions',
  'scribe',
  'settings',
  'tabs',
] as const;

const resources = {
  en: {
    a11y: en_a11y,
    camera: en_camera,
    chat: en_chat,
    common: en_common,
    errors: en_errors,
    explore: en_explore,
    models: en_models,
    packs: en_packs,
    permissions: en_permissions,
    scribe: en_scribe,
    settings: en_settings,
    tabs: en_tabs,
  },
  // zh-Hans, zh-Hant, ar bundles translated via Gemma 4 E4B (Ollama, Mac)
  // 2026-05-12. See scripts/translate-i18n.py and the staging output at
  // scripts/i18n-staging/. Any key still missing in a non-en bundle falls
  // back to the en value via fallbackLng.
  'zh-Hans': {
    a11y: zhHans_a11y,
    camera: zhHans_camera,
    chat: zhHans_chat,
    common: zhHans_common,
    errors: zhHans_errors,
    explore: zhHans_explore,
    models: zhHans_models,
    packs: zhHans_packs,
    permissions: zhHans_permissions,
    scribe: zhHans_scribe,
    settings: zhHans_settings,
    tabs: zhHans_tabs,
  },
  'zh-Hant': {
    a11y: zhHant_a11y,
    camera: zhHant_camera,
    chat: zhHant_chat,
    common: zhHant_common,
    errors: zhHant_errors,
    explore: zhHant_explore,
    models: zhHant_models,
    packs: zhHant_packs,
    permissions: zhHant_permissions,
    scribe: zhHant_scribe,
    settings: zhHant_settings,
    tabs: zhHant_tabs,
  },
  ar: {
    a11y: ar_a11y,
    camera: ar_camera,
    chat: ar_chat,
    common: ar_common,
    errors: ar_errors,
    explore: ar_explore,
    models: ar_models,
    packs: ar_packs,
    permissions: ar_permissions,
    scribe: ar_scribe,
    settings: ar_settings,
    tabs: ar_tabs,
  },
} as const;

// Resolve the OS-reported locale tag (e.g. "zh-Hant-TW") to one of the four
// supported tags. The expo-localization tag is BCP-47, so we can rely on
// `zh-Hans` / `zh-Hant` script subtags for Chinese variants. For everything
// else we drop to the bare language code and check membership.
function resolveOsLocale(): SupportedLocale {
  const tag = getLocales()[0]?.languageTag ?? 'en';
  if (tag.startsWith('zh')) {
    // zh-Hant-TW, zh-Hant-HK, zh-Hant -> zh-Hant
    // zh-Hans-CN, zh-Hans-SG, zh-Hans -> zh-Hans
    // bare "zh" with no script subtag: default to Simplified (more common
    // globally; matches our pack-content default).
    if (tag.includes('Hant') || /^zh-(TW|HK|MO)/i.test(tag)) return 'zh-Hant';
    return 'zh-Hans';
  }
  if (tag.startsWith('ar')) return 'ar';
  if (tag.startsWith('en')) return 'en';
  return 'en';
}

const persistedLanguage = usePreferencesStore.getState().userLanguage;
const initialLanguage: SupportedLocale = persistedLanguage ?? resolveOsLocale();

i18next.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LOCALES as unknown as string[],
  ns: NAMESPACES as unknown as string[],
  defaultNS: 'common',
  interpolation: {
    // React Native (like React DOM) handles JSX-text escaping; i18next double-
    // escaping would corrupt brand tokens and apostrophes.
    escapeValue: false,
  },
  react: {
    // Suspense in the root layout would flash a blank screen on cold start;
    // the i18n bundle is local and synchronous, so `ready` flips true on the
    // first tick and components render immediately.
    useSuspense: false,
  },
  returnNull: false,
});

// React to picker changes (and to the first MMKV hydrate after cold start —
// at that moment the persisted userLanguage may differ from the OS-resolved
// initial). Subscribing here means the locale picker only needs to set the
// store; this side-effect handler is the single source of truth for both
// i18next.changeLanguage and the RTL layout flip.
usePreferencesStore.subscribe((state) => {
  const target: SupportedLocale = state.userLanguage ?? resolveOsLocale();
  if (i18next.language !== target) {
    void i18next.changeLanguage(target);
  }
});

// Mirror i18next.language into the React Native layout direction. Setting
// I18nManager.forceRTL takes effect on the NEXT bundle load only; the
// language picker is responsible for prompting the user to restart when
// flipping to/from `ar`. We still call forceRTL here so that the first
// production launch with a persisted `ar` override starts in RTL straight
// away (no second restart needed).
i18next.on('languageChanged', (lng) => {
  const shouldBeRTL = RTL_LOCALES.includes(lng as SupportedLocale);
  if (I18nManager.isRTL !== shouldBeRTL) {
    try {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
    } catch {
      // forceRTL can throw on web; safe to ignore — RTL is a native-only
      // concern for our purposes.
    }
  }
});

export default i18next;
