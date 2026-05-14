/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * Settings > Display screen. SUNLIGHT-1 / 11-DESIGN-BRIEF rev 6 section 7.
 *
 * Sunlight Mode toggle (independent of system Dark Mode), an OS-detected
 * banner that appears only when the platform high-contrast preference is
 * on, and the soft auto-switch dialog flow.
 *
 * NOTE: plan spec called this "(settings)/display.tsx" but the existing
 * settings sub-screens are top-level routes (general.tsx, chat-settings.tsx,
 * models.tsx, packs.tsx) hosted by the root <Stack>. We follow that pattern
 * here so cross-tab Links from anywhere are normal Stack pushes. The (tabs)
 * (settings) hub links into this route at /display.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Appearance, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppToggle from '@/components/primitives/AppToggle';
import SunlightAutoSwitchDialog from '@/components/sunlight/SunlightAutoSwitchDialog';
import { Spacing, type AppTheme } from '@/constants/theme';
import { useBorderWidth } from '@/hooks/useBorderWidth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOsHighContrast } from '@/hooks/useOsHighContrast';
import { useTheme } from '@/hooks/use-theme';
import { usePreferencesStore } from '@/store';

export default function DisplaySettingsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const borderWidth = useBorderWidth();
  const styles = useMemo(() => createStyles(theme, borderWidth), [theme, borderWidth]);
  const { t } = useTranslation('settings');

  const sunlightMode = usePreferencesStore((s) => s.sunlightMode);
  const setSunlightMode = usePreferencesStore((s) => s.setSunlightMode);
  const previousColorScheme = usePreferencesStore((s) => s.previousColorScheme);
  const setPreviousColorScheme = usePreferencesStore((s) => s.setPreviousColorScheme);
  const sunlightAutoSwitchDontAskAgain = usePreferencesStore(
    (s) => s.sunlightAutoSwitchDontAskAgain,
  );

  const osHighContrast = useOsHighContrast();
  const scheme = useColorScheme();
  const resolvedScheme = !scheme || scheme === 'unspecified' ? 'light' : scheme;

  const [dialogVisible, setDialogVisible] = useState(false);

  const handleToggleSunlight = (next: boolean) => {
    setSunlightMode(next);
    if (next) {
      // ON: if active scheme is Dark and the user has not silenced the prompt,
      // surface the soft auto-switch dialog.
      if (resolvedScheme === 'dark' && !sunlightAutoSwitchDontAskAgain) {
        setDialogVisible(true);
      }
    } else {
      // OFF: if the dialog previously flipped scheme to Light, restore Dark
      // and clear the saved value.
      if (previousColorScheme === 'dark') {
        Appearance.setColorScheme('dark');
        setPreviousColorScheme(null);
      }
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}>
      <Text style={styles.sectionLabel}>{t('sunlight_mode_label')}</Text>
      <Text style={styles.sectionNote}>{t('sunlight_mode_note')}</Text>

      <View style={styles.toggleCard}>
        <View style={styles.toggleCopy}>
          <Text style={styles.toggleTitle}>{t('sunlight_mode_toggle_title')}</Text>
          <Text style={styles.toggleBody}>{t('sunlight_mode_body')}</Text>
        </View>
        <AppToggle
          value={sunlightMode}
          onChange={handleToggleSunlight}
          accessibilityLabel={t('sunlight_mode_toggle_title')}
        />
      </View>

      {osHighContrast ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{t('os_high_contrast_detected')}</Text>
        </View>
      ) : null}

      <SunlightAutoSwitchDialog
        visible={dialogVisible}
        onDismiss={() => setDialogVisible(false)}
      />
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
    sectionNote: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      marginLeft: 4,
      marginRight: 4,
    },
    toggleCard: {
      backgroundColor: theme.backgroundElement,
      borderRadius: 12,
      borderWidth,
      borderColor: theme.border,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    toggleCopy: { flex: 1, gap: 4 },
    toggleTitle: { color: theme.text, fontSize: 16, fontWeight: '600' },
    toggleBody: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    banner: {
      backgroundColor: theme.surfaceMuted,
      borderRadius: 10,
      borderWidth,
      borderColor: theme.border,
      padding: 12,
    },
    bannerText: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}
