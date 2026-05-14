/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * FAIL-LADDER-1 (11-09 Task 3 follow-up): airplane-mode + stale-GPS detection.
 *
 * Used by the chat coverage-gap classifier to decide whether the geo-handoff
 * refusal should include the "GPS unavailable in airplane mode. Re-enable
 * location, then ask again." amendment.
 *
 * Signal sources:
 *   - `Network.isAirplaneModeEnabledAsync()` (Android, discrete signal)
 *   - `Network.getNetworkStateAsync().isInternetReachable` (cross-platform
 *     fallback; Android 14 collapses airplane mode into this)
 *   - `Location.getLastKnownPositionAsync()` timestamp (stale-fix proxy)
 *
 * Rule: gpsUnavailable === true iff (airplaneMode || !isInternetReachable)
 * AND no recent (<60s) GPS fix.
 *
 * Permission policy:
 *   We DO NOT request foreground location permission here. The first geo-
 *   handoff query proper (when the user later taps "Open Maps" / similar)
 *   will trigger the permission prompt. `getLastKnownPositionAsync` returns
 *   null without throwing if permission has not been granted, which is the
 *   correct behaviour for our signal: missing permission == no recent fix.
 *
 * Resilience:
 *   Native modules can throw (web, dev-client mismatch, permission edge
 *   cases). All calls are wrapped in try/catch and degrade to
 *   `gpsUnavailable: false` so the maps-gap body still renders without the
 *   amendment — never blocks the refusal.
 */

import * as Network from 'expo-network';
import * as Location from 'expo-location';

const STALE_FIX_THRESHOLD_MS = 60_000;

export interface GeoSignals {
  gpsUnavailable: boolean;
}

async function detectAirplaneOrOffline(): Promise<boolean> {
  // Prefer the discrete Android airplane-mode signal when available.
  try {
    if (typeof Network.isAirplaneModeEnabledAsync === 'function') {
      const airplane = await Network.isAirplaneModeEnabledAsync();
      if (airplane) return true;
    }
  } catch {
    // Method unsupported on this platform (iOS/web). Fall through.
  }

  // Cross-platform fallback: treat unreachable internet as the connectivity
  // proxy. Covers Android 14's collapsed airplane-mode signal.
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.isInternetReachable === false) return true;
  } catch {
    // If even network state is unavailable, we cannot prove airplane mode.
  }

  return false;
}

async function isGpsFixStale(): Promise<boolean> {
  try {
    const fix = await Location.getLastKnownPositionAsync();
    if (!fix) return true;
    const ageMs = Date.now() - fix.timestamp;
    return ageMs > STALE_FIX_THRESHOLD_MS;
  } catch {
    // Throws when location services disabled at OS level — equivalent to
    // having no recent fix.
    return true;
  }
}

export async function resolveGeoSignals(): Promise<GeoSignals> {
  try {
    const [offline, stale] = await Promise.all([
      detectAirplaneOrOffline(),
      isGpsFixStale(),
    ]);
    return { gpsUnavailable: offline && stale };
  } catch {
    return { gpsUnavailable: false };
  }
}
