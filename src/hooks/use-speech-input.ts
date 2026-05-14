/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import i18next from 'i18next';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionErrorEvent,
} from 'expo-speech-recognition';

// Module-level helpers use the i18next.t() function directly (not a hook)
// because formatSpeechError() is called from useSpeechRecognitionEvent
// callbacks that have no React render scope. i18next is initialized at
// app startup via src/lib/i18n.ts so by the time any speech event fires
// the resources are ready.
// Cast through unknown: the project's strict-typed `t` only accepts known keys,
// but the new speech-* keys exist at runtime in the errors namespace bundle.
const t = (key: string, opts?: Record<string, unknown>) =>
  (i18next.t as unknown as (k: string, o?: Record<string, unknown>) => string)(
    `errors:${key}`,
    opts,
  );

const ANDROID_ON_DEVICE_SERVICE = 'com.google.android.as';

type SpeechStatusTone = 'info' | 'error' | null;
type SpeechMessage = {
  text: string;
  tone: Exclude<SpeechStatusTone, null>;
};

type UseSpeechInputOptions = {
  onTranscript: (transcript: string, isFinal: boolean) => void;
};

type UseSpeechInputResult = {
  locale: string;
  isListening: boolean;
  isStarting: boolean;
  statusText: string | null;
  statusTone: SpeechStatusTone;
  startListening: () => Promise<void>;
  stopListening: () => void;
  clearStatus: () => void;
};

type AndroidLocalePreparation = {
  locale: string;
  message?: SpeechMessage;
};

function normalizeLocaleTag(locale: string): string {
  return locale.replace(/_/g, '-').split('-u-')[0]?.trim() || 'en-US';
}

function resolveDefaultSpeechLocale(): string {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  return locale ? normalizeLocaleTag(locale) : 'en-US';
}

function getBaseLanguage(locale: string): string {
  return normalizeLocaleTag(locale).split('-')[0] || locale;
}

function pickMatchingLocale(locales: string[], preferredLocale: string): string | null {
  const normalizedPreferred = normalizeLocaleTag(preferredLocale).toLowerCase();
  const preferredBaseLanguage = getBaseLanguage(preferredLocale).toLowerCase();
  const normalizedLocales = locales.map((locale) => normalizeLocaleTag(locale));

  const exactMatch =
    normalizedLocales.find((locale) => locale.toLowerCase() === normalizedPreferred) ?? null;
  if (exactMatch) {
    return exactMatch;
  }

  const baseLanguageMatch =
    normalizedLocales.find((locale) => getBaseLanguage(locale).toLowerCase() === preferredBaseLanguage) ??
    null;
  return baseLanguageMatch;
}

function resolveAndroidRecognitionService(): string | undefined {
  if (Platform.OS !== 'android') {
    return undefined;
  }

  try {
    const services = ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
    return services.includes(ANDROID_ON_DEVICE_SERVICE) ? ANDROID_ON_DEVICE_SERVICE : undefined;
  } catch {
    return undefined;
  }
}

async function prepareAndroidOfflineLocale(
  preferredLocale: string,
  androidRecognitionServicePackage?: string
): Promise<AndroidLocalePreparation> {
  if (Platform.OS !== 'android') {
    return { locale: preferredLocale };
  }

  try {
    const supportedLocales = await ExpoSpeechRecognitionModule.getSupportedLocales({
      androidRecognitionServicePackage,
    });
    const installedLocale = pickMatchingLocale(supportedLocales.installedLocales, preferredLocale);
    if (installedLocale) {
      return { locale: installedLocale };
    }

    const downloadableLocale = pickMatchingLocale(supportedLocales.locales, preferredLocale);
    if (!downloadableLocale) {
      return { locale: preferredLocale };
    }

    const result = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
      locale: downloadableLocale,
    });
    if (result.status === 'download_success') {
      return { locale: downloadableLocale };
    }

    return {
      locale: downloadableLocale,
      message: {
        tone: 'info',
        text:
          result.status === 'opened_dialog'
            ? t('speech_download_opened', { locale: downloadableLocale })
            : t('speech_download_cancelled', { locale: downloadableLocale }),
      },
    };
  } catch {
    return { locale: preferredLocale };
  }
}

