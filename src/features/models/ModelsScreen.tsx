/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * Models screen — download chat and embedding models for the on-device runtimes.
 *
 * Each model row has three states:
 *   Not downloaded → "Download" button (fetches from Hugging Face)
 *   Downloaded, not loaded → on-device status + "Load" button
 *   Loaded → active-session badge
 */
import * as Device from "expo-device";
import * as DocumentPicker from "expo-document-picker";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Spacing, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { RuntimeGate } from "@/components/RuntimeGate";
import {
  AUDIO_SCRIBE_LITERT_MODEL_ID,
  getLiteRtModelPlatformBlockReason,
  getModelRepoUrl,
  isLiteRtModelId,
  requiresHuggingFaceAccess,
} from "@/models/runtime";
import {
  getLiteRtRuntimeUnavailableReason,
  isLiteRtAvailable,
} from "@/providers/litert";
import { isPerceptionAvailable } from "@/services/perception";
import { useModelStore } from "@/store";
import { useModelBenchmarkStore } from "@/store/model-benchmark-store";

// ---------------------------------------------------------------------------
// Model catalogue
// ---------------------------------------------------------------------------

interface ModelEntry {
  id: string;
  label: string;
  size: string;
  ram: string;
  note: string;
  repoUrl?: string;
}

const LITERT_MODELS: ModelEntry[] = [
  {
    id: AUDIO_SCRIBE_LITERT_MODEL_ID,
    label: "Gemma 4 E2B IT",
    size: "1.8 GB",
    ram: "6 GB+",
    note: "Excellent for Audio Scribe and longer voice notes on Android.",
  },
];

const GGUF_MODELS: ModelEntry[] = [
  {
    id: "qwen-3.5-0.8b-it.gguf",
    label: "Qwen 3.5 0.8B IT",
    size: "0.6 GB",
    ram: "2 GB",
    note: "Extremely lightweight. Good for low-memory devices and simple tasks.",
  },
];

const EMBEDDING_MODELS: ModelEntry[] = [
  {
    id: "nomic-ai/nomic-embed-text-v2-moe-GGUF/nomic-embed-text-v2-moe.Q8_0.gguf",
    label: "Nomic Embed Text v2 (MoE)",
    size: "0.5 GB",
    ram: "1.5 GB",
    note: "Required for Knowledge Packs and local document search. Multilingual MoE embedder, 305M active parameters.",
  },
];

// ---------------------------------------------------------------------------
// Screen component
// ---------------------------------------------------------------------------

