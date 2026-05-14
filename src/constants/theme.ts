/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * THEME-1 single-hue red theme — UI-SPEC Phase 11 Addendum 3.
 *
 * Dual-red role rule (DO NOT VIOLATE):
 *   red-600 #dc2626   → FILL only (button bg, toggle track, chip border, send)
 *   red-700 #b91c1c   → fill, pressed/strong (buttonLink light, accentStrong light)
 *   red-400 #f87171   → TEXT/ICON on dark surfaces only (clears AA on near-black)
 *   red-50  #fef2f2   → tinted surface (light) — surfaceAccent, surfaceInfo, source chip bg
 *   red-950 #450a0a   → tinted surface (dark)  — same roles
 *   #fca5a5 (red-300) → text/icon on dark, muted — accentMutedText dark, buttonLink dark
 *
 * FORBIDDEN:
 *   - red-400 as a fill (it exists ONLY for text/icon AA on dark)
 *   - red-600 as text on dark bg (fails AA on #0a0a0a)
 *   - any red on bubbleUser (the user's own utterance is neutral, not panic-tinted)
 *   - any red on the perf bar (perf is diagnostic, not alert)
 *
 * Chrome is warm-charcoal in dark (#0a0a0a / #171717 / #262626 / #404040)
 * and warm-neutral in light (neutral-100..300, tailwind 'stone' family).
 * No blue-purple navy. No cool-cast greys.
 *
 * Sunlight role rule (lightHC + darkHC), SUNLIGHT-1 / 11-DESIGN-BRIEF rev 6:
 *   - Same single red hue as light/dark; never a new hue family.
 *   - Body text (text, textSecondary, textMuted) at >=7:1 against background and surfaceMuted.
 *   - Border thickness becomes 2px via useBorderWidth() at the consumer (STYLE concern).
 *   - Accent shifts to red-700 (lightHC) / red-300 (darkHC) for AA at the chroma extremes.
 *   - Active-tab pill in Sunlight = NEUTRAL hard-contrast (black-on-white / white-on-black with
 *     2px inset outline). NEVER red. Red is reserved for the FAIL-LADDER severity rungs (11-09)
 *     and verification-action CTAs.
 *   - No tint on surfaceAccent under Sunlight; the 2px border carries the role.
 */
export const Colors = {
  light: {
    text: '#111827',
    background: '#f5f5f4',
    backgroundElement: '#ffffff',
    backgroundSelected: '#edf2f9',
    textSecondary: '#4b5563',
    textMuted: '#4b5563',
    border: '#e7e5e4',
    borderStrong: '#c2ccdb',
    surfaceMuted: '#f5f5f4',
    surfaceStrong: '#ffffff',
    surfaceAccent: '#fef2f2',
    surfaceInfo: '#fef2f2',
    surfaceWarning: '#fff4e8',
    surfaceSuccess: '#e8f8ee',
    accent: '#dc2626',
    accentStrong: '#b91c1c',
    accentText: '#ffffff',
    accentMutedText: '#b91c1c',
    warningText: '#9a3412',
    warningBorder: '#fdba74',
    successText: '#166534',
    successBorder: '#86efac',
    inputBackground: '#ffffff',
    inputBorder: '#cbd5e1',
    inputPlaceholder: '#6b7280',
    bubbleUser: '#f5f5f4',
    bubbleUserText: '#111827',
    bubbleUserBorder: '#e7e5e4',
    bubbleAssistant: '#ffffff',
    bubbleAssistantBorder: '#e7e5e4',
    buttonPrimary: '#dc2626',
    buttonSecondary: '#737373',
    buttonLink: '#b91c1c',
    buttonGhost: '#64748b',
    buttonText: '#ffffff',
    bannerBackground: '#fff1e8',
    bannerText: '#9a3412',
    mapDot: '#dc2626',
    toggleTrackOn: '#dc2626',
    toggleTrackOff: '#d6d3d1',
    toggleThumbOn: '#ffffff',
    toggleThumbOff: '#f8fafc',
  },
  dark: {
    text: '#f8fafc',
    background: '#0a0a0a',
    backgroundElement: '#171717',
    backgroundSelected: '#262626',
    textSecondary: '#a8a29e',
    textMuted: '#a8a29e',
    border: '#404040',
    borderStrong: '#334155',
    surfaceMuted: '#262626',
    surfaceStrong: '#131c31',
    surfaceAccent: '#450a0a',
    surfaceInfo: '#450a0a',
    surfaceWarning: '#3a2510',
    surfaceSuccess: '#14532d',
    accent: '#f87171',
    accentStrong: '#dc2626',
    accentText: '#ffffff',
    accentMutedText: '#fca5a5',
    warningText: '#fed7aa',
    warningBorder: '#b45309',
    successText: '#4ade80',
    successBorder: '#166534',
    inputBackground: '#171717',
    inputBorder: '#404040',
    inputPlaceholder: '#a8a29e',
    bubbleUser: '#262626',
    bubbleUserText: '#fafaf9',
    bubbleUserBorder: '#404040',
    bubbleAssistant: '#171717',
    bubbleAssistantBorder: '#404040',
    buttonPrimary: '#dc2626',
    buttonSecondary: '#525252',
    buttonLink: '#fca5a5',
    buttonGhost: '#475569',
    buttonText: '#ffffff',
    bannerBackground: '#7c2d12',
    bannerText: '#fcd34d',
    mapDot: '#f87171',
    toggleTrackOn: '#dc2626',
    toggleTrackOff: '#404040',
    toggleThumbOn: '#ffffff',
    toggleThumbOff: '#9ca3af',
  },
  lightHC: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#ffffff',
    backgroundSelected: '#ffffff',
    textSecondary: '#000000',
    textMuted: '#000000',
    border: '#000000',
    borderStrong: '#000000',
    surfaceMuted: '#ffffff',
    surfaceStrong: '#ffffff',
    surfaceAccent: '#ffffff',
    surfaceInfo: '#ffffff',
    surfaceWarning: '#ffffff',
    surfaceSuccess: '#ffffff',
    accent: '#b91c1c',
    accentStrong: '#7f1d1d',
    accentText: '#ffffff',
    accentMutedText: '#b91c1c',
    warningText: '#7c2d12',
    warningBorder: '#000000',
    successText: '#14532d',
    successBorder: '#000000',
    inputBackground: '#ffffff',
    inputBorder: '#000000',
    inputPlaceholder: '#000000',
    bubbleUser: '#ffffff',
    bubbleUserText: '#000000',
    bubbleUserBorder: '#000000',
    bubbleAssistant: '#ffffff',
    bubbleAssistantBorder: '#000000',
    buttonPrimary: '#b91c1c',
    buttonSecondary: '#000000',
    buttonLink: '#b91c1c',
    buttonGhost: '#000000',
    buttonText: '#ffffff',
    bannerBackground: '#ffffff',
    bannerText: '#000000',
    mapDot: '#b91c1c',
    toggleTrackOn: '#b91c1c',
    toggleTrackOff: '#000000',
    toggleThumbOn: '#ffffff',
    toggleThumbOff: '#ffffff',
  },
  darkHC: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#000000',
    backgroundSelected: '#000000',
    textSecondary: '#ffffff',
    textMuted: '#ffffff',
    border: '#ffffff',
    borderStrong: '#ffffff',
    surfaceMuted: '#000000',
    surfaceStrong: '#000000',
    surfaceAccent: '#000000',
    surfaceInfo: '#000000',
    surfaceWarning: '#000000',
    surfaceSuccess: '#000000',
    accent: '#fca5a5',
    accentStrong: '#fecaca',
    accentText: '#000000',
    accentMutedText: '#fca5a5',
    warningText: '#fed7aa',
    warningBorder: '#ffffff',
    successText: '#bbf7d0',
    successBorder: '#ffffff',
    inputBackground: '#000000',
    inputBorder: '#ffffff',
    inputPlaceholder: '#ffffff',
    bubbleUser: '#000000',
    bubbleUserText: '#ffffff',
    bubbleUserBorder: '#ffffff',
    bubbleAssistant: '#000000',
    bubbleAssistantBorder: '#ffffff',
    buttonPrimary: '#fca5a5',
    buttonSecondary: '#ffffff',
    buttonLink: '#fca5a5',
    buttonGhost: '#ffffff',
    buttonText: '#000000',
    bannerBackground: '#000000',
    bannerText: '#ffffff',
    mapDot: '#fca5a5',
    toggleTrackOn: '#fca5a5',
    toggleTrackOff: '#ffffff',
    toggleThumbOn: '#000000',
    toggleThumbOff: '#000000',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type AppTheme =
  | typeof Colors.light
  | typeof Colors.dark
  | typeof Colors.lightHC
  | typeof Colors.darkHC;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  /** Content rhythm under the native stack header. The header already absorbs
   *  the top safe-area inset, so screens push content with this tighter offset
   *  rather than re-adding `insets.top + N`. */
  headerOffset: 12,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
