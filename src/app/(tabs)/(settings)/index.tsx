/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Href, Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBorderWidth } from '@/hooks/useBorderWidth';

const SETTINGS_DESTINATIONS: {
  href: Href;
  titleKey: string;
  descriptionKey: string;
}[] = [
  { href: '/general' as Href, titleKey: 'general', descriptionKey: 'general_desc' },
  { href: '/chat-settings' as Href, titleKey: 'chat', descriptionKey: 'chat_desc' },
  { href: '/display' as Href, titleKey: 'display', descriptionKey: 'display_desc' },
  { href: '/language' as Href, titleKey: 'language_section', descriptionKey: 'language_section_desc' },
  { href: '/models' as Href, titleKey: 'models', descriptionKey: 'models_desc' },
  { href: '/packs' as Href, titleKey: 'packs', descriptionKey: 'packs_desc' },
  { href: '/smoke-failure-state' as Href, titleKey: 'smoke_test', descriptionKey: 'smoke_test_desc' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const borderWidth = useBorderWidth();
  const styles = createStyles(theme, borderWidth);
  const { t } = useTranslation('settings');
  const { t: tCommon } = useTranslation('common');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
      ]}>
      <Text style={styles.heading}>{t('title')}</Text>
      <Text style={styles.sub}>{t('subtitle')}</Text>

      <Text style={styles.sectionLabel}>{t('sections')}</Text>
      <View style={styles.sectionList}>
        {SETTINGS_DESTINATIONS.map((item) => (
          <Link key={item.titleKey} href={item.href} asChild>
            <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{t(item.titleKey as never)}</Text>
                <Text style={styles.cardDescription}>{t(item.descriptionKey as never)}</Text>
              </View>
              <Text style={styles.cardAction}>{tCommon('open')}</Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}

function createStyles(theme: AppTheme, borderWidth: 1 | 2) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 16 },
    heading: { color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 4 },
    sub: { color: theme.textSecondary, fontSize: 14, marginBottom: 24 },
    sectionLabel: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    sectionList: { gap: 10 },
    card: {
      backgroundColor: theme.backgroundElement,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      // SUNLIGHT-1 (11-10 Task 3): settings list cards thicken under HC.
      borderWidth,
      borderColor: theme.border,
    },
    cardPressed: { opacity: 0.84 },
    cardCopy: { flex: 1, gap: 2 },
    cardTitle: { color: theme.text, fontSize: 16, fontWeight: '600' },
    cardDescription: { color: theme.textSecondary, fontSize: 13, lineHeight: 18 },
    cardAction: { color: theme.accent, fontSize: 13, fontWeight: '600' },
  });
}