export default function ModelsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isWeb = Platform.OS === "web";
  const { t } = useTranslation("models");
  const { t: tCommon } = useTranslation("common");

  const {
    loadedModelId,
    loadedEmbeddingModelId,
    isLoaded: modelLoaded,
    loadModel,
    loadEmbeddingModel,
    importModel,
    downloadedModels,
    downloadProgress,
    downloadModel,
    huggingFaceToken: storedToken,
    isHuggingFaceTokenLoaded: storedTokenLoaded,
    hydrateHuggingFaceToken,
    setHuggingFaceToken: saveStoreToken,
    clearHuggingFaceToken: clearStoreToken,
  } = useModelStore();

  const { byModelId } = useModelBenchmarkStore();
  const activeStats = loadedModelId ? byModelId[loadedModelId] : undefined;

  const formattedLoad = activeStats?.loadTimeMs
    ? `${(activeStats.loadTimeMs / 1000).toFixed(1)}s`
    : "N/A";
  const formattedTtft = activeStats?.ttftMs
    ? `${activeStats.ttftMs}ms`
    : "N/A";
  const formattedDecode = activeStats?.decodeTokensPerSecond
    ? `${activeStats.decodeTokensPerSecond.toFixed(1)} t/s`
    : "N/A";

  const isDownloaded = (id: string) => downloadedModels.includes(id);
  const isDownloading = (id: string) =>
    (downloadProgress[id] ?? 0) > 0 && (downloadProgress[id] ?? 0) < 1;

  const totalMemoryBytes = Device.totalMemory ?? null;
  const totalMemoryGb =
    totalMemoryBytes !== null
      ? Math.round((totalMemoryBytes / 1024 ** 3) * 10) / 10
      : null;

  const [huggingFaceToken, setHuggingFaceToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // Multi-stage import progress so the user always sees what's happening.
  // 'reading' covers the silent expo-document-picker cache copy that takes
  // ~10s for multi-GB models. 'confirming' is the Alert.alert window.
  // 'copying' is the destination-side File.copy + validation hash.
  const [importJob, setImportJob] = useState<
    | { modelId: string; fileName?: string; stage: 'reading' | 'confirming' | 'copying' }
    | null
  >(null);
  const [savingToken, setSavingToken] = useState(false);
  const [liteRtAvailable, setLiteRtAvailable] = useState<boolean | null>(null);
  const [perceptionAvailable, setPerceptionAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    void hydrateHuggingFaceToken();
  }, [hydrateHuggingFaceToken]);

  useEffect(() => {
    if (storedTokenLoaded) {
      setHuggingFaceToken(storedToken);
    }
  }, [storedToken, storedTokenLoaded]);

  useEffect(() => {
    void (async () => {
      try {
        const [lrAvailable, pAvailable] = await Promise.all([
          isLiteRtAvailable(),
          isPerceptionAvailable(),
        ]);
        setLiteRtAvailable(lrAvailable);
        setPerceptionAvailable(pAvailable);
      } catch {
        setLiteRtAvailable(false);
        setPerceptionAvailable(false);
      }
    })();
  }, []);

  const activeModelEntry = [...LITERT_MODELS, ...GGUF_MODELS, ...EMBEDDING_MODELS].find(
    (m) => m.id === loadedModelId
  );

  const isAudioScribeCapable = loadedModelId === AUDIO_SCRIBE_LITERT_MODEL_ID;

  const progress = (id: string) => downloadProgress[id] ?? 0;

  const isTokenUiBusy = isWeb || busy !== null || savingToken;
  const liteRtRuntimePending = !isWeb && liteRtAvailable === null;
  const capabilityStatuses: { label: string; ready: boolean }[] = isWeb
    ? []
    : [
        { label: t("capability_chat"), ready: !!loadedModelId && modelLoaded },
        { label: t("capability_ask_image"), ready: perceptionAvailable === true },
        { label: t("capability_ocr"), ready: perceptionAvailable === true },
        {
          label: t("capability_audio_scribe"),
          ready: isAudioScribeCapable && (Platform.OS === "ios" || liteRtAvailable === true),
        },
        { label: t("capability_translation"), ready: !!loadedModelId && modelLoaded },
      ];
  const memoryPressureLabel = getMemoryPressureLabel(activeModelEntry?.ram, totalMemoryGb);

  const handleAccessRedirect = async (item: ModelEntry) => {
    const repoUrl = item.repoUrl ?? getModelRepoUrl(item.id);
    await Linking.openURL(repoUrl);
  };

  const handleImportModel = async (item: ModelEntry) => {
    setBusy(item.id);
    setImportJob({ modelId: item.id, stage: 'reading' });
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/octet-stream", "*/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setImportJob(null);
        setBusy(null);
        return;
      }

      const asset = result.assets[0];
      setImportJob({ modelId: item.id, fileName: asset.name, stage: 'confirming' });
      Alert.alert(
        t("import_model"),
        t("import_dialog_body", { filename: asset.name, label: item.label }),
        [
          {
            text: tCommon("cancel"),
            style: "cancel",
            onPress: () => {
              setImportJob(null);
              setBusy(null);
            },
          },
          {
            text: t("import_confirm"),
            onPress: async () => {
              setImportJob({
                modelId: item.id,
                fileName: asset.name,
                stage: 'copying',
              });
              try {
                await importModel(item.id, asset.uri);
              } catch (error) {
                Alert.alert(t("error_title"), error instanceof Error ? error.message : t("import_failed"));
              } finally {
                setImportJob(null);
                setBusy(null);
              }
            },
          },
        ],
        { onDismiss: () => { setImportJob(null); setBusy(null); } },
      );
    } catch (error) {
      Alert.alert(t("error_title"), error instanceof Error ? error.message : t("import_error"));
      setImportJob(null);
      setBusy(null);
    }
  };

  const handleDownloadModel = async (item: ModelEntry) => {
    if (busy !== null) return;
    setBusy(item.id);
    try {
      await downloadModel(item.id, item.size);
    } catch (error) {
      Alert.alert(t("error_title"), error instanceof Error ? error.message : t("download_error"));
    } finally {
      setBusy(null);
    }
  };

  const handleGetModel = (item: ModelEntry) => {
    if (busy !== null || isWeb) return;
    const gated = requiresHuggingFaceAccess(item.id);

    const download = () => {
      if (gated && !storedTokenLoaded) {
        Alert.alert(t("token_required_dialog_title"), t("token_required_dialog_body"));
        return;
      }
      void handleDownloadModel(item);
    };
    const importLocal = () => void handleImportModel(item);
    const openRepo = () => void handleAccessRedirect(item);

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            tCommon("download"),
            t("import_from_local"),
            t("open_hf_repo"),
            tCommon("cancel"),
          ],
          cancelButtonIndex: 3,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) download();
          if (buttonIndex === 1) importLocal();
          if (buttonIndex === 2) openRepo();
        },
      );
      return;
    }

    Alert.alert(t("get_model"), item.label, [
      { text: tCommon("download"), onPress: download },
      { text: t("import_from_local"), onPress: importLocal },
      { text: t("open_hf_repo"), onPress: openRepo },
      { text: tCommon("cancel"), style: "cancel" },
    ]);
  };

  const handleLoadModel = async (item: ModelEntry, isEmbedding = false) => {
    if (busy !== null) return;
    setBusy(item.id);
    try {
      if (isEmbedding) {
        await loadEmbeddingModel(item.id);
      } else {
        await loadModel(item.id);
      }
    } catch (error) {
      Alert.alert(t("error_title"), error instanceof Error ? error.message : t("load_error"));
    } finally {
      setBusy(null);
    }
  };

  const handleSaveHuggingFaceToken = async () => {
    if (isTokenUiBusy) return;
    setSavingToken(true);
    try {
      await saveStoreToken(huggingFaceToken);
    } catch (error) {
      Alert.alert(t("error_title"), error instanceof Error ? error.message : t("token_error"));
    } finally {
      setSavingToken(false);
    }
  };

  const handleClearHuggingFaceToken = async () => {
    if (isTokenUiBusy) return;
    try {
      await clearStoreToken();
      setHuggingFaceToken("");
    } catch (error) {
      Alert.alert(t("error_title"), error instanceof Error ? error.message : t("token_clear_error"));
    }
  };

  const renderModelCard = (item: ModelEntry, isEmbedding = false) => {
    const isLiteRtEntry = isLiteRtModelId(item.id);
    const loaded = isEmbedding
      ? loadedEmbeddingModelId === item.id
      : loadedModelId === item.id;
    const downloaded = isDownloaded(item.id);
    const isBusy = isDownloading(item.id);
    const prog = progress(item.id);
    const downloading = isBusy && prog > 0 && prog < 1;
    const showDownloadedHint = downloaded && !isEmbedding;
    const downloadedHintText = loaded ? t("downloaded_hint") : t("downloaded_load_hint");
    const loadedBadgeText = isEmbedding ? t("selected") : t("active_now");
    const liteRtPlatformBlockReason = isLiteRtEntry
      ? getLiteRtModelPlatformBlockReason(item.id, Platform.OS)
      : null;
    const liteRtRuntimeBlockReason =
      isLiteRtEntry && !liteRtPlatformBlockReason && liteRtAvailable === false
        ? getLiteRtRuntimeUnavailableReason()
        : null;
    const liteRtUnavailableReason =
      liteRtPlatformBlockReason ?? liteRtRuntimeBlockReason;
    const liteRtChecking = isLiteRtEntry && !liteRtPlatformBlockReason && liteRtRuntimePending;

    return (
      <View
        key={item.id}
        testID={`model-row-${item.id}`}
        style={[styles.card, loaded && styles.cardActive]}>

        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.label}</Text>
          <Text style={styles.cardNote}>{item.note}</Text>
          <Text style={styles.cardMeta}>
            {item.size} · {item.ram}
          </Text>
          {liteRtUnavailableReason ? (
            <Text style={styles.cardWarning}>{liteRtUnavailableReason}</Text>
          ) : null}
          <View style={styles.badgeRow}>
            {isLiteRtEntry && (
              <View key="litert" style={styles.capabilityPill}>
                <Text style={styles.capabilityPillText}>LiteRT</Text>
              </View>
            )}
            {!isLiteRtEntry && (
              <View key="gguf" style={styles.capabilityPill}>
                <Text style={styles.capabilityPillText}>GGUF</Text>
              </View>
            )}
          </View>

          {showDownloadedHint && (
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{downloadedHintText}</Text>
            </View>
          )}

          {downloading && (
            <View style={styles.progressWrap}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(prog * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressPct}>{Math.round(prog * 100)}%</Text>
            </View>
          )}

          {importJob && importJob.modelId === item.id && (
            <View style={styles.importProgress}>
              <ActivityIndicator color={theme.accent} size="small" />
              <View style={styles.importProgressText}>
                <Text style={styles.importProgressTitle}>
                  {importJob.stage === 'reading'
                    ? t("reading_file_progress")
                    : importJob.stage === 'confirming'
                      ? t("confirming_progress")
                      : t("copying_progress")}
                </Text>
                {importJob.fileName ? (
                  <Text style={styles.importProgressMeta} numberOfLines={1}>
                    {importJob.fileName}
                  </Text>
                ) : null}
                {importJob.stage !== 'confirming' ? (
                  <Text style={styles.importProgressMeta}>{t("import_progress_note")}</Text>
                ) : null}
              </View>
            </View>
          )}
        </View>

        {loaded ? (
          <View testID={`model-loaded-${item.id}`} style={styles.badge}>
            <Text style={styles.badgeText}>{loadedBadgeText}</Text>
          </View>
        ) : liteRtUnavailableReason ? (
          <TouchableOpacity
            style={[styles.btn, styles.btnDisabled]}
            disabled
            accessibilityRole="button"
            accessibilityLabel={t("unavailable_a11y", { label: item.label })}
          >
            <Text style={styles.btnText}>{t("unavailable")}</Text>
          </TouchableOpacity>
        ) : liteRtChecking ? (
          <TouchableOpacity
            style={[styles.btn, styles.btnDisabled]}
            disabled
            accessibilityRole="button"
            accessibilityLabel={t("checking_a11y", { label: item.label })}
          >
            <Text style={styles.btnText}>{t("checking")}</Text>
          </TouchableOpacity>
        ) : requiresHuggingFaceAccess(item.id) && !downloaded ? (
          <View style={styles.actionStack}>
            <TouchableOpacity
              style={[styles.btn, styles.btnLink]}
              onPress={() => void handleAccessRedirect(item)}
              disabled={busy !== null || isWeb}
              accessibilityRole="button"
              accessibilityLabel={t("request_access_a11y", { label: item.label })}
            >
              <Text style={styles.btnText}>{isWeb ? t("mobile_only") : t("access")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID={`model-get-${item.id}`}
              style={styles.btn}
              onPress={() => handleGetModel(item)}
              disabled={busy !== null || isWeb}
              accessibilityRole="button"
              accessibilityLabel={t("get_label_a11y", { label: item.label })}
            >
              {busy === item.id ? (
                <ActivityIndicator color={theme.buttonText} size="small" />
              ) : (
                <Text style={styles.btnText}>
                  {isWeb ? t("mobile_only") : t("get_model_arrow")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : !downloaded ? (
          <View style={styles.actionStack}>
            <TouchableOpacity
              testID={`model-get-${item.id}`}
              style={styles.btn}
              onPress={() => handleGetModel(item)}
              disabled={busy !== null || isWeb}
              accessibilityRole="button"
              accessibilityLabel={t("get_label_a11y", { label: item.label })}
            >
              {busy === item.id ? (
                <ActivityIndicator color={theme.buttonText} size="small" />
              ) : (
                <Text style={styles.btnText}>{isWeb ? t("mobile_only") : t("get_model_arrow")}</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            testID={`model-load-${item.id}`}
            style={[styles.btn, downloaded && styles.btnSecondary]}
            onPress={() => void handleLoadModel(item, isEmbedding)}
            disabled={busy !== null || isWeb}
            accessibilityRole="button"
            accessibilityLabel={t("load_label_a11y", { label: item.label })}
          >
            {busy === item.id ? (
              <ActivityIndicator color={theme.buttonText} size="small" />
            ) : (
              <Text style={styles.btnText}>
                {isWeb
                  ? t("mobile_only")
                  : downloaded
                    ? tCommon("load")
                    : tCommon("download")}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (isWeb) {
    return (
      <View style={styles.container}>
        <RuntimeGate featureName={t("feature_name")} />
      </View>
    );
  }

  return (
    <ScrollView
      testID="models-screen"
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Spacing.headerOffset, paddingBottom: insets.bottom + 24 },
      ]}
    >
      {totalMemoryGb !== null && totalMemoryGb < 6 && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningBannerText}>{t("low_ram_warning", { gb: totalMemoryGb })}</Text>
        </View>
      )}

      <Text style={styles.sectionLabel}>{t("system_label")}</Text>
      <View style={styles.badgeRow}>
        {capabilityStatuses.map((capability) => (
          <View
            key={capability.label}
            style={[
              styles.capabilityBadge,
              capability.ready ? styles.capabilityBadgeReady : null,
            ]}
          >
            <Text
              style={[
                styles.capabilityBadgeText,
                capability.ready ? styles.capabilityBadgeReadyText : null,
              ]}
            >
              {capability.label}: {capability.ready ? t("capability_ready") : t("capability_not_ready")}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>{t("active_benchmarks")}</Text>
      <View style={styles.metricsRow}>
        <View style={styles.metricTile}>
          <Text style={styles.metricLabel}>{t("metric_load")}</Text>
          <Text style={styles.metricValue}>{modelLoaded ? formattedLoad : "N/A"}</Text>
        </View>
        <View style={styles.metricTile}>
          <Text style={styles.metricLabel}>{t("metric_ttft")}</Text>
          <Text style={styles.metricValue}>{modelLoaded ? formattedTtft : "N/A"}</Text>
        </View>
        <View style={styles.metricTile}>
          <Text style={styles.metricLabel}>{t("metric_decode")}</Text>
          <Text style={styles.metricValue}>{modelLoaded ? formattedDecode : "N/A"}</Text>
        </View>
        <View style={styles.metricTile}>
          <Text style={styles.metricLabel}>{t("metric_memory")}</Text>
          <Text style={styles.metricValue}>{memoryPressureLabel}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>{t("litert_section")}</Text>
      <Text style={styles.sectionNote}>{t("litert_note")}</Text>

      <View style={styles.accessCard}>
        <Text style={styles.accessTitle}>{t("gated_models_title")}</Text>
        <Text style={styles.accessBody}>{t("gated_models_body")}</Text>
        <TextInput
          style={styles.tokenInput}
          value={huggingFaceToken}
          onChangeText={setHuggingFaceToken}
          placeholder={t("token_placeholder")}
          placeholderTextColor={theme.inputPlaceholder}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isTokenUiBusy}
          onBlur={() => {
            if (huggingFaceToken && !storedTokenLoaded) {
              void handleSaveHuggingFaceToken();
            }
          }}
        />
        <Text style={styles.accessHint}>
          {storedTokenLoaded ? t("token_loaded") : t("token_not_set")}
        </Text>

        <Text style={styles.accessHintMuted}>{t("token_hint")}</Text>

        <View style={styles.accessActions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={handleSaveHuggingFaceToken}
            disabled={isTokenUiBusy}
            accessibilityRole="button"
            accessibilityLabel={t("save_token")}
          >
            <Text style={styles.btnText}>{savingToken ? t("saving_token") : t("save_token")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => void handleClearHuggingFaceToken()}
            disabled={
              isTokenUiBusy || !storedTokenLoaded || !huggingFaceToken
            }
            accessibilityRole="button"
            accessibilityLabel={t("clear_token")}
          >
            <Text style={styles.btnText}>{savingToken ? t("saving_token") : t("clear_token")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnGhost]}
            onPress={() => void Linking.openURL("https://huggingface.co/settings/tokens")}
            disabled={isTokenUiBusy}
            accessibilityRole="button"
            accessibilityLabel={t("get_token_a11y")}
          >
            <Text style={styles.btnText}>{t("get_token")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {LITERT_MODELS.map((m) => renderModelCard(m))}

      <Text style={[styles.sectionLabel, { marginTop: 28 }]}>{t("gguf_section")}</Text>
      <Text style={styles.sectionNote}>{t("gguf_note")}</Text>

      {GGUF_MODELS.map((m) => renderModelCard(m))}

      <Text style={[styles.sectionLabel, { marginTop: 28 }]}>{t("embeddings_section")}</Text>
      <Text style={styles.sectionNote}>{t("embeddings_note")}</Text>

      {EMBEDDING_MODELS.map((m) => renderModelCard(m, true))}
    </ScrollView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: Spacing.three, gap: 12 },
    heading: {
      color: theme.text,
      fontSize: 22,
      fontWeight: "700",
      marginBottom: 4,
    },
    sub: { color: theme.textSecondary, fontSize: 14, lineHeight: 20 },
    sectionLabel: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "800",
      marginTop: 20,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    sectionNote: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 12,
    },

    deviceCard: {
      backgroundColor: theme.backgroundElement,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 10,
    },
    deviceCardTitle: { color: theme.text, fontSize: 16, fontWeight: "600" },
    deviceCardBody: { color: theme.textSecondary, fontSize: 13, lineHeight: 18 },

    warningBanner: {
      backgroundColor: theme.surfaceWarning,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.warningBorder,
    },
    warningBannerText: { color: theme.warningText, fontSize: 13, lineHeight: 18 },

    card: {
      backgroundColor: theme.backgroundElement,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    cardActive: { borderColor: theme.buttonPrimary, borderWidth: 2 },
    cardInfo: { flex: 1, gap: 4 },
    cardName: { color: theme.text, fontSize: 15, fontWeight: "700" },
    cardNote: { color: theme.textSecondary, fontSize: 12, lineHeight: 17 },
    cardMeta: { color: theme.textMuted, fontSize: 11, fontWeight: "600" },
    cardWarning: {
      color: theme.warningText,
      fontSize: 11,
      fontWeight: "600",
      marginTop: 4,
    },

    badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
    capabilityPill: {
      backgroundColor: theme.surfaceMuted,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    capabilityPillText: { color: theme.textSecondary, fontSize: 10, fontWeight: "700" },

    capabilityBadge: {
      backgroundColor: theme.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    capabilityBadgeReady: {
      backgroundColor: theme.surfaceSuccess,
      borderColor: theme.successBorder,
    },
    capabilityBadgeText: { color: theme.textMuted, fontSize: 11, fontWeight: "700" },
    capabilityBadgeReadyText: { color: theme.successText },

    statusPill: {
      marginTop: 6,
      backgroundColor: theme.surfaceInfo,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    statusPillText: { color: theme.accentMutedText, fontSize: 11, fontWeight: "600" },

    accessCard: {
      backgroundColor: theme.backgroundElement,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      gap: 10,
    },
    accessTitle: { color: theme.text, fontSize: 15, fontWeight: "700" },
    accessBody: { color: theme.textSecondary, fontSize: 13, lineHeight: 18 },
    tokenInput: {
      backgroundColor: theme.inputBackground,
      borderColor: theme.inputBorder,
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      color: theme.text,
      fontSize: 14,
    },
    accessHint: { color: theme.textSecondary, fontSize: 12, fontWeight: "600" },
    accessHintMuted: { color: theme.textMuted, fontSize: 11 },
    accessActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },

    progressWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
    progressBar: {
      flex: 1,
      height: 4,
      backgroundColor: theme.surfaceMuted,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressFill: { height: 4, backgroundColor: theme.buttonPrimary, borderRadius: 2 },
    progressPct: {
      color: theme.textSecondary,
      fontSize: 11,
      width: 32,
      textAlign: "right",
    },

    importProgress: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginTop: 10,
      padding: 12,
      borderRadius: 10,
      backgroundColor: theme.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.border,
    },
    importProgressText: {
      flex: 1,
      gap: 2,
    },
    importProgressTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "600",
    },
    importProgressMeta: {
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },

    btn: {
      backgroundColor: theme.buttonPrimary,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minWidth: 80,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    btnLink: { backgroundColor: theme.buttonLink },
    btnSecondary: { backgroundColor: theme.buttonSecondary },
    btnGhost: { backgroundColor: theme.buttonGhost },
    btnDisabled: { backgroundColor: theme.surfaceMuted },
    btnText: { color: theme.buttonText, fontWeight: "600", fontSize: 14 },

    badge: {
      backgroundColor: theme.surfaceSuccess,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.successBorder,
    },
    badgeText: { color: theme.successText, fontSize: 13, fontWeight: "600" },
    metricsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    metricTile: {
      minWidth: 120,
      flex: 1,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
    },
    metricLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    metricValue: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "700",
    },
    actionStack: {
      gap: 8,
    },
  });
}

function getMemoryPressureLabel(ramHint: string | undefined, totalMemoryGb: number | null): string {
  if (!ramHint || totalMemoryGb === null) {
    return "N/A";
  }

  const requiredGb = Number.parseFloat(ramHint);
  if (!Number.isFinite(requiredGb)) {
    return "N/A";
  }

  if (totalMemoryGb >= requiredGb + 4) {
    return "Minimal";
  }
  if (totalMemoryGb >= requiredGb + 1.5) {
    return "Low";
  }
  if (totalMemoryGb >= requiredGb) {
    return "Moderate";
  }
  return "High (Crash risk)";
}
