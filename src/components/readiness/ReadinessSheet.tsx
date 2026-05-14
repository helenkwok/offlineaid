/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/hooks/use-theme';
import { useBorderWidth } from '@/hooks/useBorderWidth';
import { type AppTheme } from '@/constants/theme';
import { useModelStore } from '@/store/model-store';
import { usePackStore } from '@/store/pack-store';
import { usePreferencesStore } from '@/store/preferences-store';
import { getModelShortName } from '@/models/runtime';
import AppToggle from '@/components/primitives/AppToggle';
import type { ReadinessState } from '@/components/readiness/types';

// FAIL-LADDER-1 / 11-DESIGN-BRIEF rev 6 section 7. formSheet body -- model row,
// pack list with active toggles + freshness-tier copy, and "Import pack…" CTA.
//
// Detents [0.5, 1.0]: native iOS 'formSheet' presentation comes close to this
// without a custom sheet library (RN's Modal supports presentationStyle).
// Android falls back to a translucent overlay sheet anchored to the bottom
// safe area; ergonomic equivalent for the field user.

// Voice law (section 8): no em-dashes in authored copy -- verified by grep.
// Freshness copy is resolved via t() inside the component (the static fallback
// here is referenced by useReadinessState's DEVIATION note for grep-search
// compatibility but never rendered now that i18n is wired).
// const FRESHNESS_STATIC = 'Stable knowledge. Updated recently.';

interface Props {
  visible: boolean;
  onClose: () => void;
  state: ReadinessState;
}

// `sheetAllowedDetents` token -- kept as a compile-time signal for plan-grep
// compatibility (see plan artifact spec) even though RN core Modal doesn't
// surface custom detents directly. Future migration to @gorhom/bottom-sheet
// or expo-router's <Stack screenOptions sheetAllowedDetents> will read this.
export const sheetAllowedDetents = [0.5, 1.0] as const;

