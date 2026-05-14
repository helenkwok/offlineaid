/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Throwaway scratch screen for 11-09 Task 1 visual smoke. Mounts one of each
// failure-state component populated with Sketch 002 variant copy. Reachable
// at /smoke-failure-state. Delete after Task 1 review.

import { Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AmbientBanner,
  FailureCritical,
  FailureError,
  FailureWarn,
} from '@/components/failure-state';
import { type AppTheme, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function SmokeFailureStateScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();

  const noop = (label: string) => () =>
    Alert.alert('Pressed', label, [{ text: 'OK' }]);

  return (
    <>
      <Stack.Screen options={{ title: 'Failure-state smoke' }} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.headerOffset, paddingBottom: insets.bottom + 24 },
        ]}>
        <Text style={styles.heading}>Failure-state ladder smoke</Text>
        <Text style={styles.sub}>
          Sketch 002 variants A–F. Toggle system theme to compare light + dark.
        </Text>

        {/* AmbientBanner is normally mounted layout-level; render here at top
            for visual reference only. */}
        <Text style={styles.sectionLabel}>D · Ambient (cold-start)</Text>
        <AmbientBanner
          message="Loading model"
          progress={{ current: 6.4, total: 2600, unit: 'MB' }}
          eta="~12s"
          actions={[
            { label: 'Browse sources', onPress: noop('Browse sources (D)') },
          ]}
        />

        <Text style={styles.sectionLabel}>B · Tier 1 warn (no-chunk-matched)</Text>
        <FailureWarn
          icon="?"
          title="No source found in your packs"
          body="The model can answer this, but no chunk in any active pack matched the query. Browse packs to add coverage, or proceed without a citation."
          meta="0 chunks · 3 packs active"
          primary={{ label: 'Browse packs', onPress: noop('Browse packs (B)') }}
          ghostDanger={{
            label: 'Answer without a source',
            onPress: noop('Answer ungrounded (B)'),
          }}
          ghost={{ label: 'Cancel', onPress: noop('Cancel (B)') }}
        />

        <Text style={styles.sectionLabel}>A · Tier 2 error (pack-missing)</Text>
        <FailureError
          icon="!"
          title="No knowledge pack installed"
          body="OfflineAid needs a .oapack.zip to ground its answers. Import one to get started."
          primary={{ label: 'Import a pack', onPress: noop('Import (A)') }}
          secondary={{
            label: 'Where do I get one?',
            onPress: noop('Help (A)'),
          }}
        />

        <Text style={styles.sectionLabel}>E · Tier 2 error (device-too-cold)</Text>
        <FailureError
          icon="°"
          title="Device too cold to run inference"
          body="Battery temp is too low for stable inference. Warm in jacket pocket 5–10 min — body heat is enough."
          meta="-2 °C · trend ↓ -0.1 °C/min"
          primary={{ label: 'Try anyway', onPress: noop('Try cold (E)') }}
          secondary={{ label: 'Wait for warm-up', onPress: noop('Wait (E)') }}
          ghost={{ label: 'Browse sources', onPress: noop('Browse (E)') }}
        />

        <Text style={styles.sectionLabel}>F · Tier 2 error (device-too-hot)</Text>
        <FailureError
          icon="°"
          title="Device too hot — inference paused"
          body="Get out of sun, remove case, lay flat 5–10 min. Body heat or warm pocket NOT useful here."
          meta="44 °C · trend ↑ +0.4 °C/min"
          primary={{ label: 'Try anyway (slow)', onPress: noop('Try hot (F)') }}
          secondary={{ label: 'Pause for cooldown', onPress: noop('Cool (F)') }}
          ghost={{ label: 'Browse sources', onPress: noop('Browse (F)') }}
        />

        <Text style={styles.sectionLabel}>C · Tier 3 critical (model-not-loaded)</Text>
        <FailureCritical
          stripText="⏻ Model unavailable"
          title="The chat model failed to load"
          body="You can still browse imported packs offline. Field pro: see detail rows for what to repair."
          rows={[
            { k: 'model', v: 'gemma-4-E2B (Q4_K_M)' },
            { k: 'size', v: '2.6 GB' },
            { k: 'runtime', v: 'llama.rn 0.5.0' },
            { k: 'error', v: 'ENOMEM: failed to mmap', danger: true },
            { k: 'free RAM', v: '412 MB' },
          ]}
          fallback={{
            label: 'Browse packs offline',
            onPress: noop('Browse offline (C)'),
          }}
          repair={{ label: 'Retry load', onPress: noop('Retry (C)') }}
          alt={{ label: 'Switch model', onPress: noop('Switch (C)') }}
        />

        <View style={styles.footerRow}>
          <Text style={styles.footerNote}>
            All actions Alert.alert() — they are smoke-only stubs.
          </Text>
          <Text style={styles.footerNote} onPress={() => router.back()}>
            ← Back
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      paddingHorizontal: Spacing.three,
      gap: Spacing.three,
    },
    heading: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '700',
    },
    sub: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    sectionLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginTop: Spacing.three,
    },
    footerRow: {
      marginTop: Spacing.four,
      gap: Spacing.two,
    },
    footerNote: {
      color: theme.textMuted,
      fontSize: 12,
    },
  });
}
