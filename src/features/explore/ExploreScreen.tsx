/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * Explore screen — manual search across active knowledge packs.
 *
 * Provides text-based FTS search and geo-point search with map handoff.
 */
import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, type AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { searchPack, searchGeoPoints, type SearchResult, type GeoResult } from '@/services/pack';
import { usePackStore, useMapStore } from '@/store';
import { HighlightedText } from '@/components/HighlightedText';

type SearchMode = 'text' | 'map';

interface ExploreScreenProps {
  query?: string;
  onQueryChange?: (next: string) => void;
}

export default function ExploreScreen({ query: queryProp, onQueryChange }: ExploreScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);
  const { t } = useTranslation('explore');

  const { activePacks } = usePackStore();
  const { setActiveSelection } = useMapStore();

  const [internalQuery] = useState('');
  const query = queryProp !== undefined ? queryProp : internalQuery;
  void onQueryChange; // header search owns the writer; reserved for future direct callers
  const [mode, setMode] = useState<SearchMode>('text');
  const [searching, setSearching] = useState(false);
  const [textResults, setTextResults] = useState<(SearchResult & { packName: string })[]>([]);
  const [geoResults, setGeoResults] = useState<(GeoResult & { packName: string })[]>([]);

  const handleSearch = useCallback(async () => {
    if (activePacks.length === 0 || !query.trim()) return;

    KeyboardController.dismiss();
    setSearching(true);
    try {
      if (mode === 'text') {
        const resultsArray = await Promise.all(
          activePacks.map((pack) => searchPack(pack.dbPath, query, 10))
        );
        const all: (SearchResult & { packName: string })[] = [];
        resultsArray.forEach((results, idx) => {
          for (const r of results) {
            all.push({ ...r, packName: activePacks[idx].name });
          }
        });
        setTextResults(all);
      } else {
        const resultsArray = await Promise.all(
          activePacks.map((pack) => searchGeoPoints(pack.dbPath, query, 10))
        );
        const all: (GeoResult & { packName: string })[] = [];
        resultsArray.forEach((results, idx) => {
          for (const r of results) {
            all.push({ ...r, packName: activePacks[idx].name });
          }
        });
        setGeoResults(all);
      }
    } catch (error) {
      console.error('[Explore] Search failed', error);
    } finally {
      setSearching(false);
    }
  }, [activePacks, query, mode]);

  // Simple debounce for auto-search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        void handleSearch();
      } else {
        setTextResults([]);
        setGeoResults([]);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, mode, activePacks, handleSearch]);

  function handleGeoSelect(item: GeoResult & { packName: string }) {
    setActiveSelection({
      title: item.name,
      query: query,
      summary: t('result_from_pack', { packName: item.packName }),
      points: [
        {
          id: `${item.lat}-${item.lon}-${item.name}`,
          title: item.name,
          subtitle: item.address || item.category,
          lat: item.lat,
          lon: item.lon,
          category: item.category,
        },
      ],
    });
    router.push('/map');
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('title') }} />
      <View style={[styles.header, { paddingTop: Spacing.headerOffset }]}>
        {searching && (
          <View style={styles.searchingRow}>
            <ActivityIndicator size="small" color={theme.accentStrong} />
            <Text style={styles.searchingText}>{t('searching')}</Text>
          </View>
        )}

        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'text' && styles.modeBtnActive]}
            onPress={() => setMode('text')}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === 'text' }}
            accessibilityLabel={t('mode_knowledge_a11y')}>
            <Text style={[styles.modeBtnText, mode === 'text' && styles.modeBtnTextActive]}>{t('mode_knowledge')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'map' && styles.modeBtnActive]}
            onPress={() => setMode('map')}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === 'map' }}
            accessibilityLabel={t('mode_places_a11y')}>
            <Text style={[styles.modeBtnText, mode === 'map' && styles.modeBtnTextActive]}>{t('mode_places')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.results, { paddingBottom: insets.bottom + 20 }]}>
        {activePacks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>{t('empty_no_packs')}</Text>
            <Text style={styles.emptySub}>{t('empty_no_packs_sub')}</Text>
            <TouchableOpacity
              style={styles.cta}
              onPress={() => router.navigate('/packs' as never)}
              accessibilityRole="button"
              accessibilityLabel={t('empty_manage_packs')}>
              <Text style={styles.ctaText}>{t('empty_manage_packs')}</Text>
            </TouchableOpacity>
          </View>
        ) : query.trim().length < 2 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>{t('empty_search_data')}</Text>
            <Text style={styles.emptySub}>
              {mode === 'text' ? t('empty_knowledge_hint') : t('empty_places_hint')}
            </Text>
          </View>
        ) : mode === 'text' ? (
          textResults.length === 0 && !searching ? (
            <Text style={styles.noResults}>{t('no_results_knowledge')}</Text>
          ) : (
            textResults.map((res, i) => (
              <View key={`${res.packName}-${res.chunkId}-${i}`} style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.sourceLabel}>{res.packName} / {res.source}</Text>
                </View>
                <HighlightedText
                  text={res.snippet}
                  style={styles.snippet}
                  numberOfLines={4}
                  highlightStyle={{ color: theme.text }}
                />
              </View>
            ))
          )
        ) : (
          geoResults.length === 0 && !searching ? (
            <Text style={styles.noResults}>{t('no_results_places')}</Text>
          ) : (
            geoResults.map((res, i) => (
              <Pressable 
                key={`${res.packName}-${res.name}-${i}`} 
                style={({ pressed }) => [styles.geoCard, pressed && styles.pressed]}
                onPress={() => handleGeoSelect(res)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${res.name}, ${res.category} from ${res.packName}`}>
                <View style={styles.geoInfo}>
                  <Text style={styles.geoName}>{res.name}</Text>
                  <Text style={styles.geoSub}>{res.category} · {res.packName}</Text>
                  {res.address && <Text style={styles.geoAddr}>{res.address}</Text>}
                </View>
                <SymbolView name="map" size={20} tintColor={theme.accentStrong} />
              </Pressable>
            ))
          )
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      paddingHorizontal: 16,
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 16,
      paddingBottom: 16,
    },
    heading: { color: theme.text, fontSize: 24, fontWeight: '800' },
    searchingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    searchingText: { color: theme.textMuted, fontSize: 12 },
    modeToggle: { flexDirection: 'row', backgroundColor: theme.surfaceMuted, borderRadius: 10, padding: 4 },
    modeBtn: { flex: 1, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
    modeBtnActive: { backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border },
    modeBtnText: { color: theme.textMuted, fontSize: 13, fontWeight: '600' },
    modeBtnTextActive: { color: theme.text },
    results: { padding: 16, gap: 12 },
    resultCard: { backgroundColor: theme.backgroundElement, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border },
    resultHeader: { marginBottom: 8 },
    sourceLabel: { color: theme.accentMutedText, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    snippet: { color: theme.textSecondary, fontSize: 14, lineHeight: 20 },
    geoCard: { backgroundColor: theme.backgroundElement, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
    geoInfo: { flex: 1 },
    geoName: { color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 2 },
    geoSub: { color: theme.textSecondary, fontSize: 13 },
    geoAddr: { color: theme.textMuted, fontSize: 12, marginTop: 4 },
    noResults: { color: theme.textMuted, textAlign: 'center', marginTop: 40 },
    emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
    emptyIcon: { fontSize: 48, marginBottom: 16 },
    emptyTitle: { color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
    emptySub: { color: theme.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    cta: { marginTop: 24, backgroundColor: theme.buttonSecondary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
    ctaText: { color: theme.buttonText, fontWeight: '700' },
    pressed: { opacity: 0.7 },
  });
}
