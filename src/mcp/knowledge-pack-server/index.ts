/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * knowledge-pack-server — on-device MCP server.
 *
 * Exposes three tools to Gemma 4 via native function calling:
 *   search_pack   — FTS5 full-text search across active packs
 *   find_nearby   — geo_points query by lat/lon + radius + category
 *   list_packs    — enumerate active packs and their layers
 *
 * The server is in-process (no network socket). The LLM provider calls
 * executeTool() after parsing a tool-call token from the model output.
 *
 * Pack DB contract (from offlineaid-pack-builder):
 *   Required: chunks, fts_chunks (FTS5), pack_metadata
 *   Optional: geo_points, layers, chunk_vectors
 */

import { searchPack, queryGeoPack, readPackLayers } from '@/services/pack';
import type { PackMetadata, SearchResult, GeoResult, PackLayer } from '@/services/pack';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** MCP-compatible tool definition (JSON Schema input). */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** Runtime context injected at call time. */
export interface PackServerContext {
  activePacks: PackMetadata[];
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const KNOWLEDGE_PACK_TOOLS: MCPTool[] = [
  {
    name: 'search_pack',
    description:
      'Search offline knowledge packs for information about emergency procedures, ' +
      'hospitals, shelters, contacts, transport policies, typhoon signals, ' +
      'emergency phrases, or any local crisis guidance. ' +
      'Use for text-based questions. Results include source layer and highlighted snippet.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query. Can be in any language.',
        },
        layer: {
          type: 'string',
          description:
            'Optional: restrict search to one data layer. ' +
            'Use list_packs first to discover available layer names. ' +
            'Examples: "hospitals", "emergency_contacts", "typhoon_signals", "emergency_phrases".',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return. Default 5, maximum 20.',
        },
      },
      required: ['query'],
    },
  },

  {
    name: 'find_nearby',
    description:
      'Find nearby places from offline geo data. ' +
      'Returns hospitals, shelters, embassies, pharmacies, clinics, and fuel stations ' +
      'sorted by distance from the given location. ' +
      'Only returns results if the active pack includes geo_points for this region.',
    inputSchema: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: 'Current latitude (decimal degrees).' },
        lon: { type: 'number', description: 'Current longitude (decimal degrees).' },
        category: {
          type: 'string',
          description:
            'Filter by place type. Common values: ' +
            '"hospital", "clinic", "shelter", "embassy", "pharmacy", "fuel", "police".',
        },
        radius_km: {
          type: 'number',
          description: 'Search radius in kilometres. Default 5.',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return. Default 10.',
        },
      },
      required: ['lat', 'lon'],
    },
  },

  {
    name: 'list_packs',
    description:
      'List all active offline knowledge packs and their data layers. ' +
      'Call this first to discover what information is available before searching.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Tool executor — entry point called by the LLM provider after a tool call
// ---------------------------------------------------------------------------

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: PackServerContext
): Promise<string> {
  try {
    if (ctx.activePacks.length === 0) {
      return 'No knowledge packs are active. Ask the user to enable a pack from the Packs tab.';
    }

    switch (name) {
      case 'search_pack':
        return executeSearchPack(input, ctx);
      case 'find_nearby':
        return executeFindNearby(input, ctx);
      case 'list_packs':
        return executeListPacks(ctx);
      default:
        return `Unknown tool: "${name}". Available tools: search_pack, find_nearby, list_packs.`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Tool error (${name}): ${msg}`;
  }
}

// ---------------------------------------------------------------------------
// search_pack
// ---------------------------------------------------------------------------

async function executeSearchPack(
  input: Record<string, unknown>,
  ctx: PackServerContext
): Promise<string> {
  const query = String(input.query ?? '').trim();
  if (!query) return 'search_pack: query is required.';

  const layer = input.layer ? String(input.layer) : undefined;
  const limit = clamp(Number(input.limit ?? 5), 1, 20);

  const allResults: (SearchResult & { packName: string })[] = [];

  for (const pack of ctx.activePacks) {
    const results = await searchPack(pack.dbPath, query, limit, layer);
    for (const r of results) {
      allResults.push({ ...r, packName: pack.name });
    }
  }

  if (allResults.length === 0) {
    return `No results found for "${query}"${layer ? ` in layer "${layer}"` : ''}.`;
  }

  const lines: string[] = [`Found ${allResults.length} result(s) for "${query}":\n`];

  for (const [i, r] of allResults.entries()) {
    lines.push(
      `[${i + 1}] Source: ${r.packName} / ${r.source}` +
        (r.chunkId ? ` (chunk ${r.chunkId})` : '') +
        '\n' +
        r.text +
        '\n'
    );
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// find_nearby
// ---------------------------------------------------------------------------

async function executeFindNearby(
  input: Record<string, unknown>,
  ctx: PackServerContext
): Promise<string> {
  const lat = Number(input.lat);
  const lon = Number(input.lon);

  if (isNaN(lat) || isNaN(lon)) return 'find_nearby: lat and lon must be numbers.';

  const radiusKm = clamp(Number(input.radius_km ?? 5), 0.1, 100);
  const category = input.category ? String(input.category) : undefined;
  const limit = clamp(Number(input.limit ?? 10), 1, 50);

  const deltaLat = radiusKm / 111.0;
  const deltaLon = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));

  const south = lat - deltaLat;
  const north = lat + deltaLat;
  const west = lon - deltaLon;
  const east = lon + deltaLon;

  const allPlaces: (GeoResult & { packName: string; distKm: number })[] = [];

  for (const pack of ctx.activePacks) {
    const results = await queryGeoPack(pack.dbPath, south, north, west, east, category, limit);
    for (const r of results) {
      allPlaces.push({
        ...r,
        packName: pack.name,
        distKm: haversineKm(lat, lon, r.lat, r.lon),
      });
    }
  }

  if (allPlaces.length === 0) {
    return (
      `No places found within ${radiusKm} km` +
      (category ? ` of category "${category}"` : '') +
      '. The active pack may not include geo data for this region.'
    );
  }

  allPlaces.sort((a, b) => a.distKm - b.distKm);
  const top = allPlaces.slice(0, limit);

  const lines: string[] = [
    `Found ${top.length} place(s) within ${radiusKm} km` +
      (category ? ` (${category})` : '') +
      ':\n',
  ];

  for (const [i, p] of top.entries()) {
    const name = p.nameLocal ? `${p.name} (${p.nameLocal})` : p.name;
    const dist = p.distKm < 1 ? `${Math.round(p.distKm * 1000)} m` : `${p.distKm.toFixed(1)} km`;
    const addr = p.address ?? '';
    const meta = p.metadata ? formatMeta(p.metadata) : '';
    lines.push(
      `[${i + 1}] ${name} — ${p.category} — ${dist}\n` +
        (addr ? `    Address: ${addr}\n` : '') +
        (meta ? `    ${meta}\n` : '')
    );
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// list_packs
// ---------------------------------------------------------------------------

async function executeListPacks(ctx: PackServerContext): Promise<string> {
  const lines: string[] = [`Active packs (${ctx.activePacks.length}):\n`];

  for (const pack of ctx.activePacks) {
    lines.push(`Pack: ${pack.name} (${pack.country}) — ${pack.chunks} chunks`);
    lines.push(`  Scenario: ${pack.scenario}`);

    const layers = await readLayers(pack.dbPath);
    if (layers.length > 0) {
      lines.push('  Layers:');
      for (const l of layers) {
        lines.push(`    - ${l.name} (${l.tier}): ${l.description} [${l.row_count} rows]`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readLayers(dbPath: string): Promise<LayerRow[]> {
  return readPackLayers(dbPath);
}

type LayerRow = PackLayer;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(isNaN(n) ? min : n, min), max);
}

function formatMeta(meta: Record<string, unknown>): string {
  return Object.entries(meta)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}
