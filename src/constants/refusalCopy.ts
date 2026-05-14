/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
// Language list in pack-language-gap is data-driven by design; brief section 8's literal "EN, ZH, AR" is illustrative. Runtime interpolation reads activeLanguages.join(', ') from the live store.
import i18next from 'i18next';
import type { RefusalKind } from '@/components/readiness/types';

// Refusal copy is resolved through i18next.t() at call time so the surface
// honours the user's selected locale. Voice law (11-DESIGN-BRIEF rev 6
// section 8): no em-dashes anywhere; use commas, colons, periods, parentheses.

export interface RefusalText {
  body: string;
  subBody?: string;
}

// Cast through unknown: refusal keys exist at runtime in the errors namespace
// bundle but our strict-typed i18next.t signature only knows the top-level
// generic key list.
const tErr = (key: string, opts?: Record<string, unknown>) =>
  (i18next.t as unknown as (k: string, o?: Record<string, unknown>) => string)(
    `errors:${key}`,
    opts,
  );

export function REFUSAL_COPY(kind: RefusalKind): RefusalText {
  switch (kind.kind) {
    case 'no-coverage': {
      // OfflineAid is offline by design. The honest refusal when retrieval
      // returns zero chunks is "no pack covers this", not "this needs live
      // data" -- the user already knows the device is offline. Toggle-ON
      // path appends the same closest-match subBody so users can opt into
      // a paraphrased best-guess when their packs do have something
      // tangentially relevant.
      const body = tErr('no_coverage');
      if (kind.toggleOn && kind.closestExists) {
        return { body, subBody: tErr('no_coverage_with_closest') };
      }
      return { body };
    }
    case 'maps-gap':
      return { body: tErr('maps_gap') };
    case 'pack-language-gap': {
      const active = kind.activeLanguages.join(', ');
      return {
        body: tErr('pack_language_gap', {
          language: kind.requestedLanguage,
          languages: active,
        }),
      };
    }
    case 'model-not-loaded':
      return { body: tErr('model_not_loaded') };
    case 'geo-handoff': {
      if (kind.gpsUnavailable) {
        return {
          body: tErr('maps_gap'),
          subBody: tErr('geo_gps_unavailable'),
        };
      }
      return { body: tErr('maps_gap') };
    }
  }
}
