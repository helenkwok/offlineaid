/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 *
 * SUNLIGHT-1 / 11-DESIGN-BRIEF rev 6 section 3 + section 7.
 *
 * Central palette resolver. Returns Colors[scheme + (hc ? 'HC' : '')] where
 *   hc = osHighContrast || sunlightMode
 *
 * The OS high-contrast preference always wins via short-circuit, so the
 * in-app Sunlight Mode toggle CANNOT disable a true OS setting. This is a
 * hard invariant from brief section 3 (OS preference always wins) and is
 * verified by the conditional banner on Settings > Display.
 */

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useOsHighContrast } from "@/hooks/useOsHighContrast";
import { usePreferencesStore } from "@/store";

export function useTheme() {
  const scheme = useColorScheme();
  const base = !scheme || scheme === 'unspecified' ? 'light' : scheme;
  const sunlightMode = usePreferencesStore((s) => s.sunlightMode);
  const osHighContrast = useOsHighContrast();
  const hc = osHighContrast || sunlightMode;
  const key = hc ? (`${base}HC` as const) : base;

  return Colors[key];
}
