/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import * as DocumentPicker from 'expo-document-picker';
import { Stack, useRouter } from 'expo-router';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File } from 'expo-file-system';

import { RuntimeGate } from '@/components/RuntimeGate';
import { Spacing, type AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLLM, type ChatMessage } from '@/hooks/useLLM';
import { getModelDisplayName, supportsAudioScribe } from '@/models/runtime';
import { generateLiteRtAudioResponse } from '@/providers/litert';
import {
  getPerceptionCapabilities,
  transcribeAudio,
  transcribeAudioWithOutcome,
  type PerceptionCapabilities,
} from '@/services/perception';
import {
  useAudioScribeStore,
  useChatDraftStore,
  useModelStore,
  usePreferencesStore,
} from '@/store';

const TRANSCRIBE_PROMPT =
  'Transcribe the spoken audio faithfully. Preserve the original language. Return only the transcript with punctuation and no explanation.';

type ScribeResultMode = 'transcript' | 'english' | 'system';

// Audio Scribe input path. 'gemma' = on-device LLM transcription
// (currently Gemma 4 E2B-it via LiteRT-LM). 'system' = the platform's
// native speech engine (Android Speech / Apple Speech). Path is chosen
// explicitly per session; there is no silent fallback between the two.
type ScribePath = 'gemma' | 'system';

