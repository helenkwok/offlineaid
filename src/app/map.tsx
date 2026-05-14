/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * Map screen — focused map result handoff.
 *
 * This screen receives structured map payloads from chat and gives users
 * a focused place list plus external map handoff while the full in-app
 * MapLibre renderer is wired in a later phase.
 */
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type MapPointSelection, useMapStore, useChatDraftStore } from '@/store';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const activeSelection = useMapStore((state) => state.activeSelection);
  const clearActiveSelection = useMapStore((state) => state.clearActiveSelection);
  const setPendingDraft = useChatDraftStore((s) => s.setPendingDraft);
  const theme = useTheme();
  const styles = createStyles(theme);
  const { t } = useTranslation('settings');
  const { t: tMap } = useTranslation('explore');

  async function openExternalMap(point: MapPointSelection) {
    const encodedTitle = encodeURIComponent(point.title);

    if (Platform.OS === 'ios') {
      await Linking.openURL(`https://maps.apple.com/?ll=${point.lat},${point.lon}&q=${encodedTitle}`);
      return;
    }

    if (Platform.OS === 'android') {
      const geoUrl = `geo:${point.lat},${point.lon}?q=${point.lat},${point.lon}(${encodedTitle})`;
      await Linking.openURL(geoUrl);
      return;
    }

    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lon}`);
  }

  function handleSendToChat(point: MapPointSelection) {
    const detailsLine = point.subtitle ? `${tMap('map_handoff_details', { details: point.subtitle })}\n` : '';
    const draft = `${tMap('map_handoff_intro')}\n${tMap('map_handoff_name', { name: point.title })}\n${detailsLine}${tMap('map_handoff_coords', { lat: point.lat.toFixed(5), lon: point.lon.toFixed(5) })}\n\n${tMap('map_handoff_prompt')}`;
    setPendingDraft(draft);
    router.push('/');
  }

  return (
    <>
      <Stack.Screen options={{ title: t('map_title') }} />
      <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}>
      <Text style={styles.heading}>{t('map_title')}</Text>

      {activeSelection ? (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>{tMap('map_active_eyebrow')}</Text>
            <Text style={styles.heroTitle}>{activeSelection.title}</Text>
            <Text style={styles.heroSummary}>{activeSelection.summary}</Text>

            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              onPress={clearActiveSelection}>
              <Text style={styles.secondaryButtonText}>{tMap('map_clear_selection')}</Text>
            </Pressable>
          </View>

          <View style={styles.placeholderMap}>
            <Text style={styles.placeholderMapTitle}>{tMap('map_renderer_ready_title')}</Text>
            <Text style={styles.placeholderMapText}>
              {tMap('map_renderer_ready_body', { count: activeSelection.points.length })}
            </Text>
          </View>

          <View style={styles.list}>
            {activeSelection.points.map((point) => (
              <View key={point.id} style={styles.pointCard}>
                <View style={styles.pointHeader}>
                  <View style={styles.pin} />
                  <View style={styles.pointHeaderText}>
                    <Text style={styles.pointTitle}>{point.title}</Text>
                    {!!point.subtitle && <Text style={styles.pointSubtitle}>{point.subtitle}</Text>}
                  </View>
                </View>

                <Text style={styles.coordinates}>
                  {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
                </Text>

                <View style={styles.pointActions}>
                  <Pressable
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                    onPress={() => void openExternalMap(point)}>
                    <Text style={styles.primaryButtonText}>{tMap('map_open_in_maps')}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.secondaryButtonSmall, pressed && styles.buttonPressed]}
                    onPress={() => handleSendToChat(point)}>
                    <Text style={styles.secondaryButtonText}>{tMap('map_ask_in_chat')}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.icon}>🗺️</Text>
          <Text style={styles.title}>{tMap('map_empty_title')}</Text>
          <Text style={styles.sub}>{tMap('map_empty_body')}</Text>
        </View>
      )}
    </ScrollView>
    </>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: {
      paddingHorizontal: 16,
      gap: 16,
    },
    heading: {
      color: theme.text,
      fontSize: 26,
      fontWeight: '800',
    },
    hero: {
      backgroundColor: theme.surfaceMuted,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 18,
      gap: 10,
    },
    heroEyebrow: {
      color: theme.accentMutedText,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    heroTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '800',
    },
    heroSummary: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    placeholderMap: {
      backgroundColor: theme.surfaceStrong,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 18,
      minHeight: 180,
      justifyContent: 'center',
      gap: 8,
    },
    placeholderMapTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
    },
    placeholderMapText: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    list: {
      gap: 12,
    },
    pointCard: {
      backgroundColor: theme.backgroundElement,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 12,
    },
    pointHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    pointHeaderText: {
      flex: 1,
      gap: 4,
    },
    pin: {
      width: 12,
      height: 12,
      borderRadius: 999,
      backgroundColor: theme.mapDot,
      marginTop: 6,
    },
    pointTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    pointSubtitle: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    coordinates: {
      color: theme.textMuted,
      fontSize: 13,
      fontVariant: ['tabular-nums'],
    },
    pointActions: {
      flexDirection: 'row',
      gap: 10,
    },
    primaryButton: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      backgroundColor: theme.buttonSecondary,
    },
    primaryButtonText: {
      color: theme.buttonText,
      fontSize: 14,
      fontWeight: '700',
    },
    secondaryButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.surfaceAccent,
      borderWidth: 1,
      borderColor: theme.accentStrong,
    },
    secondaryButtonSmall: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      backgroundColor: theme.surfaceAccent,
      borderWidth: 1,
      borderColor: theme.accentStrong,
    },
    secondaryButtonText: {
      color: theme.accentMutedText,
      fontSize: 14,
      fontWeight: '700',
    },
    buttonPressed: {
      opacity: 0.8,
    },
    emptyState: {
      minHeight: 420,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      gap: 16,
    },
    icon: { fontSize: 56 },
    title: { color: theme.text, fontSize: 22, fontWeight: '700' },
    sub: { color: theme.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  });
}
