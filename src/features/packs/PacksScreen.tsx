/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * Packs screen — import and activate knowledge packs already on the device.
 *
 * Import: users can sideload raw .db packs or compressed .oapack.zip archives.
 */
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, type AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isSupportedPackImportFilename } from '@/services/pack-import';
import { readPackLayers, type PackLayer } from '@/services/pack';
import { usePackStore } from '@/store';
import AppToggle from '../../components/primitives/AppToggle';

export default function PacksScreen() {
  const { availablePacks, activePacks, scanPacks, togglePack, importPack, removePack } = usePackStore();

  const [importing, setImporting] = useState(false);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useTranslation('packs');
  const { t: tCommon } = useTranslation('common');

  useEffect(() => {
    void scanPacks();
  }, [scanPacks]);

  const isActive = (id: string) => activePacks.some((pack) => pack.id === id);

  const handleRemove = (id: string, name: string) => {
    Alert.alert(
      t('remove_pack_title'),
      t('remove_pack_body', { name }),
      [
        { text: tCommon('cancel'), style: 'cancel' },
        {
          text: t('remove_dialog_action'),
          style: 'destructive',
          onPress: () => void removePack(id),
        },
      ]
    );
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!isSupportedPackImportFilename(asset.name)) {
        Alert.alert(t('invalid_file_title'), t('invalid_file_body'));
        return;
      }

      await importPack(asset.uri, asset.name);
    } catch (error) {
      Alert.alert(
        t('import_failed_title'),
        error instanceof Error ? error.message : t('import_failed_body')
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Spacing.headerOffset, paddingBottom: insets.bottom + 24 },
      ]}>
      <View style={[styles.sectionRow, styles.sectionRowFirst]}>
        <Text style={[styles.sectionLabel, styles.sectionLabelFill]}>{t('on_device_label')}</Text>
        <TouchableOpacity
          style={styles.importBtn}
          onPress={handleImport}
          disabled={importing}
          accessibilityRole="button"
          accessibilityLabel={importing ? t('importing_pack_a11y') : t('import_pack_a11y')}>
          <Text style={styles.importBtnText}>{importing ? t('importing_pack') : t('import_pack_button')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.formatsNote}>{t('formats_note')}</Text>

      {availablePacks.length === 0 ? (
        <Text style={styles.empty}>{t('empty_state')}</Text>
      ) : (
        availablePacks.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardNote}>{item.scenario}</Text>
              <Text style={styles.cardMeta}>
                {t('chunks_meta', {
                  count: item.chunks,
                  size: item.sizeBytes > 0 ? `${(item.sizeBytes / 1024 / 1024).toFixed(1)} MB` : t('unknown_size'),
                })}
              </Text>
              {isActive(item.id) && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>{t('used_in_chat')}</Text>
                </View>
              )}
              <PackProvenancePanel dbPath={item.dbPath} theme={theme} />
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => handleRemove(item.id, item.name)}
                accessibilityRole="button"
                accessibilityLabel={t('remove_pack_a11y', { name: item.name })}>
                <SymbolView
                  name="trash"
                  size={18}
                  tintColor={theme.textMuted}
                />
              </TouchableOpacity>
              <AppToggle
                value={isActive(item.id)}
                onChange={() => togglePack(item.id)}
                accessibilityRole="switch"
                accessibilityLabel={t('toggle_pack_a11y', { name: item.name })}
              />
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ── Provenance panel ──────────────────────────────────────────────────────────

type PackProvenancePanelProps = {
  dbPath: string;
  theme: AppTheme;
};

