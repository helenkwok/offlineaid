/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

import { stripFileUri } from '@/models/runtime';

export type PerceptionCapabilities = {
  canAnalyzeImage: boolean;
  canTranscribeAudio: boolean;
  canDetectLanguage: boolean;
  canExtractEntities: boolean;
  imageSource: 'mlkit' | 'apple';
  supportedBarcodeFormats: string[];
};

export type PerceptionDetectedLanguage = {
  confidence?: number;
  tag: string;
};

export type PerceptionEntity = {
  end?: number;
  start?: number;
  text: string;
  type: string;
  value?: string;
};

export type PerceptionBarcode = {
  format: string;
  value: string;
};

export type PerceptionObject = {
  confidence?: number;
  label: string;
};

export type PerceptionAnalysis = {
  barcodes: PerceptionBarcode[];
  detectedLanguage: PerceptionDetectedLanguage | null;
  entities: PerceptionEntity[];
  hints: string[];
  objects: PerceptionObject[];
  ocrLines: string[];
  ocrText: string;
  source: 'apple' | 'mlkit';
};

export type AnalyzeImageTier = 'live' | 'deep';

type OfflineAidPerceptionModule = {
  getCapabilitiesAsync?(): Promise<Record<string, unknown>>;
  analyzeImageAsync(imagePath: string): Promise<{
    barcodes?: Record<string, unknown>[];
    detectedLanguage?: Record<string, unknown> | null;
    entities?: Record<string, unknown>[];
    objects?: Record<string, unknown>[];
    ocrLines?: unknown[];
    ocrText?: string;
    source?: string;
  }>;
  transcribeAudioAsync(audioPath: string, localeTag?: string | null): Promise<string>;
};

export type TranscriptionOutcome = {
  text: string;
  source: 'native' | 'none';
  unavailableReason?: 'empty_transcript' | 'native_unavailable';
};

let cachedCapabilities: PerceptionCapabilities | null = null;

export function normalizePerceptionCapabilities(raw: Record<string, unknown>): PerceptionCapabilities {
  const imageSource = raw.imageSource === 'apple' ? 'apple' : 'mlkit';
  const formats = Array.isArray(raw.supportedBarcodeFormats)
    ? (raw.supportedBarcodeFormats as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];

  return {
    canAnalyzeImage: raw.canAnalyzeImage === true,
    canTranscribeAudio: raw.canTranscribeAudio === true,
    canDetectLanguage: raw.canDetectLanguage === true,
    canExtractEntities: raw.canExtractEntities === true,
    imageSource,
    supportedBarcodeFormats: formats,
  };
}

