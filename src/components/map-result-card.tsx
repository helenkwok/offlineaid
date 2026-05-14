/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type ActiveMapSelection, useMapStore } from '@/store';

type Props = {
  selection: ActiveMapSelection;
};

export function MapResultCard({ selection }: Props) {
  const router = useRouter();
  const setActiveSelection = useMapStore((state) => state.setActiveSelection);
  const previewPoints = selection.points.slice(0, 3);
  const theme = useTheme();
  const styles = createStyles(theme);
  const { t } = useTranslation('explore');

  function openMapTab() {
    setActiveSelection(selection);
    router.push('/map');
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>{t('map_result_eyebrow')}</Text>
        <Text style={styles.count}>{t('map_result_count', { count: selection.points.length })}</Text>
      </View>

      <Text style={styles.title}>{selection.title}</Text>
      <Text style={styles.summary}>{selection.summary}</Text>

      <View style={styles.points}>
        {previewPoints.map((point) => (
          <View key={point.id} style={styles.pointRow}>
            <View style={styles.dot} />
            <View style={styles.pointText}>
              <Text style={styles.pointTitle}>{point.title}</Text>
              {!!point.subtitle && <Text style={styles.pointSubtitle}>{point.subtitle}</Text>}
            </View>
          </View>
        ))}
      </View>

      <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]} onPress={openMapTab}>
        <Text style={styles.buttonText}>{t('map_open_tab')}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      alignSelf: 'stretch',
      backgroundColor: theme.surfaceStrong,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 12,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    eyebrow: {
      color: theme.accentMutedText,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    count: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    title: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
    },
    summary: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    points: {
      gap: 10,
    },
    pointRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: theme.mapDot,
      marginTop: 5,
    },
    pointText: {
      flex: 1,
      gap: 2,
    },
    pointTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '600',
    },
    pointSubtitle: {
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    button: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.buttonSecondary,
    },
    buttonPressed: {
      opacity: 0.8,
    },
    buttonText: {
      color: theme.buttonText,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
