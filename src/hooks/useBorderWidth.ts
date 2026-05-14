/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { useOsHighContrast } from '@/hooks/useOsHighContrast';
import { usePreferencesStore } from '@/store';

// SUNLIGHT-1 / 11-DESIGN-BRIEF rev 6 section 3 ("thicker borders").
//
// Style-layer thickness helper. Returns 1 in normal palettes, 2 under
// HC/Sunlight (osHighContrast || sunlightMode). Single hook call per consumer:
//
//   const borderWidth = useBorderWidth();
//   const styles = StyleSheet.create({ card: { borderWidth, borderColor: theme.border } });
//
// FAIL-LADDER consumers that already use severityStyle(rung).borderWidth wrap
// with Math.max(severityStyle(rung).borderWidth, useBorderWidth()) so the rung
// delta still reads under amplified chroma. severityStyle.ts itself stays pure.
export function useBorderWidth(): 1 | 2 {
  const sunlightMode = usePreferencesStore((s) => s.sunlightMode);
  const osHighContrast = useOsHighContrast();
  const hc = osHighContrast || sunlightMode;
  return hc ? 2 : 1;
}
