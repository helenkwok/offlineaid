/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * Chat settings:preferences scoped to the Chat tab. FAIL-LADDER-1 / 11-09
 * surfaces the "Suggest closest pack content on refusals" toggle here. Sub-copy
 * is verbatim from 11-DESIGN-BRIEF rev 6 section 8.
 *
 * NOTE: plan spec called this "(settings)/chat.tsx" but the existing app
 * routes top-level settings screens at the root (general.tsx, models.tsx,
 * packs.tsx) and a (tabs)/(settings) tab links into them. We follow the
 * existing pattern here; the file name is the only deviation.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppToggle from '@/components/primitives/AppToggle';
import { Spacing, type AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBorderWidth } from '@/hooks/useBorderWidth';
import { usePreferencesStore } from '@/store';

export default function ChatSettingsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const borderWidth = useBorderWidth();
  const styles = useMemo(() => createStyles(theme, borderWidth), [theme, borderWidth]);
  const { t } = useTranslation('settings');
  const suggestClosestPackOnRefusals = usePreferencesStore(
    (s) => s.suggestClosestPackOnRefusals
  );
  const setSuggestClosestPackOnRefusals = usePreferencesStore(
    (s) => s.setSuggestClosestPackOnRefusals
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}>
      <Text style={styles.sectionLabel}>{t('refusals_label')}</Text>
      <View style={styles.toggleCard}>
        <View style={styles.toggleCopy}>
          <Text style={styles.toggleTitle}>{t('suggest_closest_match')}</Text>
          <Text style={styles.toggleBody}>{t('suggest_closest_match_body')}</Text>
        </View>
        <AppToggle
          value={suggestClosestPackOnRefusals}
          onChange={setSuggestClosestPackOnRefusals}
        />
      </View>
    </ScrollView>
  );
}

function createStyles(theme: AppTheme, borderWidth: 1 | 2) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: {
      paddingHorizontal: 16,
      paddingTop: Spacing.headerOffset,
      gap: 12,
    },
    sectionLabel: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginLeft: 4,
    },
    toggleCard: {
      backgroundColor: theme.backgroundElement,
      borderRadius: 12,
      // SUNLIGHT-1 (11-10 Task 3): Chat settings toggle card thickens under HC.
      borderWidth,
      borderColor: theme.border,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    toggleCopy: { flex: 1, gap: 4 },
    toggleTitle: { color: theme.text, fontSize: 16, fontWeight: '600' },
    toggleBody: { color: theme.textSecondary, fontSize: 13, lineHeight: 18 },
  });
}