function getRecognitionUnavailableMessage(): string {
  if (Platform.OS === 'ios') {
    return t('speech_unavailable_ios');
  }
  return t('speech_unavailable_android');
}

function formatSpeechError(event: ExpoSpeechRecognitionErrorEvent, locale: string): string {
  switch (event.error) {
    case 'not-allowed':
      return t('speech_not_allowed');
    case 'service-not-allowed':
      return getRecognitionUnavailableMessage();
    case 'language-not-supported':
      return t('speech_lang_not_supported', { locale });
    case 'network':
      return t('speech_network');
    case 'no-speech':
    case 'speech-timeout':
      return t('speech_no_speech');
    case 'busy':
      return t('speech_busy');
    case 'audio-capture':
      return t('speech_audio_capture');
    case 'aborted':
      return t('speech_aborted');
    default:
      // The native event.message is non-translatable (comes from the OS
      // speech-recognition service in its own language); we replace with our
      // localized generic fallback so users always see translated copy.
      return t('speech_default');
  }
}

export function useSpeechInput({ onTranscript }: UseSpeechInputOptions): UseSpeechInputResult {
  const [locale] = useState(resolveDefaultSpeechLocale);
  const [isListening, setIsListening] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [message, setMessage] = useState<SpeechMessage | null>(null);
  const forwardTranscript = useEffectEvent(onTranscript);

  useSpeechRecognitionEvent('start', () => {
    setIsStarting(false);
    setIsListening(true);
    setMessage(null);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsStarting(false);
    setIsListening(false);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript?.trim();
    if (!transcript) {
      return;
    }
    forwardTranscript(transcript, event.isFinal);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setIsStarting(false);
    setIsListening(false);
    setMessage({
      tone: 'error',
      text: formatSpeechError(event, locale),
    });
  });

  useEffect(() => {
    return () => {
      if (Platform.OS === 'web') {
        return;
      }
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // Ignore shutdown cleanup errors from partially initialized sessions.
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    if (Platform.OS === 'web') {
      setMessage({
        tone: 'error',
        text: t('speech_web_only'),
      });
      return;
    }

    if (isListening || isStarting) {
      return;
    }

    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setMessage({ tone: 'error', text: getRecognitionUnavailableMessage() });
      return;
    }

    if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
      setMessage({
        tone: 'error',
        text: t('speech_no_on_device'),
      });
      return;
    }

    setIsStarting(true);
    setMessage(null);

    try {
      const permissions = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permissions.granted) {
        setIsStarting(false);
        setMessage({
          tone: 'error',
          text: 'Microphone or speech-recognition permission was denied. Enable it in system settings to use voice input.',
        });
        return;
      }

      const androidRecognitionServicePackage = resolveAndroidRecognitionService();
      const preparation = await prepareAndroidOfflineLocale(locale, androidRecognitionServicePackage);
      if (preparation.message) {
        setIsStarting(false);
        setMessage(preparation.message);
        return;
      }

      ExpoSpeechRecognitionModule.start({
        lang: preparation.locale,
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: true,
        addsPunctuation: true,
        iosTaskHint: 'dictation',
        androidRecognitionServicePackage,
      });
    } catch (error) {
      setIsStarting(false);
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : t('speech_could_not_start'),
      });
    }
  }, [isListening, isStarting, locale]);

  const stopListening = useCallback(() => {
    if (!isListening && !isStarting) {
      return;
    }
    ExpoSpeechRecognitionModule.stop();
  }, [isListening, isStarting]);

  const clearStatus = useCallback(() => {
    setMessage(null);
  }, []);

  const statusText =
    isStarting
      ? t('speech_preparing')
      : isListening
        ? t('speech_listening', { locale })
        : message?.text ?? null;
  const statusTone = isStarting || isListening ? 'info' : (message?.tone ?? null);

  return {
    locale,
    isListening,
    isStarting,
    statusText,
    statusTone,
    startListening,
    stopListening,
    clearStatus,
  };
}
