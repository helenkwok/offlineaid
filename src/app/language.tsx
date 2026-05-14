/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, NativeModules, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBorderWidth } from '@/hooks/useBorderWidth';
import { RTL_LOCALES, SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n';
import { usePreferencesStore } from '@/store';

// Locale labels shown in the picker. We keep these in the NATIVE script of
// each locale (not localised via t()) so users in any state of the app can
// always recognise their own language by sight.
const LOCALE_LABELS: Record<SupportedLocale, { native: string; en: string }> = {
  en: { native: 'English', en: 'English' },
  'zh-Hans': { native: '中文（简体）', en: 'Chinese (Simplified)' },
  'zh-Hant': { native: '中文（繁體）', en: 'Chinese (Traditional)' },
  ar: { native: 'العربية', en: 'Arabic' },
};

export default function LanguageScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const borderWidth = useBorderWidth();
  const styles = useMemo(() => createStyles(theme, borderWidth), [theme, borderWidth]);
  const { t, i18n } = useTranslation('settings');

  const userLanguage = usePreferencesStore((s) => s.userLanguage);
  const setUserLanguage = usePreferencesStore((s) => s.setUserLanguage);
  // currentLocale = persisted override OR whatever i18next resolved at startup
  // (which is itself either the override or the OS locale via resolveOsLocale).
  const currentLocale = (userLanguage ?? i18n.language) as SupportedLocale;
  const [pending, setPending] = useState<SupportedLocale | null>(null);

  const select = (locale: SupportedLocale) => {
    if (locale === currentLocale) return;
    setPending(locale);
    const wasRTL = RTL_LOCALES.includes(currentLocale);
    const willBeRTL = RTL_LOCALES.includes(locale);
    setUserLanguage(locale);
    // The store subscriber in src/lib/i18n.ts handles the
    // i18next.changeLanguage + I18nManager.forceRTL flip. The forceRTL flip
    // only takes effect on the NEXT bundle load, so when the direction
    // changes we prompt the user to restart the app via DevSettings (dev) or
    // by reopening the app (release).
    if (wasRTL !== willBeRTL) {
      Alert.alert(
        t('language_picker_reload_title'),
        t('language_picker_reload_body'),
        [
          {
            text: t('language_picker_reload_action'),
            onPress: () => {
              try {
                // Available on the dev client (Reanimated / RN devsupport).
                // In release builds users must reopen manually.
                NativeModules.DevSettings?.reload?.();
              } catch {
                // no-op
              }
            },
          },
        ],
        { cancelable: true },
      );
    }
    setPending(null);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
      ]}>
      <Text style={styles.heading}>{t('language_section')}</Text>
      <Text style={styles.sub}>{t('language_section_desc')}</Text>

      <View style={styles.list}>
        {SUPPORTED_LOCALES.map((locale) => {
          const label = LOCALE_LABELS[locale];
          const selected = locale === currentLocale;
          const isPending = pending === locale;
          return (
            <Pressable
              key={locale}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: isPending }}
              accessibilityLabel={label.en}
              onPress={() => select(locale)}
              style={({ pressed }) => [
                styles.row,
                selected && styles.rowSelected,
                pressed && styles.rowPressed,
              ]}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowNative}>{label.native}</Text>
                {label.native !== label.en && (
                  <Text style={styles.rowEnglish}>{label.en}</Text>
                )}
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function createStyles(theme: AppTheme, borderWidth: 1 | 2) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 16 },
    heading: { color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 4 },
    sub: { color: theme.textSecondary, fontSize: 14, marginBottom: 24, lineHeight: 20 },
    list: { gap: 10 },
    row: {
      backgroundColor: theme.backgroundElement,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth,
      borderColor: theme.border,
    },
    rowSelected: { borderColor: theme.accent },
    rowPressed: { opacity: 0.84 },
    rowCopy: { flex: 1, gap: 2 },
    rowNative: { color: theme.text, fontSize: 17, fontWeight: '600' },
    rowEnglish: { color: theme.textSecondary, fontSize: 13 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: { borderColor: theme.accent },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.accent,
    },
  });
}
