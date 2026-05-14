/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

// SUNLIGHT-1 / 11-DESIGN-BRIEF rev 6 section 3 + section 7.
//
// Wraps the platform high-contrast preference and subscribes to changes.
//   Android: AccessibilityInfo.isHighTextContrastEnabled + 'highTextContrastChanged'
//   iOS:     AccessibilityInfo.isDarkerSystemColorsEnabled + 'darkerSystemColorsChanged'
//   Web/other: returns false (no equivalent stable API on the RN web surface).
//
// Returns boolean. Initial value resolved imperatively on mount to avoid a
// first-render flicker between false and the true platform value.
//
// Used as the OS-pref half of the trigger union (osHighContrast || sunlightMode)
// in useTheme; the OS preference always wins via short-circuit, so the in-app
// Sunlight Mode toggle CANNOT disable a true OS preference.
export function useOsHighContrast(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return;
    }

    let cancelled = false;

    const getter =
      Platform.OS === 'android'
        ? AccessibilityInfo.isHighTextContrastEnabled
        : AccessibilityInfo.isDarkerSystemColorsEnabled;
    const eventName: 'highTextContrastChanged' | 'darkerSystemColorsChanged' =
      Platform.OS === 'android' ? 'highTextContrastChanged' : 'darkerSystemColorsChanged';

    if (typeof getter === 'function') {
      getter
        .call(AccessibilityInfo)
        .then((value) => {
          if (!cancelled) setEnabled(value);
        })
        .catch(() => {
          // Best-effort; default false.
        });
    }

    const sub = AccessibilityInfo.addEventListener(eventName, (value) => {
      setEnabled(value);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return enabled;
}
