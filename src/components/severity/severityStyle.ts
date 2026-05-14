/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import type { SeverityRung } from '@/components/readiness/types';

// Pure mapping rung -> presentation primitives. Theme application happens at
// the consumer (chip / refusal block / etc). Per brief 11-DESIGN-BRIEF rev 6
// section 6, rungs differentiate by weight + border + leading icon + tracking
// + density, NOT by introducing new theme color tokens.
//
// `leadingIcon` is a SEMANTIC key. Consumers map:
//   'none'     -> no glyph
//   'warn'     -> 'exclamationmark.circle' (default — brief section 6 line 55
//                 explicitly rejects the exclamation-in-triangle cliche; the
//                 round outline glyph is the field-app norm)
//   'critical' -> 'xmark.octagon.fill'
// The 'exclamationmark.triangle' variant is escalation-only and is not the
// default for any rung.

export interface SeverityPrimitives {
  fontWeight: '400' | '600';
  borderWidth: number;
  leadingIcon: 'none' | 'warn' | 'critical';
  letterSpacing: number;
  paddingV: number;
  paddingH: number;
}

// SUNLIGHT-1 note: the function stays pure (no theme dependency). Under Sunlight,
// consumers amplify the rendered border by reading useBorderWidth() at the call
// site (1 -> 2px). The returned `borderWidth` here is the LADDER-level contrast
// (0 / 1 / 1.5 / 2); the consumer effectively renders
// Math.max(severityStyle(rung).borderWidth, useBorderWidth()) to keep both invariants.
export function severityStyle(rung: SeverityRung): SeverityPrimitives {
  switch (rung) {
    case 'none':
      return { fontWeight: '400', borderWidth: 0, leadingIcon: 'none', letterSpacing: 0, paddingV: 6, paddingH: 10 };
    case 'warn':
      return { fontWeight: '400', borderWidth: 1, leadingIcon: 'none', letterSpacing: 0, paddingV: 6, paddingH: 10 };
    case 'error':
      return { fontWeight: '600', borderWidth: 1.5, leadingIcon: 'warn', letterSpacing: 0.1, paddingV: 8, paddingH: 12 };
    case 'critical':
      // letterSpacing dropped from 0.15 -> 0.05: the 0.15 value caused glyph
      // ink (semibold weight) to extend past measured advance widths on
      // Pixel 7 / Hermes, clipping the chip's right edge. Critical remains
      // distinguishable via fill + borderWidth + weight; tracking is now a
      // subtle accent rather than the main differentiator.
      return { fontWeight: '600', borderWidth: 2, leadingIcon: 'critical', letterSpacing: 0.05, paddingV: 10, paddingH: 14 };
  }
}
