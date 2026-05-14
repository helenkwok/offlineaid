/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * ChatEmptyState — shown via FlatList's ListEmptyComponent when there are no
 * messages yet.  Replaces the old always-visible statusCard by surfacing the
 * same information only when the screen is actually empty, so it doesn't steal
 * vertical space once a conversation is in progress.
 */
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { type AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { severityStyle } from '@/components/severity/severityStyle';

interface Props {
  modelLoaded: boolean;
  activePackCount: number;
}

export function ChatEmptyState({ modelLoaded, activePackCount }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useTranslation('chat');

  return (
    <View style={styles.container}>
      <Text style={styles.appName}>{t('empty_app_name')}</Text>
      <Text style={styles.tagline}>{t('empty_tagline')}</Text>

      {!modelLoaded && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('empty_no_model_title')}</Text>
          <Text style={styles.cardBody}>{t('empty_no_model_body')}</Text>
          <Link href={'/models' as never} asChild>
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.8}>
              <Text style={styles.primaryBtnText}>{t('empty_no_model_cta')}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      )}

      {modelLoaded && activePackCount === 0 && (
        <View style={[styles.card, styles.cardReady]}>
          <Text style={styles.cardTitle}>{t('empty_ready_title')}</Text>
          <Text style={styles.cardBody}>{t('empty_ready_no_packs')}</Text>
          <Link href={'/packs' as never} asChild>
            <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.8}>
              <Text style={styles.ghostBtnText}>{t('empty_browse_packs')}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      )}

      {modelLoaded && activePackCount > 0 && (
        <View style={[styles.card, styles.cardReady]}>
          <Text style={styles.cardTitle}>{t('empty_ready_title')}</Text>
          <Text style={styles.cardBody}>
            {t('empty_ready_packs', { count: activePackCount })}
          </Text>
        </View>
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  // FAIL-LADDER-1 (11-09 Task 3) ladder-consistency audit: the empty-conversation
  // and first-run surfaces both consume severityStyle('none') for their body
  // text rhythm so the four-rung ladder remains the single source of truth
  // for weight + tracking + density across chat states.
  const noneRung = severityStyle('none');
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingVertical: 48,
      gap: 8,
    },
    appName: {
      color: theme.text,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.5,
      marginBottom: 2,
    },
    tagline: {
      color: theme.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 24,
    },
    card: {
      width: '100%',
      backgroundColor: theme.surfaceMuted,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
      gap: 12,
    },
    cardReady: {
      borderColor: theme.successBorder,
      backgroundColor: theme.surfaceSuccess,
    },
    cardTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    cardBody: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      // Ladder-consistency: weight + tracking come from severityStyle('none')
      // so this surface is auditably part of the rung system.
      fontWeight: noneRung.fontWeight,
      letterSpacing: noneRung.letterSpacing,
    },
    primaryBtn: {
      backgroundColor: theme.buttonPrimary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 4,
    },
    primaryBtnText: {
      color: theme.buttonText,
      fontSize: 15,
      fontWeight: '700',
    },
    ghostBtn: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 4,
    },
    ghostBtnText: {
      color: theme.accentMutedText,
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
