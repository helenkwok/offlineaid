/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * Pack service — expo-sqlite FTS5 queries over offline knowledge packs.
 *
 * The .db contract (from offlineaid-pack-builder):
 *   Required: chunks + fts_chunks (FTS5 content-synced) + pack_metadata
 *   Optional: chunk_vectors + geo_points + layers
 */
import * as SQLite from 'expo-sqlite';

const packDbCache = new Map<string, Promise<SQLite.SQLiteDatabase>>();

export interface PackMetadata {
  id: string;
  name: string;
  version: string;
  country: string;
  scenario: string;
  chunks: number;
  sizeBytes: number;
  dbPath: string;
  hasVectors: boolean;
  vectorMethod?: string;
  vectorDimensions?: number;
}

export interface SearchResult {
  chunkId: number;
  source: string;
  text: string;
  data: Record<string, unknown>;
  snippet: string;
}

export interface GeoResult {
  name: string;
  nameLocal?: string;
  lat: number;
  lon: number;
  category: string;
  address?: string;
  metadata?: Record<string, unknown>;
}

export interface PackLayer {
  name: string;
  tier: string;
  description: string;
  row_count: number;
  // Provenance columns (nullable — packs built before 0.4.0 will have null)
  publisher: string | null;
  license: string | null;
  source_url: string | null;
  reviewed_at: string | null;
  cultural_sensitivity: string | null;
  expires_at: string | null;
  language: string | null;
}

async function getPackDb(dbPath: string): Promise<SQLite.SQLiteDatabase> {
  let cached = packDbCache.get(dbPath);
  if (!cached) {
    cached = SQLite.openDatabaseAsync(dbPath);
    packDbCache.set(dbPath, cached);
  }
  return cached;
}

export async function closePackDatabase(dbPath: string): Promise<void> {
  const cached = packDbCache.get(dbPath);
  packDbCache.delete(dbPath);
  if (!cached) return;

  try {
    const db = await cached;
    await db.closeAsync();
  } catch {
    // Best-effort cleanup only.
  }
}

/** Read pack_metadata from a .db file and return PackMetadata. */
export async function readPackMetadata(dbPath: string): Promise<PackMetadata | null> {
  try {
    const db = await getPackDb(dbPath);

    // Verify required schema
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('chunks', 'fts_chunks', 'pack_metadata')"
    );
    const tableNames = new Set(tables.map((t) => t.name));
    if (!tableNames.has('chunks') || !tableNames.has('fts_chunks') || !tableNames.has('pack_metadata')) {
      return null;
    }

    const rows = await db.getAllAsync<{ key: string; value: string }>(
      'SELECT key, value FROM pack_metadata'
    );

    const meta: Record<string, string> = {};
    for (const row of rows) meta[row.key] = row.value;

    const chunks = await getChunkCount(dbPath);

    return {
      id: dbPath,
      name: meta.name ?? 'Unknown pack',
      version: meta.version ?? '1.0.0',
      country: meta.country ?? '',
      scenario: meta.scenario ?? '',
      chunks,
      sizeBytes: 0, // filled by caller from filesystem metadata
      dbPath,
      hasVectors: meta.has_vectors === 'true',
      vectorMethod: meta.vector_method,
      vectorDimensions: meta.vector_dimensions ? parseInt(meta.vector_dimensions) : undefined,
    };
  } catch {
    return null;
  }
}