// Friendly display names for the 'system' tab when the user's preferred locale
// is not English. Falls back to the BCP-47 language portion when no entry
// exists; suppresses entirely (returns null) when the locale resolves to
// English (the System tab would duplicate the Transcript+English tabs).
const LOCALE_FRIENDLY_NAMES = new Map<string, string>([
  ['zh', '中文'],
  ['zh-cn', '中文'],
  ['zh-hk', '中文'],
  ['zh-tw', '中文'],
  ['ar', 'العربية'],
  ['vi', 'Tiếng Việt'],
  ['es', 'Español'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['hi', 'हिन्दी'],
  ['id', 'Bahasa'],
  ['pt', 'Português'],
  ['ru', 'Русский'],
]);

function localeDisplayName(bcp47: string): string | null {
  const lower = bcp47.toLowerCase();
  if (lower.startsWith('en')) {
    return null;
  }
  const exact = LOCALE_FRIENDLY_NAMES.get(lower);
  if (exact) {
    return exact;
  }
  const lang = lower.split('-')[0];
  return LOCALE_FRIENDLY_NAMES.get(lang) ?? lang;
}

function formatBytes(size: number | null): string {
  if (!size || size <= 0) {
    return 'Unknown size';
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(durationMillis: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const METER_BAR_COUNT = 32;
const METER_BAR_HEIGHT = 24;
// Map dBFS metering values (typically -60..0 for normal speech) to a 0..1
// height factor. The 0..1 result drives a transform: scaleY (GPU-accelerated,
// no layout thrash). dBFS clamping at -60 gives the calmest baseline; the
// recorder occasionally emits very-low values down to -160 which we fold
// to silence rather than letting the bars show one tall outlier.
function dbfsToScale(db: number | undefined | null): number {
  if (db == null || !Number.isFinite(db)) return 0.08;
  const clamped = Math.max(-60, Math.min(0, db));
  return Math.max(0.08, (clamped + 60) / 60);
}

interface RecordingMeterProps {
  amplitudes: number[]; // newest sample at the end
  color: string;
}

const RecordingMeter = ({ amplitudes, color }: RecordingMeterProps) => {
  // 32-bar soft-rounded amplitude meter. Same color token as the
  // recordingDot it grows out of (theme.buttonPrimary). scaleY-only
  // animation keeps this on the GPU; the bars never trigger a layout
  // pass even at 10 fps update rate.
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: METER_BAR_HEIGHT,
        gap: 2,
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {Array.from({ length: METER_BAR_COUNT }, (_, i) => {
        const db = amplitudes[i];
        const scale = dbfsToScale(db);
        return (
          <View
            key={i}
            style={{
              width: 3,
              height: METER_BAR_HEIGHT,
              borderRadius: 1.5,
              backgroundColor: color,
              transform: [{ scaleY: scale }],
            }}
          />
        );
      })}
    </View>
  );
};

export default function AudioScribeScreen() {
  const { t } = useTranslation('scribe');
  const { t: tErrors } = useTranslation('errors');
  const [resultText, setResultText] = useState('');
  const [resultMode, setResultMode] = useState<ScribeResultMode>('transcript');
  const [cachedTranscript, setCachedTranscript] = useState('');
  const [cachedEnglish, setCachedEnglish] = useState('');
  const [cachedSystem, setCachedSystem] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showAndroidSpeechGuide, setShowAndroidSpeechGuide] = useState(false);
  const [perceptionCaps, setPerceptionCaps] = useState<PerceptionCapabilities | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPreparingRecording, setIsPreparingRecording] = useState(false);
  // Per-result attribution. PRODUCT.md principle #1 (show the source) +
  // principle #5 (perf transparency). Captured once per run; rendered as a
  // single tabular-nums line below the result body, matching the chat
  // perfFooter grammar exactly.
  type ResultAttribution = {
    source: string;
    ttftMs: number | null;
    tokps: number | null;
    elapsedSec: number | null;
  };
  const [resultAttribution, setResultAttribution] = useState<ResultAttribution | null>(null);
  // Live amplitude meter state. FIFO of 32 dBFS samples; rightmost is
  // newest. Reset to silence on recording start so a previous run's
  // levels do not flash into a fresh recording.
  const [meterAmplitudes, setMeterAmplitudes] = useState<number[]>(() =>
    Array.from({ length: METER_BAR_COUNT }, () => -60),
  );
  // Live perf telemetry surfaced during AI Scribe streaming. Mirrors the
  // chat header's perfChip grammar (`{ttft} ms · {tokps} tok/s`) so the
  // two surfaces feel like the same product, and gives the demo-video
  // moment a real ticker rather than a static post-hoc label.
  const [livePerf, setLivePerf] = useState<{
    ttftMs: number | null;
    tokps: number | null;
  } | null>(null);
  // Explicit input-path selection. Default-selected from the user's
  // preference (factory: Gemma 4 E2B); the Audio Scribe screen reads on
  // mount and lets the user override per session via the path selector.
  // Per-session override does NOT write back to preferences — re-entering
  // the screen resets to the setting default.
  const [selectedPath, setSelectedPath] = useState<ScribePath>('gemma');
  const userOverrodePathRef = useRef(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { generate } = useLLM();
  // Spread HIGH_QUALITY and enable metering so the live amplitude meter
  // can read recorderState.metering (dBFS, typically -160..0). The native
  // module emits status updates roughly every 100 ms which is sufficient
  // for a perceptual meter at this scale.
  const audioRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(audioRecorder);
  const isRecordingRef = useRef(false);
  const pickedClip = useAudioScribeStore((s) => s.currentClip);
  const saveClip = useAudioScribeStore((s) => s.saveClip);
  const clearClip = useAudioScribeStore((s) => s.clearClip);
  const loadedModelId = useModelStore((s) => s.loadedModelId);
  const modelLoaded = useModelStore((s) => s.isLoaded);
  const setPendingDraft = useChatDraftStore((s) => s.setPendingDraft);
  const audioScribeDefaultModelId = usePreferencesStore((s) => s.audioScribeDefaultModelId);
  const isAndroid = Platform.OS === 'android';
  const isIOS = Platform.OS === 'ios';
  const appleTranscriptionReady = isIOS;
  const audioReady =
    isAndroid && modelLoaded && typeof loadedModelId === 'string' && supportsAudioScribe(loadedModelId);
  const androidNativeSpeechReady = isAndroid && perceptionCaps?.canTranscribeAudio === true;
  // Path-readiness flags consumed by the path selector and runScribe.
  // gemmaReady: the user-preferred audio model is loaded and audio-capable.
  // nativeReady: the platform's native speech engine is available.
  const gemmaReady = audioReady;
  const nativeReady = isAndroid ? androidNativeSpeechReady : appleTranscriptionReady;
  const transcriptionReady = gemmaReady || nativeReady;
  const translationReady = isAndroid ? audioReady || modelLoaded : modelLoaded;
  const audioScribeModelDisplayName = getModelDisplayName(audioScribeDefaultModelId);
  const nativeEngineDisplayName = isAndroid ? 'Android Speech' : 'Apple Speech';
  const recordingBusy = isPreparingRecording || recorderState.isRecording;
  const preferredLocale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';

  useEffect(() => {
    isRecordingRef.current = recorderState.isRecording;
  }, [recorderState.isRecording]);

  // Reset the meter FIFO when recording starts so the bars don't carry
  // amplitude history across sessions.
  useEffect(() => {
    if (recorderState.isRecording) {
      setMeterAmplitudes(Array.from({ length: METER_BAR_COUNT }, () => -60));
    }
  }, [recorderState.isRecording]);

  // Sliding-window FIFO fed by the recorder's metering callback. Each
  // status update from expo-audio lands here and pushes one new sample
  // into the rightmost slot. ~10 fps native update rate is plenty for
  // a perceptual meter; we don't add our own setInterval.
  useEffect(() => {
    if (!recorderState.isRecording) return;
    const next = recorderState.metering;
    if (next == null || !Number.isFinite(next)) return;
    setMeterAmplitudes((prev) => {
      const out = prev.slice(1);
      out.push(next);
      return out;
    });
  }, [recorderState.isRecording, recorderState.metering]);

  // Auto-default the selected path based on availability — but only when
  // the user has not explicitly overridden it this session. Gemma is the
  // factory default per `project_promote_gemma4_pre_submission.md`. This
  // effect intentionally does NOT clobber a user-chosen 'system' override
  // when Gemma later becomes ready mid-session (anti-goal: surprising the
  // user mid-task).
  useEffect(() => {
    if (userOverrodePathRef.current) return;
    if (gemmaReady) {
      setSelectedPath('gemma');
    } else if (nativeReady) {
      setSelectedPath('system');
    }
  }, [gemmaReady, nativeReady]);

  // Path change invalidates all cached transcripts/translations because
  // a Gemma transcript and a native-speech transcript of the same clip
  // are different artefacts. Auditability requires the on-screen result
  // and the displayed source to agree by construction. Skip on initial
  // mount so we don't clobber a clip the user just imported.
  const isInitialPathMountRef = useRef(true);
  useEffect(() => {
    if (isInitialPathMountRef.current) {
      isInitialPathMountRef.current = false;
      return;
    }
    setCachedTranscript('');
    setCachedEnglish('');
    setCachedSystem('');
    setResultText('');
    setResultAttribution(null);
    setErrorText(null);
    setShowAndroidSpeechGuide(false);
  }, [selectedPath]);

  const handlePathChange = (next: ScribePath) => {
    userOverrodePathRef.current = true;
    setSelectedPath(next);
  };

  useEffect(() => {
    if (!pickedClip) {
      return;
    }
    if (!new File(pickedClip.uri).exists) {
      void clearClip();
    }
  }, [clearClip, pickedClip]);

  useEffect(() => {
    return () => {
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (isRecordingRef.current) {
        try {
          void audioRecorder.stop().catch(() => {});
        } catch {
          // The native recorder object may already be released during route teardown.
        }
      }
    };
  }, [audioRecorder]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const caps = await getPerceptionCapabilities();
        if (!cancelled) {
          setPerceptionCaps(caps);
        }
      } catch {
        if (!cancelled) {
          setPerceptionCaps(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePickAudio = async () => {
    setErrorText(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    try {
      await saveClip({
        name: asset.name,
        source: 'imported',
        sourceUri: asset.uri,
      });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : t('save_clip_error'));
      return;
    }
    setResultText('');
    setCachedTranscript('');
    setCachedEnglish('');
    setCachedSystem('');
    setResultAttribution(null);
    setShowAndroidSpeechGuide(false);
  };

  const handleStartRecording = async () => {
    if (Platform.OS === 'web') {
      setErrorText(t('web_only_error'));
      return;
    }

    if (recordingBusy) {
      return;
    }

    setErrorText(null);
    setIsPreparingRecording(true);

    try {
      const permissions = await requestRecordingPermissionsAsync();
      if (!permissions.granted) {
        setErrorText(t('mic_permission_error'));
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setResultText('');
      setResultAttribution(null);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : t('recording_failed'));
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    } finally {
      setIsPreparingRecording(false);
    }
  };

  const handleStopRecording = async () => {
    if (!recorderState.isRecording) {
      return;
    }

    setIsPreparingRecording(true);
    setErrorText(null);

    try {
      await audioRecorder.stop();
      const nextUri = audioRecorder.uri ?? recorderState.url;
      if (!nextUri) {
        throw new Error(t('recording_no_file'));
      }

      await saveClip({
        name: nextUri.split('/').pop() ?? `offlineaid-recording${RecordingPresets.HIGH_QUALITY.extension}`,
        source: 'recorded',
        sourceUri: nextUri,
      });
      setResultText('');
      setCachedTranscript('');
      setCachedEnglish('');
      setCachedSystem('');
      setResultAttribution(null);
      setShowAndroidSpeechGuide(false);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : t('finish_recording_error'));
    } finally {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      setIsPreparingRecording(false);
    }
  };

  const runAiScribe = async (prompt: string) => {
    if (!loadedModelId || !audioReady) {
      throw new Error(t('load_ai_scribe_model_error'));
    }
    if (!pickedClip) {
      throw new Error(t('import_or_record_error'));
    }
    let transcript = '';
    let tokenCount = 0;
    let ttftMs: number | null = null;
    const startedAt = Date.now();
    setLivePerf({ ttftMs: null, tokps: null });
    await generateLiteRtAudioResponse(loadedModelId, pickedClip.uri, prompt, (token) => {
      if (ttftMs == null) {
        ttftMs = Date.now() - startedAt;
      }
      tokenCount += 1;
      transcript += token;
      setResultText(transcript);
      // Update the live ticker every token. tokps uses elapsed-since-
      // first-token to match the chat header's perfChip grammar (decode
      // throughput, excluding TTFT).
      const elapsedSinceFirstTokenSec = ttftMs != null
        ? Math.max(0.001, (Date.now() - startedAt - ttftMs) / 1000)
        : 0;
      const tokps =
        elapsedSinceFirstTokenSec > 0 ? tokenCount / elapsedSinceFirstTokenSec : null;
      setLivePerf({ ttftMs, tokps });
    });
    const elapsedSec = (Date.now() - startedAt) / 1000;
    const elapsedSinceFirstTokenSec = ttftMs != null
      ? Math.max(0.001, (Date.now() - startedAt - ttftMs) / 1000)
      : elapsedSec;
    const tokps = elapsedSinceFirstTokenSec > 0 ? tokenCount / elapsedSinceFirstTokenSec : null;
    setResultAttribution({
      source: getModelDisplayName(loadedModelId),
      ttftMs,
      tokps,
      elapsedSec,
    });
    return transcript.trim();
  };

  const runScribe = async (mode: ScribeResultMode) => {
    if (recorderState.isRecording) {
      setErrorText(t('transcribe_error_still_recording'));
      return;
    }
    if (!pickedClip) {
      setErrorText(t('no_clip_error'));
      return;
    }

    setIsRunning(true);
    setErrorText(null);
    setShowAndroidSpeechGuide(false);
    setResultMode(mode);
    setResultAttribution(null);
    setLivePerf(null);

    const applyMode = (transcript: string, english: string, system: string) => {
      setCachedTranscript(transcript);
      setCachedEnglish(english);
      setCachedSystem(system);
      if (mode === 'transcript') {
        setResultText(transcript);
      } else if (mode === 'english') {
        setResultText(english || transcript);
      } else {
        setResultText(system || transcript);
      }
    };

    // Path-explicit transcription, no silent fallback. The transcript
    // source is whatever the user has selected; if it fails, we show an
    // error and the in-screen UI offers an explicit "Try X instead"
    // button. Translation always uses the loaded chat model regardless
    // of the chosen transcript source.
    const translateTranscript = async (
      transcript: string,
      target: 'english' | 'system',
    ): Promise<string> => {
      const directive =
        target === 'english'
          ? 'Translate the transcript into English. Return only the English translation with punctuation and no explanation.'
          : `Translate the transcript into ${preferredLocale}. Return only the translation with punctuation and no explanation.`;
      const messages: ChatMessage[] = [
        { role: 'system', content: directive },
        { role: 'user', content: transcript },
      ];
      let out = '';
      await generate(messages, (token) => {
        out += token;
        setResultText(out);
      });
      return out.trim();
    };

    try {
      let baseTranscript: string;

      if (selectedPath === 'system') {
        if (isAndroid) {
          if (!androidNativeSpeechReady) {
            throw new Error(t('android_speech_unavailable'));
          }
          const nativeStart = Date.now();
          const outcome = await transcribeAudioWithOutcome(pickedClip.uri, preferredLocale);
          if (outcome.source !== 'native' || !outcome.text) {
            setShowAndroidSpeechGuide(true);
            throw new Error(t('android_speech_transcribe_failed'));
          }
          baseTranscript = outcome.text;
          setResultAttribution({
            source: 'Android Speech',
            ttftMs: null,
            tokps: null,
            elapsedSec: (Date.now() - nativeStart) / 1000,
          });
        } else if (isIOS) {
          if (!appleTranscriptionReady) {
            throw new Error(t('apple_speech_unavailable'));
          }
          const appleStart = Date.now();
          baseTranscript = await transcribeAudio(pickedClip.uri, preferredLocale);
          setResultAttribution({
            source: 'Apple Speech',
            ttftMs: null,
            tokps: null,
            elapsedSec: (Date.now() - appleStart) / 1000,
          });
        } else {
          throw new Error(t('audio_only_error'));
        }
      } else {
        // selectedPath === 'gemma'
        if (!gemmaReady) {
          throw new Error(t('load_ai_scribe_named_model', { modelName: audioScribeModelDisplayName }));
        }
        baseTranscript = await runAiScribe(TRANSCRIBE_PROMPT);
        // runAiScribe already sets resultAttribution.
      }

      if (mode === 'transcript') {
        applyMode(baseTranscript, '', '');
        return;
      }

      if (mode === 'english') {
        if (!translationReady) {
          throw new Error(t('load_chat_model_for_english'));
        }
        const english = await translateTranscript(baseTranscript, 'english');
        applyMode(baseTranscript, english, '');
        return;
      }

      // mode === 'system'
      if (!modelLoaded) {
        throw new Error(t('load_chat_model_for_system'));
      }
      const systemOut = await translateTranscript(baseTranscript, 'system');
      applyMode(baseTranscript, '', systemOut);
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : t('process_clip_error'),
      );
    } finally {
      setIsRunning(false);
      setLivePerf(null);
    }
  };

  const handleResultModeChange = (next: ScribeResultMode) => {
    setResultMode(next);
    setErrorText(null);
    if (next === 'transcript' && cachedTranscript) {
      setResultText(cachedTranscript);
      return;
    }
    if (next === 'english') {
      if (cachedEnglish) {
        setResultText(cachedEnglish);
        return;
      }
      if (cachedTranscript && translationReady) {
        void (async () => {
          setIsRunning(true);
          try {
            const translationMessages: ChatMessage[] = [
              {
                role: 'system',
                content:
                  'Translate the transcript into English. Return only the English translation with punctuation and no explanation.',
              },
              { role: 'user', content: cachedTranscript },
            ];
            let translation = '';
            await generate(translationMessages, (token) => {
              translation += token;
              setResultText(translation);
            });
            setCachedEnglish(translation.trim());
          } catch (error) {
            setErrorText(
              error instanceof Error ? error.message : t('english_translation_error')
            );
          } finally {
            setIsRunning(false);
          }
        })();
        return;
      }
    }
    if (next === 'system') {
      if (cachedSystem) {
        setResultText(cachedSystem);
        return;
      }
      if (cachedTranscript && modelLoaded) {
        void (async () => {
          setIsRunning(true);
          try {
            const systemMessages: ChatMessage[] = [
              {
                role: 'system',
                content: `Translate the transcript into ${preferredLocale}. Return only the translation with punctuation and no explanation.`,
              },
              { role: 'user', content: cachedTranscript },
            ];
            let systemOut = '';
            await generate(systemMessages, (token) => {
              systemOut += token;
              setResultText(systemOut);
            });
            setCachedSystem(systemOut.trim());
          } catch (error) {
            setErrorText(
              error instanceof Error ? error.message : t('system_translation_error')
            );
          } finally {
            setIsRunning(false);
          }
        })();
        return;
      }
    }
    void runScribe(next);
  };

  const resultLabelForChat =
    resultMode === 'english'
      ? t('label_english_translation')
      : resultMode === 'system'
        ? t('label_system_translation')
        : t('format_transcript');

  const handleSendToChat = () => {
    if (!resultText.trim()) {
      return;
    }
    const draft = `Could this be a scam? What are the warning signs, and what should I do? Use the offline reference material to ground your answer.

For context, here is the ${resultLabelForChat.toLowerCase()} of a message I received:

${resultText.trim()}`;
    setPendingDraft(draft);
    router.navigate('/(tabs)/(index)' as never);
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <RuntimeGate featureName={t('feature_name')} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.headerOffset, paddingBottom: insets.bottom + 24 },
        ]}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('clip_section')}</Text>
        <Text style={styles.cardBody}>{t('clip_body')}</Text>
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              (isRunning || isPreparingRecording) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            disabled={isRunning || isPreparingRecording}
            onPress={() => {
              void (recorderState.isRecording ? handleStopRecording() : handleStartRecording());
            }}
            accessibilityRole="button"
            accessibilityLabel={recorderState.isRecording ? t('stop_recording') : t('record_in_app')}>
            <Text style={styles.primaryButtonText}>
              {recorderState.isRecording ? t('stop_recording') : t('record_in_app')}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              (isRunning || recorderState.isRecording || isPreparingRecording) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            disabled={isRunning || recorderState.isRecording || isPreparingRecording}
            onPress={() => {
              void handlePickAudio();
            }}
            accessibilityRole="button"
            accessibilityLabel={pickedClip ? t('replace_imported') : t('import_audio')}>
            <Text style={styles.secondaryButtonText}>
              {pickedClip ? t('replace_imported') : t('import_audio')}
            </Text>
          </Pressable>
        </View>

        {recorderState.isRecording || isPreparingRecording ? (
          <View style={styles.recordingStatus}>
            {recorderState.isRecording ? (
              // Live amplitude meter — 32 soft-rounded bars in
              // theme.buttonPrimary. Same color token as the dot it
              // replaces during active recording, so the visual
              // continuity reads as "the recording dot grew up".
              <RecordingMeter
                amplitudes={meterAmplitudes}
                color={theme.buttonPrimary}
              />
            ) : (
              <View style={styles.recordingDot} />
            )}
            <Text style={styles.recordingText}>
              {recorderState.isRecording
                ? t('recording_status', { duration: formatDuration(recorderState.durationMillis) })
                : t('preparing_recorder')}
            </Text>
          </View>
        ) : null}

        {pickedClip ? (
          <View style={styles.clipSummary}>
            <View style={styles.clipSummaryRow}>
              <View style={styles.clipSummaryText}>
                <Text style={styles.clipName} numberOfLines={1} ellipsizeMode="middle">
                  {pickedClip.name}
                </Text>
                <Text style={styles.clipMeta}>
                  {pickedClip.source === 'recorded' ? t('recorded_in_app') : t('imported_clip')} ·{' '}
                  {formatBytes(pickedClip.size)}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.clipDeleteButton,
                  pressed && styles.clipDeleteButtonPressed,
                ]}
                onPress={() => {
                  void clearClip();
                  setResultText('');
                  setCachedTranscript('');
                  setCachedEnglish('');
                  setCachedSystem('');
                  setErrorText(null);
                  setResultMode('transcript');
                }}
                accessibilityRole="button"
                accessibilityLabel={t('remove_clip')}>
                <Text style={styles.clipDeleteButtonText}>{t('remove_clip')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {/* Path selector. When both engines are ready, the user picks
          explicitly between Gemma 4 (multilingual on-device LLM) and the
          platform's native speech engine. PRODUCT.md principle #1
          ("show the source") + zero silent fallback either direction.
          When only one is ready, this slot becomes a static label. When
          neither is, we surface the Open-Models call to action. */}
      <View style={styles.statusNotice}>
        {gemmaReady && nativeReady ? (
          <>
            <View style={styles.pathSelectorRow}>
              <Pressable
                style={[
                  styles.pathPill,
                  selectedPath === 'gemma' && styles.pathPillActive,
                ]}
                onPress={() => handlePathChange('gemma')}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedPath === 'gemma' }}
                accessibilityLabel={`Use ${audioScribeModelDisplayName}`}>
                <Text
                  style={[
                    styles.pathPillText,
                    selectedPath === 'gemma' && styles.pathPillTextActive,
                  ]}>
                  {audioScribeModelDisplayName}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.pathPill,
                  selectedPath === 'system' && styles.pathPillActive,
                ]}
                onPress={() => handlePathChange('system')}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedPath === 'system' }}
                accessibilityLabel={`Use ${nativeEngineDisplayName}`}>
                <Text
                  style={[
                    styles.pathPillText,
                    selectedPath === 'system' && styles.pathPillTextActive,
                  ]}>
                  {nativeEngineDisplayName}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.statusNoticeHint}>
              {selectedPath === 'gemma'
                ? t('path_hint_gemma', { modelName: audioScribeModelDisplayName })
                : t('path_hint_system', { engineName: nativeEngineDisplayName })}
            </Text>
          </>
        ) : gemmaReady ? (
          <Text style={styles.statusNoticeHeadline}>
            {t('engine_ready', { engine: audioScribeModelDisplayName })}
          </Text>
        ) : nativeReady ? (
          <>
            <Text style={styles.statusNoticeHeadline}>
              {t('engine_ready', { engine: nativeEngineDisplayName })}
            </Text>
            <Text style={styles.statusNoticeHint}>
              {t('speech_hint_load_model', { modelName: audioScribeModelDisplayName })}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.statusNoticeHeadline}>{t('speech_engine_unavailable')}</Text>
            <Text style={styles.statusNoticeHint}>
              {t('speech_engine_unavailable_hint', { modelName: audioScribeModelDisplayName })}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              onPress={() => router.navigate('/models' as never)}
              accessibilityRole="button"
              accessibilityLabel={tErrors('open_models')}>
              <Text style={styles.secondaryButtonText}>{tErrors('open_models')}</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Format selector + result + send. One card, top-to-bottom in the
          order the user uses them. Tapping a segment switches the view if
          the format is cached, or runs it on-device if not. */}
      <View style={styles.card}>
        {(() => {
          // Locale-aware System tab. Drop when the resolved locale is English
          // (would duplicate Transcript+English) and otherwise show the
          // friendly language name (e.g. 中文, العربية, Tiếng Việt) so a
          // non-technical user reads the destination language directly.
          const systemLocaleLabel = localeDisplayName(preferredLocale);
          const formats: {
            value: ScribeResultMode;
            label: string;
            disabled: boolean;
            a11y: string;
          }[] = [
            {
              value: 'transcript',
              label: t('format_transcript'),
              disabled:
                !pickedClip ||
                (cachedTranscript.length === 0 && !transcriptionReady) ||
                recordingBusy,
              a11y: t('format_transcript_a11y'),
            },
            {
              value: 'english',
              label: t('format_english'),
              disabled:
                !pickedClip ||
                (cachedEnglish.length === 0 && !cachedTranscript && !translationReady) ||
                recordingBusy,
              a11y: t('format_english_a11y'),
            },
            ...(systemLocaleLabel
              ? [
                  {
                    value: 'system' as ScribeResultMode,
                    label: systemLocaleLabel,
                    disabled:
                      !pickedClip ||
                      (cachedSystem.length === 0 && !cachedTranscript && !modelLoaded) ||
                      recordingBusy,
                    a11y: t('format_language_a11y', { language: systemLocaleLabel }),
                  },
                ]
              : []),
          ];
          return (
            <View style={styles.segmentRow}>
              {formats.map((fmt) => {
                const active = resultMode === fmt.value;
                const showSpinner = isRunning && active;
                return (
                  <Pressable
                    key={fmt.value}
                    style={[
                      styles.segmentBtn,
                      active && styles.segmentBtnActive,
                      fmt.disabled && styles.segmentBtnDisabled,
                    ]}
                    disabled={fmt.disabled || isRunning}
                    onPress={() => handleResultModeChange(fmt.value)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active, disabled: fmt.disabled }}
                    accessibilityLabel={fmt.a11y}>
                    {showSpinner ? (
                      <ActivityIndicator size="small" color={theme.text} />
                    ) : (
                      <Text
                        style={[
                          styles.segmentBtnText,
                          active && styles.segmentBtnTextActive,
                        ]}>
                        {fmt.label}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          );
        })()}

        {/* Live perf ticker during AI Scribe streaming. Same chrome and
            grammar as the chat header's perfChip (`{ttft} ms · {tokps}
            tok/s`) so the two surfaces feel like the same product. Only
            renders when Gemma is the chosen path and tokens are flowing. */}
        {isRunning && selectedPath === 'gemma' && livePerf ? (
          <View
            style={styles.livePerfChip}
            accessibilityLabel={t('live_perf_a11y')}>
            <Text style={styles.livePerfText} numberOfLines={1}>
              {`${audioScribeModelDisplayName} · ${
                livePerf.ttftMs != null ? `${Math.round(livePerf.ttftMs)} ms` : '— ms'
              } · ${livePerf.tokps != null ? `${livePerf.tokps.toFixed(1)} tok/s` : '— tok/s'}`}
            </Text>
          </View>
        ) : null}

        <Text style={styles.resultBody}>
          {resultText.trim() ||
            (pickedClip
              ? t('result_placeholder', {
                  action: cachedTranscript ? t('action_switch_view') : t('action_run_on_device'),
                })
              : t('result_empty'))}
        </Text>

        {/* Per-result attribution + perf footer. Source-prefixed extension of
            the chat perfFooter grammar (`{ttft} ms · {tokps} tok/s`). For
            native speech paths only elapsed time is meaningful; AI Scribe
            paths report TTFT and tok/s. tabular-nums + textMuted match chat. */}
        {resultText.trim() && resultAttribution ? (
          <Text style={styles.attributionLine}>
            {(() => {
              const a = resultAttribution;
              if (a.ttftMs != null && a.tokps != null) {
                return `${a.source} · ${Math.round(a.ttftMs)} ms · ${a.tokps.toFixed(1)} tok/s`;
              }
              if (a.elapsedSec != null) {
                return `${a.source} · ${a.elapsedSec.toFixed(1)}s`;
              }
              return a.source;
            })()}
          </Text>
        ) : null}

        {errorText ? (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>{errorText}</Text>
            {/* Mic permission errors land in a system-blocked state after
                first denial — the OS no longer surfaces the prompt. Take the
                user to system settings where they can grant manually. */}
            {errorText === t('mic_permission_error') ? (
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => void Linking.openSettings()}
                accessibilityRole="button"
                accessibilityLabel={t('open_system_settings')}>
                <Text style={styles.secondaryButtonText}>
                  {t('open_system_settings')}
                </Text>
              </Pressable>
            ) : null}
            {/* Explicit cross-engine fallback. The user must opt into the
                alternative; we never substitute silently. */}
            {selectedPath === 'system' && gemmaReady ? (
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => handlePathChange('gemma')}
                accessibilityRole="button"
                accessibilityLabel={t('try_instead', { engine: audioScribeModelDisplayName })}>
                <Text style={styles.secondaryButtonText}>
                  {t('try_instead', { engine: audioScribeModelDisplayName })}
                </Text>
              </Pressable>
            ) : selectedPath === 'gemma' && nativeReady ? (
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => handlePathChange('system')}
                accessibilityRole="button"
                accessibilityLabel={t('try_instead', { engine: nativeEngineDisplayName })}>
                <Text style={styles.secondaryButtonText}>
                  {t('try_instead', { engine: nativeEngineDisplayName })}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {isAndroid && !androidNativeSpeechReady && !cachedTranscript ? (
          <Text style={styles.cardBody}>{t('android_offline_speech_guide')}</Text>
        ) : null}

        {showAndroidSpeechGuide ? (
          <View style={styles.guideBox}>
            <Text style={styles.cardTitle}>{t('offline_speech_setup_title')}</Text>
            <Text style={styles.cardBody}>{t('offline_speech_setup_body')}</Text>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              onPress={() => void Linking.openSettings()}
              accessibilityRole="button"
              accessibilityLabel={t('open_system_settings')}>
              <Text style={styles.secondaryButtonText}>{t('open_system_settings')}</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            !resultText.trim() && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          disabled={!resultText.trim()}
          onPress={handleSendToChat}
          accessibilityRole="button"
          accessibilityLabel={t('send_to_chat_a11y', { label: resultLabelForChat })}>
          <Text style={styles.primaryButtonText}>{t('send_to_chat')}</Text>
        </Pressable>
      </View>
      </ScrollView>
    </>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: Spacing.three, gap: Spacing.two },
    heading: { color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 4 },
    sub: { color: theme.textSecondary, fontSize: 14, lineHeight: 20 },
    card: {
      backgroundColor: theme.backgroundElement,
      borderRadius: 12,
      padding: Spacing.three,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 10,
    },
    cardTitle: { color: theme.text, fontSize: 16, fontWeight: '600' },
    cardBody: { color: theme.textSecondary, fontSize: 13, lineHeight: 19 },
    // Segmented format selector. Same visual grammar as Explore's mode toggle
    // and the Camera Photo/Scan/Library tabs. Tapping switches the view if
    // cached, runs on-device if not (auto-run, no confirmation).
    segmentRow: {
      flexDirection: 'row',
      backgroundColor: theme.surfaceMuted,
      borderRadius: 10,
      padding: 4,
    },
    segmentBtn: {
      flex: 1,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
    },
    segmentBtnActive: {
      backgroundColor: theme.backgroundElement,
      borderWidth: 1,
      borderColor: theme.border,
    },
    segmentBtnDisabled: { opacity: 0.4 },
    segmentBtnText: { color: theme.textMuted, fontSize: 13, fontWeight: '600' },
    segmentBtnTextActive: { color: theme.text },
    // Slim system-state notice. Tinted surface, no card chrome. Sits below
    // the primary Clip card so the "Record" CTA stays at the top of screen.
    statusNotice: {
      backgroundColor: theme.surfaceMuted,
      borderRadius: 12,
      padding: Spacing.three,
      gap: Spacing.one,
    },
    statusNoticeHeadline: { color: theme.text, fontSize: 14, fontWeight: '600' },
    statusNoticeHint: { color: theme.textSecondary, fontSize: 13, lineHeight: 18 },
    statusNoticeMeta: { color: theme.textMuted, fontSize: 12 },
    // Path selector — same visual grammar as the format segmentRow above
    // (Camera/Explore consistency), but slightly tighter so it reads as a
    // primary engine choice rather than a secondary view toggle.
    pathSelectorRow: {
      flexDirection: 'row',
      backgroundColor: theme.backgroundElement,
      borderRadius: 10,
      padding: 4,
      gap: 4,
    },
    pathPill: {
      flex: 1,
      minHeight: 40,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
      paddingHorizontal: 8,
    },
    pathPillActive: {
      backgroundColor: theme.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pathPillText: { color: theme.textMuted, fontSize: 13, fontWeight: '600' },
    pathPillTextActive: { color: theme.text },
    // Error block — error text plus the explicit cross-engine fallback
    // CTA (Try X instead). Stays inline below the result rather than
    // becoming a modal: PRODUCT.md anti-reference says modals are usually
    // laziness; the user can read and act in place.
    errorBlock: { gap: 8 },
    // Live perf ticker. Matches chat header's perfChip styles (index.tsx
    // L456) so the streaming-tokens UX is identical across the two
    // surfaces. tabular-nums keeps digits from jittering as numbers grow.
    livePerfChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 28,
      paddingHorizontal: 12,
      borderRadius: 6,
      backgroundColor: theme.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.border,
    },
    livePerfText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    clipSummary: {
      borderRadius: 10,
      padding: 12,
      backgroundColor: theme.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 4,
    },
    clipName: { color: theme.text, fontSize: 14, fontWeight: '600' },
    clipMeta: { color: theme.textMuted, fontSize: 12 },
    clipSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    clipSummaryText: { flex: 1, gap: 4 },
    clipDeleteButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.backgroundElement,
    },
    clipDeleteButtonPressed: { opacity: 0.6 },
    clipDeleteButtonText: { color: theme.text, fontSize: 12, fontWeight: '600' },
    actionRow: { gap: 10 },
    recordingStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.surfaceWarning,
      borderWidth: 1,
      borderColor: theme.warningBorder,
    },
    recordingDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: theme.buttonPrimary,
    },
    recordingText: {
      color: theme.warningText,
      fontSize: 13,
      fontWeight: '700',
    },
    primaryButton: {
      backgroundColor: theme.buttonPrimary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButton: {
      backgroundColor: theme.buttonSecondary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: { color: theme.buttonText, fontSize: 14, fontWeight: '700' },
    secondaryButtonText: { color: theme.buttonText, fontSize: 14, fontWeight: '700' },
    buttonDisabled: {
      opacity: 0.5,
      backgroundColor: theme.surfaceMuted,
      borderColor: theme.border,
    },
    buttonPressed: { opacity: 0.84 },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    progressText: { color: theme.textSecondary, fontSize: 13, lineHeight: 18 },
    errorText: { color: theme.warningText, fontSize: 13, lineHeight: 18 },
    guideBox: {
      marginTop: 4,
      padding: 12,
      borderRadius: 10,
      backgroundColor: theme.surfaceInfo,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 8,
    },
    resultBody: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 21,
      minHeight: 120,
      borderRadius: 10,
      padding: 12,
      backgroundColor: theme.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.border,
    },
    // Per-result attribution + perf footer. Identical chrome to chat's
    // perfFooter (index.tsx:1050) — same fontSize, color, alignment,
    // tabular-nums — so chat and Audio Scribe feel like the same product.
    attributionLine: {
      fontSize: 10,
      fontWeight: '400',
      color: theme.textMuted,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
      marginTop: 4,
    },
  });
}
