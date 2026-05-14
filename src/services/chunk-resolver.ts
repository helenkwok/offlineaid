/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * Phase 11 TAP-1 — resolve a sourceKey produced by buildContext to a chunk row.
 *
 * sourceKey shape: `${packId}:${source}:${chunkId}` (D-PASS-3 / TAP-1 contract).
 *
 * The lookup runs against the existing `chunks` table (id INTEGER PRIMARY KEY
 * + source TEXT + text TEXT) — the same data the FTS5 search above feeds from.
 * No new schema is introduced.
 */
import * as SQLite from 'expo-sqlite';

import { usePackStore } from '@/store/pack-store';

export interface ChunkRow {
  filename: string;
  preview: string;
  full: string;
}

/** Parse a sourceKey of the form `${packId}:${source}:${chunkId}`. */
function parseSourceKey(key: string): { packId: string; source: string; chunkId: number } | null {
  const firstColon = key.indexOf(':');
  const lastColon = key.lastIndexOf(':');
  if (firstColon < 0 || lastColon <= firstColon) {
    return null;
  }
  const packId = key.slice(0, firstColon);
  const source = key.slice(firstColon + 1, lastColon);
  const chunkIdRaw = key.slice(lastColon + 1);
  const chunkId = Number.parseInt(chunkIdRaw, 10);
  if (!packId || !source || !Number.isFinite(chunkId)) {
    return null;
  }
  return { packId, source, chunkId };
}

function resolveDbPath(packId: string): string | undefined {
  const { availablePacks, activePacks } = usePackStore.getState();
  return (
    availablePacks.find((p) => p.id === packId)?.dbPath ??
    activePacks.find((p) => p.id === packId)?.dbPath
  );
}

export async function loadChunkByKey(key: string): Promise<ChunkRow | null> {
  const parsed = parseSourceKey(key);
  if (!parsed) return null;

  const dbPath = resolveDbPath(parsed.packId);
  if (!dbPath) return null;

  const db = await SQLite.openDatabaseAsync(dbPath);
  try {
    const rows = await db.getAllAsync<{ source: string; text: string }>(
      'SELECT source, text FROM chunks WHERE id = ? AND source = ? LIMIT 1',
      [parsed.chunkId, parsed.source],
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      filename: row.source,
      preview: row.text.slice(0, 140),
      full: row.text,
    };
  } finally {
    await db.closeAsync();
  }
}