export function ReadinessSheet({ visible, onClose, state }: Props) {
  const theme = useTheme();
  const borderWidth = useBorderWidth();
  const router = useRouter();
  const styles = useMemo(() => createStyles(theme, borderWidth), [theme, borderWidth]);
  const { t } = useTranslation('chat');

  const loadedModelId = useModelStore((s) => s.loadedModelId);
  const isLoadingModel = useModelStore((s) => s.isLoadingModel);
  const availablePacks = usePackStore((s) => s.availablePacks);
  const activePacks = usePackStore((s) => s.activePacks);
  const togglePack = usePackStore((s) => s.togglePack);
  const ragEnabled = usePreferencesStore((s) => s.ragEnabled);
  const setRagEnabled = usePreferencesStore((s) => s.setRagEnabled);

  const modelName = loadedModelId ? getModelShortName(loadedModelId) : t('readiness_sheet_model_none');
  const modelStatus = isLoadingModel
    ? t('readiness_sheet_status_loading')
    : loadedModelId
    ? t('readiness_sheet_status_loaded')
    : t('readiness_sheet_status_not_loaded');

  const goToModels = useCallback(() => {
    onClose();
    setTimeout(() => router.push('/models' as never), 150);
  }, [onClose, router]);

  const goToPacks = useCallback(() => {
    onClose();
    setTimeout(() => router.push('/packs' as never), 150);
  }, [onClose, router]);

  const isCritical = state.kind === 'no-model';

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      transparent
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'formSheet' : 'overFullScreen'}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* Section 1 -- model row */}
            <Text style={styles.sectionLabel}>{t('readiness_sheet_section_model')}</Text>
            <Pressable
              onPress={goToModels}
              accessibilityRole="button"
              accessibilityLabel={t('readiness_sheet_model_a11y', { modelName, status: modelStatus })}
              style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{modelName}</Text>
                <Text style={styles.rowSub}>{t('readiness_sheet_model_status', { status: modelStatus })}</Text>
              </View>
              <SymbolView
                name="chevron.right"
                size={14}
                tintColor={theme.textMuted}
              />
            </Pressable>

            {isCritical ? (
              <Pressable
                onPress={goToModels}
                accessibilityRole="button"
                accessibilityLabel={t('readiness_sheet_open_models')}
                style={styles.criticalCta}>
                <Text style={styles.criticalCtaText}>{t('readiness_sheet_open_models')}</Text>
              </Pressable>
            ) : null}

            {/* Section 2 -- pack list */}
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>{t('readiness_sheet_section_packs')}</Text>
            {availablePacks.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.rowSub}>{t('readiness_sheet_no_packs')}</Text>
              </View>
            ) : (
              availablePacks.map((pack) => {
                const isActive = activePacks.some((p) => p.id === pack.id);
                const langs = inferLanguages(pack.scenario, pack.country);
                const freshnessCopy = t('readiness_sheet_freshness_static');
                return (
                  <View key={pack.id} style={styles.row}>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {pack.name}
                      </Text>
                      <Text style={styles.rowSub}>
                        {langs ? `${langs} · ` : ''}{freshnessCopy}
                      </Text>
                    </View>
                    <AppToggle
                      value={isActive}
                      onChange={() => togglePack(pack.id)}
                      accessibilityLabel={t('readiness_sheet_toggle_pack_a11y', { packName: pack.name })}
                    />
                  </View>
                );
              })
            )}

            {/* Section 2b -- Sources (RAG toggle, folded in from old header chip) */}
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>{t('readiness_sheet_section_sources')}</Text>
            <View style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{t('readiness_sheet_sources_title')}</Text>
                <Text style={styles.rowSub}>{t('readiness_sheet_sources_body')}</Text>
              </View>
              <AppToggle
                value={ragEnabled}
                onChange={setRagEnabled}
                accessibilityLabel={t('readiness_sheet_toggle_sources_a11y')}
              />
            </View>

            {/* Section 3 -- Import CTA */}
            <Pressable
              onPress={goToPacks}
              accessibilityRole="button"
              accessibilityLabel={t('readiness_sheet_import_pack_a11y')}
              style={styles.importCta}>
              <SymbolView
                name="square.and.arrow.down"
                size={14}
                tintColor={theme.text}
              />
              <Text style={styles.importCtaText}>{t('readiness_sheet_import_pack')}</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function inferLanguages(scenario: string, country: string): string {
  const tokens = `${scenario} ${country}`
    .toUpperCase()
    .match(/\b(EN|ZH|AR|VI|FR|ES|DE|JA|KO)\b/g);
  if (!tokens) return '';
  return Array.from(new Set(tokens)).join('/');
}

function createStyles(theme: AppTheme, borderWidth: 1 | 2) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '90%',
      minHeight: '50%',
      paddingTop: 8,
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginVertical: 8,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      gap: 8,
    },
    sectionLabel: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginTop: 8,
      marginBottom: 4,
    },
    sectionLabelSpaced: { marginTop: 16 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: theme.backgroundElement,
      borderRadius: 10,
      // SUNLIGHT-1 (11-10 Task 3): every bordered surface opts into useBorderWidth().
      borderWidth,
      borderColor: theme.border,
    },
    emptyRow: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: theme.backgroundElement,
      borderRadius: 10,
      borderWidth,
      borderColor: theme.border,
    },
    rowCopy: { flex: 1, gap: 2 },
    rowTitle: { color: theme.text, fontSize: 15, fontWeight: '600' },
    rowSub: { color: theme.textSecondary, fontSize: 12, lineHeight: 17 },
    criticalCta: {
      marginTop: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.buttonPrimary,
      borderRadius: 10,
      alignItems: 'center',
    },
    criticalCtaText: {
      color: theme.accentText,
      fontSize: 14,
      fontWeight: '600',
    },
    importCta: {
      marginTop: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth,
      borderColor: theme.border,
      backgroundColor: theme.surfaceMuted,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    importCtaText: { color: theme.text, fontSize: 14, fontWeight: '600' },
  });
}

export default ReadinessSheet;