function PackProvenancePanel({ dbPath, theme }: PackProvenancePanelProps) {
  const [open, setOpen] = useState(false);
  const [layers, setLayers] = useState<PackLayer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { t } = useTranslation('packs');

  const handleToggle = async () => {
    if (!loaded) {
      const result = await readPackLayers(dbPath);
      setLayers(result);
      setLoaded(true);
    }
    setOpen((prev) => !prev);
  };

  const s = provStyles(theme);

  const hasProvenance = layers.some(
    (l) => l.publisher || l.license || l.language || l.reviewed_at || l.expires_at
  );

  return (
    <View style={s.wrapper}>
      <TouchableOpacity
        onPress={handleToggle}
        style={s.toggle}
        accessibilityRole="button"
        accessibilityLabel={open ? t('hide_provenance_a11y') : t('show_provenance_a11y')}>
        <Text style={s.toggleText}>
          {open ? `▾ ${t('source_provenance')}` : `▸ ${t('source_provenance')}`}
        </Text>
      </TouchableOpacity>

      {open && (
        <View style={s.panel}>
          {layers.length === 0 ? (
            <Text style={s.empty}>{t('no_layer_info')}</Text>
          ) : !hasProvenance ? (
            <Text style={s.empty}>{t('no_provenance')}</Text>
          ) : (
            layers.map((layer) => (
              <View key={layer.name} style={s.layerRow}>
                <Text style={s.layerName}>{layer.name}</Text>
                {layer.publisher ? <ProvenanceField label={t('provenance_publisher')} value={layer.publisher} theme={theme} /> : null}
                {layer.license ? <ProvenanceField label={t('provenance_licence')} value={layer.license} theme={theme} /> : null}
                {layer.language ? <ProvenanceField label={t('provenance_language')} value={layer.language} theme={theme} /> : null}
                {layer.reviewed_at ? (
                  <ProvenanceField label={t('provenance_reviewed')} value={formatDate(layer.reviewed_at)} theme={theme} />
                ) : null}
                {layer.expires_at ? (
                  <ProvenanceField
                    label={t('provenance_expires')}
                    value={formatDate(layer.expires_at)}
                    theme={theme}
                    warn={isExpired(layer.expires_at)}
                  />
                ) : null}
                {layer.cultural_sensitivity && layer.cultural_sensitivity !== 'none' ? (
                  <ProvenanceField label={t('provenance_sensitivity')} value={layer.cultural_sensitivity} theme={theme} warn />
                ) : null}
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

function ProvenanceField({
  label,
  value,
  theme,
  warn = false,
}: {
  label: string;
  value: string;
  theme: AppTheme;
  warn?: boolean;
}) {
  const s = provStyles(theme);
  return (
    <View style={s.fieldRow}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={[s.fieldValue, warn && s.fieldValueWarn]}>{value}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function isExpired(iso: string): boolean {
  try {
    return new Date(iso) < new Date();
  } catch {
    return false;
  }
}

function provStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrapper: { marginTop: 8 },
    toggle: { paddingVertical: 4, minHeight: 32, justifyContent: 'center' },
    toggleText: { color: theme.textSecondary, fontSize: 12, fontWeight: '600' },
    panel: {
      marginTop: 6,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: 10,
    },
    layerRow: { gap: 2 },
    layerName: { color: theme.text, fontSize: 12, fontWeight: '700', marginBottom: 2 },
    fieldRow: { flexDirection: 'row', gap: 6 },
    fieldLabel: { color: theme.textMuted, fontSize: 11, width: 68 },
    fieldValue: { color: theme.textSecondary, fontSize: 11, flex: 1 },
    fieldValueWarn: { color: theme.warningText },
    empty: { color: theme.textMuted, fontSize: 12 },
  });
}

// ─────────────────────────────────────────────────────────────────────────────

function createStyles(theme: AppTheme) {
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
    sectionLabelFill: { flex: 1 },
    sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 28, marginBottom: 10 },
    sectionRowFirst: { marginTop: 0 },
    card: {
      backgroundColor: theme.backgroundElement,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardInfo: { flex: 1 },
    cardName: { color: theme.text, fontSize: 15, fontWeight: '600' },
    cardNote: { color: theme.textSecondary, fontSize: 13, marginBottom: 2 },
    cardMeta: { color: theme.textMuted, fontSize: 12 },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    removeBtn: { padding: 4, minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
    activeBadge: {
      alignSelf: 'flex-start',
      marginTop: 8,
      backgroundColor: theme.surfaceInfo,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: theme.accentStrong,
    },
    activeBadgeText: { color: theme.accentMutedText, fontSize: 11, fontWeight: '600' },
    importBtn: {
      borderWidth: 1,
      borderColor: theme.borderStrong,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      minHeight: 44,
      justifyContent: 'center',
      backgroundColor: theme.backgroundElement,
    },
    importBtnText: { color: theme.textSecondary, fontSize: 13 },
    formatsNote: { color: theme.textMuted, fontSize: 12, marginBottom: 14 },
    empty: { color: theme.textMuted, textAlign: 'center', marginTop: 20, lineHeight: 20 },
  });
}