async function getChunkCount(dbPath: string): Promise<number> {
  try {
    const db = await getPackDb(dbPath);
    const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM chunks');
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

/** FTS5 full-text search. Returns top-k matching chunks with snippets. */
export async function searchPack(
  dbPath: string,
  query: string,
  limit = 10,
  layer?: string
): Promise<SearchResult[]> {
  const db = await getPackDb(dbPath);

  try {
    let sql = `
      SELECT c.id as chunkId, c.source, c.text, c.data,
             highlight(fts_chunks, 0, '**', '**') as snippet
      FROM fts_chunks f
      JOIN chunks c ON c.id = f.rowid
      WHERE fts_chunks MATCH ?
    `;
    const params: SQLite.SQLiteBindValue[] = [sanitiseFtsQuery(query)];

    if (layer) {
      sql += ' AND c.source = ?';
      params.push(layer);
    }
    sql += ` LIMIT ${limit}`;

    const rows = await db.getAllAsync<{
      chunkId: number;
      source: string;
      text: string;
      data: string;
      snippet: string;
    }>(sql, params);

    // Always surface zero-hit + the sanitised query under tag ReactNativeJS
    // (release routes console.log → logcat). Helps diagnose CJK/RTL retrieval
    // gaps that don't fire any error.
    if (rows.length === 0) {
      // eslint-disable-next-line no-console
      console.log(
        'OFFLINEAID_FTS_DIAG ' +
          JSON.stringify({
            kind: 'zero-hit',
            originalQuery: query,
            sanitisedQuery: sanitiseFtsQuery(query),
            packId: dbPath,
          })
      );
    }

    return rows.map((r) => ({
      chunkId: r.chunkId,
      source: r.source,
      text: r.text,
      data: r.data ? JSON.parse(r.data) : {},
      snippet: r.snippet,
    }));
  } catch (err) {
    // Surface the actual error so on-device FTS5 failures don't disappear.
    // eslint-disable-next-line no-console
    console.log(
      'OFFLINEAID_FTS_DIAG ' +
        JSON.stringify({
          kind: 'exception',
          originalQuery: query,
          sanitisedQuery: sanitiseFtsQuery(query),
          packId: dbPath,
          error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        })
    );
    return [];
  }
}

/** Query geo_points within a bounding box. */
export async function queryGeoPack(
  dbPath: string,
  south: number,
  north: number,
  west: number,
  east: number,
  category?: string,
  limit = 50
): Promise<GeoResult[]> {
  const db = await getPackDb(dbPath);

  try {
    let sql = `
      SELECT name, name_local, lat, lon, category, address, metadata
      FROM geo_points
      WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?
    `;
    const params: SQLite.SQLiteBindValue[] = [south, north, west, east];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    sql += ` LIMIT ${limit}`;

    const rows = await db.getAllAsync<{
      name: string;
      name_local: string | null;
      lat: number;
      lon: number;
      category: string;
      address: string | null;
      metadata: string | null;
    }>(sql, params);

    return rows.map((r) => ({
      name: r.name,
      nameLocal: r.name_local ?? undefined,
      lat: r.lat,
      lon: r.lon,
      category: r.category,
      address: r.address ?? undefined,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    }));
  } catch {
    return [];
  }
}

/** Search geo_points by name/address/category text. */
export async function searchGeoPoints(
  dbPath: string,
  query: string,
  limit = 10
): Promise<GeoResult[]> {
  const db = await getPackDb(dbPath);
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const terms = normalizedQuery
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) {
    return [];
  }

  try {
    const matchClauses = terms
      .map(
        () =>
          `(lower(name) LIKE ? OR lower(coalesce(name_local, '')) LIKE ? OR ` +
          `lower(coalesce(address, '')) LIKE ? OR lower(category) LIKE ? OR ` +
          `lower(coalesce(metadata, '')) LIKE ?)`
      )
      .join(' AND ');

    const pattern = `%${normalizedQuery}%`;
    const params: SQLite.SQLiteBindValue[] = [
      normalizedQuery,
      normalizedQuery,
      pattern,
      pattern,
      pattern,
    ];

    for (const term of terms) {
      const like = `%${term}%`;
      params.push(like, like, like, like, like);
    }

    const rows = await db.getAllAsync<{
      name: string;
      name_local: string | null;
      lat: number;
      lon: number;
      category: string;
      address: string | null;
      metadata: string | null;
    }>(
      `
        SELECT name, name_local, lat, lon, category, address, metadata
        FROM geo_points
        WHERE ${matchClauses}
        ORDER BY
          CASE
            WHEN lower(name) = ? THEN 0
            WHEN lower(coalesce(name_local, '')) = ? THEN 1
            WHEN lower(name) LIKE ? THEN 2
            WHEN lower(coalesce(address, '')) LIKE ? THEN 3
            WHEN lower(category) LIKE ? THEN 4
            ELSE 5
          END,
          name COLLATE NOCASE ASC
        LIMIT ${limit}
      `,
      [...params.slice(5), ...params.slice(0, 5)]
    );

    return rows.map((r) => ({
      name: r.name,
      nameLocal: r.name_local ?? undefined,
      lat: r.lat,
      lon: r.lon,
      category: r.category,
      address: r.address ?? undefined,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    }));
  } catch {
    return [];
  }
}

/** List geo_points by category for map-focused browse requests. */
export async function listGeoPointsByCategory(
  dbPath: string,
  category: string,
  limit = 25
): Promise<GeoResult[]> {
  const db = await getPackDb(dbPath);
  const normalizedCategory = category.trim().toLowerCase();
  if (!normalizedCategory) {
    return [];
  }

  try {
    const rows = await db.getAllAsync<{
      name: string;
      name_local: string | null;
      lat: number;
      lon: number;
      category: string;
      address: string | null;
      metadata: string | null;
    }>(
      `
        SELECT name, name_local, lat, lon, category, address, metadata
        FROM geo_points
        WHERE lower(category) = ?
        ORDER BY name COLLATE NOCASE ASC
        LIMIT ${limit}
      `,
      [normalizedCategory]
    );

    return rows.map((r) => ({
      name: r.name,
      nameLocal: r.name_local ?? undefined,
      lat: r.lat,
      lon: r.lon,
      category: r.category,
      address: r.address ?? undefined,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    }));
  } catch {
    return [];
  }
}

export async function readPackLayers(
  dbPath: string
): Promise<PackLayer[]> {
  try {
    const db = await getPackDb(dbPath);
    return await db.getAllAsync<PackLayer>(
      `SELECT name, tier, description, row_count,
              publisher, license, source_url, reviewed_at,
              cultural_sensitivity, expires_at, language
         FROM layers ORDER BY name`
    );
  } catch {
    return [];
  }
}

/**
 * Sanitise a natural language query for FTS5 (default unicode61 tokenizer).
 * Strategy (D-FTS-3):
 *   - Strip FTS5 metacharacters: ' " * ^ ( )
 *   - ASCII whitespace tokens → OR-joined prefix terms: `(banking* OR info*)`
 *   - Non-ASCII no-whitespace runs (CJK / RTL) → per-grapheme prefix OR via
 *     Intl.Segmenter('und', { granularity: 'grapheme' }) (Hermes ships Intl.Segmenter on RN ≥0.75).
 *   - Mixed queries → union of both transforms inside a single (...).
 *   - Empty / metachar-only input → empty string (caller treats as no-op).
 */
export function sanitiseFtsQuery(q: string): string {
  // Strip ALL non-word non-whitespace characters (matches Python parity per
  // .planning anti-pattern naive-sanitiser-leaves-punctuation: `?`, `.`,
  // `,`, `;`, etc. left attached to terms produce FTS5 syntax errors that
  // searchPack silently swallows in release builds, returning 0 results).
  const stripped = q.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (!stripped) return '';

  const terms: string[] = [];
  // ASCII-whitespace tokens (covers Latin-script + Arabic-with-spaces).
  for (const t of stripped.split(/\s+/).filter(Boolean)) {
    // Words that contain non-ASCII chars get grapheme-split below; ASCII words go straight in.
    if (/^[\x00-\x7F]+$/.test(t)) {
      terms.push(`${t}*`);
    } else {
      // Non-ASCII run: per-grapheme prefix. Hermes release builds may lack
      // Intl.Segmenter (despite RN docs claim) — `new Intl.Segmenter(...)`
      // throws "Cannot read property 'prototype' of undefined". Fall back to
      // Array.from(...) which iterates code points — BMP chars (incl. all CJK
      // and Arabic) become individual elements; astral-plane emojis get split
      // into surrogate halves but those don't appear in eval prompts.
      type SegmenterLike = (s: string) => string[];
      const segmentString: SegmenterLike =
        typeof Intl !== 'undefined' &&
        typeof (Intl as unknown as { Segmenter?: unknown }).Segmenter === 'function'
          ? (s) => {
              const seg = new Intl.Segmenter('und', { granularity: 'grapheme' });
              return Array.from(seg.segment(s), (x) => x.segment);
            }
          : (s) => Array.from(s);
      for (const g of segmentString(t)) {
        const trimmed = g.trim();
        if (trimmed) terms.push(`${trimmed}*`);
      }
    }
  }

  if (terms.length === 0) return '';
  // Dedupe while preserving order.
  const seen = new Set<string>();
  const unique = terms.filter((t) => (seen.has(t) ? false : (seen.add(t), true)));
  return unique.length === 1 ? unique[0] : `(${unique.join(' OR ')})`;
}
