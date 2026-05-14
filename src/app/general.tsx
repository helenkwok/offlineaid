/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppToggle from '@/components/primitives/AppToggle';
import { Spacing, type AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getAudioScribeModelIds,
  getModelDisplayName,
} from '@/models/runtime';
import { usePreferencesStore } from '@/store';

const NOTE_KEYS = [
  { titleKey: 'note_theme_title', bodyKey: 'note_theme_body' },
  { titleKey: 'note_storage_title', bodyKey: 'note_storage_body' },
  { titleKey: 'note_keyboard_mic_title', bodyKey: 'note_keyboard_mic_body' },
] as const;

export default function GeneralSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useTranslation('settings');
  const { t: tErrors } = useTranslation('errors');
  const voiceAutoSend = usePreferencesStore((s) => s.voiceAutoSend);
  const setVoiceAutoSend = usePreferencesStore((s) => s.setVoiceAutoSend);
  const audioScribeDefaultModelId = usePreferencesStore(
    (s) => s.audioScribeDefaultModelId
  );
  const setAudioScribeDefaultModelId = usePreferencesStore(
    (s) => s.setAudioScribeDefaultModelId
  );
  const audioModelIds = useMemo(() => getAudioScribeModelIds(), []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}>
      <View style={styles.toggleCard}>
        <View style={styles.toggleCopy}>
          <Text style={styles.toggleTitle}>{t('auto_send_voice')}</Text>
          <Text style={styles.toggleBody}>{t('auto_send_voice_body')}</Text>
        </View>
        <AppToggle value={voiceAutoSend} onChange={setVoiceAutoSend} />
      </View>

      {/* Audio Scribe default model. Lists every model that supports the
          Audio Scribe runtime (currently Gemma 4 E2B-it; designed to grow as
          more on-device audio-capable models register). System speech is a
          platform capability, not a model — it's chosen per-clip in the
          Audio Scribe screen, not here. */}
      <View style={styles.pickerCard}>
        <View style={styles.pickerCopy}>
          <Text style={styles.toggleTitle}>{t('audio_scribe_model')}</Text>
          <Text style={styles.toggleBody}>{t('audio_scribe_model_body')}</Text>
        </View>
        <View style={styles.pickerRows}>
          {audioModelIds.map((id) => {
            const active = id === audioScribeDefaultModelId;
            const displayName = getModelDisplayName(id);
            const meta = id.endsWith('.litertlm')
              ? t('audio_scribe_meta_litert')
              : id.endsWith('.task')
                ? t('audio_scribe_meta_task')
                : t('audio_scribe_meta_gguf');
            return (
              <Pressable
                key={id}
                onPress={() => setAudioScribeDefaultModelId(id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t('audio_scribe_set_default_a11y', { displayName })}
                style={({ pressed }) => [
                  styles.pickerRow,
                  active && styles.pickerRowActive,
                  pressed && styles.pickerRowPressed,
                ]}>
                <View
                  style={[
                    styles.radio,
                    active && styles.radioActive,
                  ]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.pickerRowCopy}>
                  <Text style={styles.pickerRowTitle}>{displayName}</Text>
                  <Text style={styles.pickerRowMeta}>{meta}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => router.push('/models' as Href)}
          accessibilityRole="link"
          accessibilityLabel={tErrors('open_models')}>
          <Text style={styles.pickerLink}>{t('manage_models')}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>{t('notes_label')}</Text>
      <View style={styles.notes}>
        {NOTE_KEYS.map((item, i) => (
          <View
            key={item.titleKey}
            style={[styles.noteRow, i < NOTE_KEYS.length - 1 && styles.noteRowDivider]}>
            <Text style={styles.noteTitle}>{t(item.titleKey as never)}</Text>
            <Text style={styles.noteBody}>{t(item.bodyKey as never)}</Text>
          </View>
        ))}
      </View>

    </ScrollView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    // Native stack header owns top inset; tighter rhythm under the header.
    content: { paddingHorizontal: 16, paddingTop: Spacing.headerOffset, gap: 24 },

    // The single interactive item earns its own card surface.
    toggleCard: {
      backgroundColor: theme.backgroundElement,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    toggleCopy: { flex: 1, gap: 4 },
    toggleTitle: { color: theme.text, fontSize: 16, fontWeight: '600' },
    toggleBody: { color: theme.textSecondary, fontSize: 13, lineHeight: 18 },

    // Audio Scribe model picker. Same surface as toggleCard but stacked
    // (intro copy → radio rows → footer link), so flex-direction is column.
    pickerCard: {
      backgroundColor: theme.backgroundElement,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 14,
    },
    pickerCopy: { gap: 4 },
    pickerRows: { gap: 8 },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceMuted,
    },
    pickerRowActive: {
      borderColor: theme.text,
      backgroundColor: theme.backgroundElement,
    },
    pickerRowPressed: { opacity: 0.84 },
    pickerRowCopy: { flex: 1, gap: 2 },
    pickerRowTitle: { color: theme.text, fontSize: 15, fontWeight: '600' },
    pickerRowMeta: { color: theme.textMuted, fontSize: 12 },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: theme.textMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioActive: { borderColor: theme.text },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.text,
    },
    pickerLink: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '600',
      paddingVertical: 4,
    },

    // Notes are static read-only, so collapse the identical-card grid into a
    // grouped definition list with hairline dividers. Less heavy chrome.
    sectionLabel: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: -16,
      marginLeft: 4,
    },
    notes: {
      backgroundColor: theme.backgroundElement,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
    },
    noteRow: { paddingVertical: 14, gap: 4 },
    noteRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    noteTitle: { color: theme.text, fontSize: 15, fontWeight: '600' },
    noteBody: { color: theme.textSecondary, fontSize: 13, lineHeight: 18 },
  });
}