function requirePerceptionModule(): OfflineAidPerceptionModule {
  if (Platform.OS === 'web') {
    throw new Error('Perception analysis is only available in the native app.');
  }

  try {
    return requireNativeModule<OfflineAidPerceptionModule>('OfflineAidPerception');
  } catch {
    throw new Error(
      'Perception support is not present in this native build yet. Rebuild and reinstall the app or dev client to analyze images on-device.'
    );
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeDetectedLanguage(
  value: Record<string, unknown> | null | undefined
): PerceptionDetectedLanguage | null {
  if (!value) {
    return null;
  }

  const tag = asString(value.tag);
  if (!tag) {
    return null;
  }

  return {
    tag,
    confidence: asNumber(value.confidence),
  };
}

function normalizeEntities(values: Record<string, unknown>[] | undefined): PerceptionEntity[] {
  const entities: PerceptionEntity[] = [];

  for (const value of values ?? []) {
    const text = asString(value.text);
    const type = asString(value.type);
    if (!text || !type) {
      continue;
    }

    const entity: PerceptionEntity = { text, type };
    const start = asNumber(value.start);
    const end = asNumber(value.end);
    const resolvedValue = asString(value.value);

    if (typeof start === 'number') {
      entity.start = start;
    }
    if (typeof end === 'number') {
      entity.end = end;
    }
    if (resolvedValue) {
      entity.value = resolvedValue;
    }

    entities.push(entity);
  }

  return entities;
}

function normalizeBarcodes(values: Record<string, unknown>[] | undefined): PerceptionBarcode[] {
  return (values ?? [])
    .map((value) => {
      const format = asString(value.format);
      const codeValue = asString(value.value);
      if (!format || !codeValue) {
        return null;
      }

      return {
        format,
        value: codeValue,
      } satisfies PerceptionBarcode;
    })
    .filter((value): value is PerceptionBarcode => value !== null);
}

function normalizeObjects(values: Record<string, unknown>[] | undefined): PerceptionObject[] {
  const objects: PerceptionObject[] = [];

  for (const value of values ?? []) {
    const label = asString(value.label);
    if (!label) {
      continue;
    }

    const object: PerceptionObject = { label };
    const confidence = asNumber(value.confidence);
    if (typeof confidence === 'number') {
      object.confidence = confidence;
    }
    objects.push(object);
  }

  return objects;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildHints(input: {
  barcodes: PerceptionBarcode[];
  entities: PerceptionEntity[];
  objects: PerceptionObject[];
  ocrText: string;
}): string[] {
  const hints: string[] = [];

  if (input.ocrText) {
    if (/passport|visa|identity|licen[cs]e/i.test(input.ocrText)) {
      hints.push('This image may contain identification or travel documents.');
    }
    if (/receipt|invoice|total|amount|paid/i.test(input.ocrText)) {
      hints.push('This image may contain a receipt, invoice, or payment record.');
    }
    if (/emergency|warning|danger|exit|shelter|evacuation/i.test(input.ocrText)) {
      hints.push('This image may contain emergency signage or safety instructions.');
    }
  }

  if (input.barcodes.length > 0) {
    hints.push(
      input.barcodes.length === 1
        ? `Found 1 barcode or QR code.`
        : `Found ${input.barcodes.length} barcodes or QR codes.`
    );
  }

  const objectLabels = input.objects.map((item) => item.label);
  if (objectLabels.length > 0) {
    hints.push(`Top visual labels: ${dedupeStrings(objectLabels).slice(0, 3).join(', ')}.`);
  }

  const entityTypes = dedupeStrings(input.entities.map((item) => item.type));
  if (entityTypes.length > 0) {
    hints.push(`Detected structured details: ${entityTypes.slice(0, 4).join(', ')}.`);
  }

  return hints;
}

/** Raw shape returned by native `analyzeImageAsync` (before TS normalization). */
export type NativeAnalyzeImageRaw = {
  barcodes?: Record<string, unknown>[];
  detectedLanguage?: Record<string, unknown> | null;
  entities?: Record<string, unknown>[];
  objects?: Record<string, unknown>[];
  ocrLines?: unknown[];
  ocrText?: string;
  source?: string;
};

export function normalizePerceptionAnalyzeResult(
  raw: NativeAnalyzeImageRaw,
  options?: { tier?: AnalyzeImageTier }
): PerceptionAnalysis {
  const ocrLines = (raw.ocrLines ?? []).filter((value): value is string => typeof value === 'string');
  const ocrText = asString(raw.ocrText) ?? ocrLines.join('\n');
  const entities = normalizeEntities(raw.entities);
  const barcodes = normalizeBarcodes(raw.barcodes);
  const objects = normalizeObjects(raw.objects);

  const full: PerceptionAnalysis = {
    ocrText,
    ocrLines,
    detectedLanguage: normalizeDetectedLanguage(raw.detectedLanguage),
    entities,
    barcodes,
    objects,
    hints: buildHints({ ocrText, entities, barcodes, objects }),
    source: raw.source === 'apple' ? 'apple' : 'mlkit',
  };

  if (options?.tier === 'live') {
    return {
      ...full,
      ocrText: '',
      ocrLines: [],
      entities: [],
      detectedLanguage: null,
      hints: buildHints({ ocrText: '', entities: [], barcodes, objects }),
    };
  }

  return full;
}

export async function analyzeImage(
  imageUri: string,
  options?: { tier?: AnalyzeImageTier }
): Promise<PerceptionAnalysis> {
  const module = requirePerceptionModule();
  const raw = await module.analyzeImageAsync(stripFileUri(imageUri));
  return normalizePerceptionAnalyzeResult(raw, options);
}

export async function transcribeAudio(audioUri: string, localeTag?: string | null): Promise<string> {
  const outcome = await transcribeAudioWithOutcome(audioUri, localeTag);
  if (outcome.source === 'none') {
    if (Platform.OS === 'android') {
      throw new Error(
        'Android speech recognition did not return a transcript. Open system Language settings and download the offline speech pack for your language, or use AI Scribe with Gemma 4 E2B.'
      );
    }
    throw new Error('Speech transcription did not return any text for this clip.');
  }
  return outcome.text;
}

export async function transcribeAudioWithOutcome(
  audioUri: string,
  localeTag?: string | null
): Promise<TranscriptionOutcome> {
  const module = requirePerceptionModule();
  const transcript = await module.transcribeAudioAsync(stripFileUri(audioUri), localeTag ?? null);
  const trimmed = transcript.trim();
  if (!trimmed) {
    if (Platform.OS === 'android') {
      return { text: '', source: 'none', unavailableReason: 'native_unavailable' };
    }
    return { text: '', source: 'none', unavailableReason: 'empty_transcript' };
  }
  return { text: trimmed, source: 'native' };
}

export async function getPerceptionCapabilities(): Promise<PerceptionCapabilities> {
  if (Platform.OS === 'web') {
    return {
      canAnalyzeImage: false,
      canTranscribeAudio: false,
      canDetectLanguage: false,
      canExtractEntities: false,
      imageSource: 'mlkit',
      supportedBarcodeFormats: [],
    };
  }

  const module = requirePerceptionModule();
  if (typeof module.getCapabilitiesAsync !== 'function') {
    return {
      canAnalyzeImage: true,
      canTranscribeAudio: Platform.OS === 'ios',
      canDetectLanguage: true,
      canExtractEntities: true,
      imageSource: Platform.OS === 'ios' ? 'apple' : 'mlkit',
      supportedBarcodeFormats: [],
    };
  }

  const raw = await module.getCapabilitiesAsync();
  const caps = normalizePerceptionCapabilities(raw);
  cachedCapabilities = caps;
  return caps;
}

export async function isPerceptionAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  try {
    requireNativeModule('OfflineAidPerception');
    const caps = await getPerceptionCapabilities();
    return caps.canAnalyzeImage;
  } catch {
    return false;
  }
}

export function getCachedPerceptionCapabilities(): PerceptionCapabilities | null {
  return cachedCapabilities;
}

export async function isSystemTranscriptionAvailable(): Promise<boolean> {
  const caps = await getPerceptionCapabilities();
  return caps.canTranscribeAudio;
}

export function buildPerceptionChatDraft(
  analysis: PerceptionAnalysis,
  question?: string
): string {
  const sections: string[] = ['I captured an image offline. Use this local perception summary as context:'];

  if (analysis.ocrText) {
    sections.push(`OCR text:\n${analysis.ocrText}`);
  }

  if (analysis.detectedLanguage) {
    sections.push(`Detected language: ${analysis.detectedLanguage.tag}`);
  }

  if (analysis.entities.length > 0) {
    sections.push(
      `Entities: ${analysis.entities
        .slice(0, 8)
        .map((entity) => `${entity.type}=${entity.value ?? entity.text}`)
        .join('; ')}`
    );
  }

  if (analysis.barcodes.length > 0) {
    sections.push(
      `Barcodes: ${analysis.barcodes
        .slice(0, 5)
        .map((barcode) => `${barcode.format}:${barcode.value}`)
        .join('; ')}`
    );
  }

  if (analysis.objects.length > 0) {
    sections.push(
      `Visual labels: ${analysis.objects
        .slice(0, 5)
        .map((item) => item.label)
        .join(', ')}`
    );
  }

  if (analysis.hints.length > 0) {
    sections.push(`Hints: ${analysis.hints.join(' ')}`);
  }

  if (question?.trim()) {
    sections.push(`Image question: ${question.trim()}`);
  } else {
    sections.push('Please help me interpret this image for travel or emergency use.');
  }
  return sections.join('\n\n');
}
