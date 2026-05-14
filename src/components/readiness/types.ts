/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type ReadinessState =
  | { kind: 'no-model' }
  | { kind: 'model-loading'; modelName: string; progressPct?: number }
  | { kind: 'model-loaded-no-pack'; modelName: string }
  | { kind: 'pack-loading'; packName: string }
  | {
      kind: 'ready-idle';
      modelName: string;
      packCount: number;
      languages: string[];
      freshness: 'static' | 'time-sensitive';
    }
  | { kind: 'ready-streaming'; ttftMs: number | null; tokps: number | null };

export type SeverityRung = 'none' | 'warn' | 'error' | 'critical';

export type RefusalKind =
  | { kind: 'no-coverage'; toggleOn: boolean; closestExists: boolean }
  | { kind: 'maps-gap' }
  | { kind: 'pack-language-gap'; requestedLanguage: string; activeLanguages: string[] }
  | { kind: 'model-not-loaded' }
  | { kind: 'geo-handoff'; gpsUnavailable: boolean };

export interface ReadinessSnapshot {
  state: ReadinessState;
  rung: SeverityRung;
}
