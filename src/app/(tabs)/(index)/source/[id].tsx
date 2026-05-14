/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * Phase 11 TAP-1 — source-detail formSheet route.
 *
 * Mounted as `(index)/source/[id]`; receives a sourceKey as the `id` route param,
 * resolves it via `loadChunkByKey`, and presents the full chunk text in a
 * half/full-detent formSheet with a Copy chunk + Close button row.
 */
import { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { type AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadChunkByKey, type ChunkRow } from '@/services/chunk-resolver';

export default function SourceDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [chunk, setChunk] = useState<ChunkRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadChunkByKey(id ?? '')
      .then((row) => {
        if (!cancelled) {
          setChunk(row);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChunk(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.5, 1.0],
          contentStyle: { backgroundColor: 'transparent' },
          headerShown: false,
        }}
      />
      <View style={styles.container}>
        <Text style={styles.filename} numberOfLines={2}>
          {chunk?.filename ?? (loading ? 'Loading…' : '—')}
        </Text>
        <View style={styles.divider} />
        <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
          <Text selectable style={styles.body}>
            {chunk?.full ?? (loading ? '' : 'Source not found.')}
          </Text>
        </ScrollView>
        <View style={styles.divider} />
        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy chunk"
            style={[styles.button, styles.buttonAccent]}
            disabled={!chunk}
            onPress={() => {
              if (chunk) void Clipboard.setStringAsync(chunk.full);
            }}>
            <Text style={styles.buttonAccentText}>{'Copy chunk'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={[styles.button, styles.buttonGhost]}
            onPress={() => router.back()}>
            <Text style={styles.buttonGhostText}>{'Close'}</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: theme.background },
    filename: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    divider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 12,
      opacity: 0.5,
    },
    bodyScroll: { flex: 1 },
    bodyContent: { paddingBottom: 8 },
    body: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.text,
      lineHeight: 20,
    },
    buttonRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
    button: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    buttonAccent: { backgroundColor: theme.accent },
    buttonAccentText: { color: theme.accentText, fontSize: 14, fontWeight: '600' },
    buttonGhost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.border,
    },
    buttonGhostText: { color: theme.text, fontSize: 14, fontWeight: '500' },
  });
}
