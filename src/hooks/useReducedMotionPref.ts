/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Wraps AccessibilityInfo.isReduceMotionEnabled and subscribes to
// 'reduceMotionChanged'. Returns the current preference.
//
// Used by ReadinessChip shimmer gating (FAIL-LADDER-1) and the future
// SUNLIGHT-1 auto-switch dialog. See 11-DESIGN-BRIEF rev 6 section 11.
export function useReducedMotionPref(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!cancelled) setEnabled(value);
      })
      .catch(() => {
        // Best-effort; default false.
      });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setEnabled(value);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return enabled;
}
