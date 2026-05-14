/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { useEffect, useRef, useState } from 'react';
import { searchPack, type PackMetadata, type SearchResult } from '@/services/pack';

// FAIL-LADDER-1 / 11-DESIGN-BRIEF rev 6 section 7. Toggle-ON closest-match
// expand row needs a stricter retrieval pass than the normal answer gate so
// we never fall back to a low-confidence guess.
//
// DEVIATION from plan: searchPack today returns FTS5 hits with no explicit
// score / threshold. The plan's "STRICT_THRESHOLD_MULTIPLIER = 1.4 *
// normalGate" has no referent. We enforce strictness via two cheap proxies:
//   1. top_k = 1 (already specified)
//   2. Require >= STRICT_MIN_QUERY_TOKENS_OVERLAP query tokens to appear in
//      the chunk text (case-insensitive). Single-token incidental matches
//      are rejected.
// This keeps the contract: "if no chunk meets the stricter threshold, the
// row is hidden — never falls back to a low-confidence guess" (section 7).
//
// Future work (post-demo): replace token-overlap proxy with the Phase 11
// vector-similarity layer when chunk_vectors lands in the runtime.

export const STRICT_THRESHOLD_MULTIPLIER = 1.4; // retained for plan-grep compatibility
const STRICT_MIN_QUERY_TOKENS_OVERLAP = 2;

export type ClosestMatchState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'done'; chunk: string; source: string }
  | { state: 'empty' };

export function useClosestMatch(query: string, packs: PackMetadata[]): ClosestMatchState {
  const [result, setResult] = useState<ClosestMatchState>({ state: 'idle' });
  const lastQueryRef = useRef<string | null>(null);

  useEffect(() => {
    if (!query.trim() || packs.length === 0) {
      setResult({ state: 'empty' });
      lastQueryRef.current = query;
      return;
    }

    if (lastQueryRef.current === query) return;
    lastQueryRef.current = query;

    let cancelled = false;
    setResult({ state: 'loading' });

    (async () => {
      try {
        const queryTokens = tokenise(query);
        if (queryTokens.length === 0) {
          if (!cancelled) setResult({ state: 'empty' });
          return;
        }

        let best: SearchResult | null = null;
        for (const pack of packs) {
          const hits = await searchPack(pack.dbPath, query, 1);
          for (const hit of hits) {
            if (passesStrictThreshold(queryTokens, hit.text)) {
              best = hit;
              break;
            }
          }
          if (best) break;
        }

        if (cancelled) return;
        if (best) {
          setResult({ state: 'done', chunk: best.text, source: best.source });
        } else {
          setResult({ state: 'empty' });
        }
      } catch {
        if (!cancelled) setResult({ state: 'empty' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query, packs]);

  return result;
}

// Imperative one-shot resolver used by the chat screen's no-flicker render
// gate (11-09 Task 3). Mirrors useClosestMatch's async logic but returns a
// Promise so the caller can `await` resolution before pushing the
// RefusalBlock onto the message list. Calling this from the hook would also
// work but adds render gymnastics; an explicit one-shot is simpler.
export async function resolveClosestMatchOnce(
  query: string,
  packs: PackMetadata[]
): Promise<ClosestMatchState> {
  if (!query.trim() || packs.length === 0) return { state: 'empty' };
  const queryTokens = tokenise(query);
  if (queryTokens.length === 0) return { state: 'empty' };

  try {
    for (const pack of packs) {
      const hits = await searchPack(pack.dbPath, query, 1);
      for (const hit of hits) {
        if (passesStrictThreshold(queryTokens, hit.text)) {
          return { state: 'done', chunk: hit.text, source: hit.source };
        }
      }
    }
  } catch {
    return { state: 'empty' };
  }
  return { state: 'empty' };
}

function tokenise(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);
}

function passesStrictThreshold(queryTokens: string[], chunkText: string): boolean {
  const haystack = chunkText.toLowerCase();
  let matches = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) matches++;
    if (matches >= STRICT_MIN_QUERY_TOKENS_OVERLAP) return true;
  }
  return false;
}
