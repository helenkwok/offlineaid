/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { requireNativeModule } from 'expo-modules-core';

import {
  analyzeImage,
  normalizePerceptionAnalyzeResult,
  normalizePerceptionCapabilities,
} from './perception';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@/models/runtime', () => ({
  stripFileUri: (pathOrUri: string) => pathOrUri,
}));

jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn(),
}));

describe('normalizePerceptionCapabilities', () => {
  it('maps booleans and defaults imageSource to mlkit', () => {
    const caps = normalizePerceptionCapabilities({
      canAnalyzeImage: true,
      canTranscribeAudio: false,
      canDetectLanguage: true,
      canExtractEntities: false,
      imageSource: 'other',
      supportedBarcodeFormats: ['QR_CODE', 123, 'EAN_13', null, 'CODE_128'],
    });
    expect(caps).toEqual({
      canAnalyzeImage: true,
      canTranscribeAudio: false,
      canDetectLanguage: true,
      canExtractEntities: false,
      imageSource: 'mlkit',
      supportedBarcodeFormats: ['QR_CODE', 'EAN_13', 'CODE_128'],
    });
  });

  it('accepts apple imageSource', () => {
    const caps = normalizePerceptionCapabilities({
      canAnalyzeImage: false,
      canTranscribeAudio: true,
      canDetectLanguage: false,
      canExtractEntities: false,
      imageSource: 'apple',
      supportedBarcodeFormats: [],
    });
    expect(caps.imageSource).toBe('apple');
  });
});

describe('normalizePerceptionAnalyzeResult', () => {
  const messyNative = {
    barcodes: [
      { format: 'QR_CODE', value: '  https://x.test  ' },
      { format: '', value: 'skip' },
      { format: 'EAN_13', value: '123' },
    ],
    entities: [
      { text: '  Paris  ', type: 'Place', start: 1, end: 5, value: ' Paris ' },
      { text: '', type: 'Place' },
      { text: 'Acme', type: ' Organization ', confidence: 'nope' },
    ],
    objects: [
      { label: '  Dog  ', confidence: 0.9 },
      { label: '', confidence: 1 },
    ],
    ocrLines: [' line one ', 99, 'line two'],
    ocrText: '  passport number  ',
    detectedLanguage: { tag: '  fr-FR  ', confidence: 0.88 },
    source: 'apple',
  };

  it('normalizes native-shaped barcodes, entities, language, and OCR', () => {
    const out = normalizePerceptionAnalyzeResult(messyNative);
    expect(out.source).toBe('apple');
    expect(out.barcodes).toEqual([
      { format: 'QR_CODE', value: 'https://x.test' },
      { format: 'EAN_13', value: '123' },
    ]);
    expect(out.entities).toEqual([
      { text: 'Paris', type: 'Place', start: 1, end: 5, value: 'Paris' },
      { text: 'Acme', type: 'Organization' },
    ]);
    expect(out.objects).toEqual([{ label: 'Dog', confidence: 0.9 }]);
    expect(out.ocrLines).toEqual([' line one ', 'line two']);
    expect(out.ocrText).toBe('passport number');
    expect(out.detectedLanguage).toEqual({ tag: 'fr-FR', confidence: 0.88 });
    expect(out.hints.some((h) => h.includes('identification'))).toBe(true);
    expect(out.hints.some((h) => h.includes('barcode'))).toBe(true);
  });

  it('live tier clears OCR and entities but keeps barcodes and objects', () => {
    const out = normalizePerceptionAnalyzeResult(messyNative, { tier: 'live' });
    expect(out.ocrText).toBe('');
    expect(out.ocrLines).toEqual([]);
    expect(out.entities).toEqual([]);
    expect(out.detectedLanguage).toBeNull();
    expect(out.barcodes).toHaveLength(2);
    expect(out.objects).toHaveLength(1);
    expect(out.hints.some((h) => h.includes('barcode'))).toBe(true);
  });
});

describe('analyzeImage with mocked native module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireNativeModule as jest.Mock).mockImplementation(() => ({
      analyzeImageAsync: jest.fn().mockResolvedValue({
        barcodes: [{ format: 'QR_CODE', value: 'hello' }],
        entities: [{ text: 'Tokyo', type: 'Place' }],
        objects: [{ label: 'Text' }],
        ocrLines: [],
        ocrText: 'receipt total',
        detectedLanguage: { tag: 'en' },
        source: 'mlkit',
      }),
      getCapabilitiesAsync: jest.fn(),
      transcribeAudioAsync: jest.fn(),
    }));
  });

  it('returns normalized analysis from native payload', async () => {
    const result = await analyzeImage('file:///tmp/photo.jpg');
    expect(result.barcodes).toEqual([{ format: 'QR_CODE', value: 'hello' }]);
    expect(result.entities[0]?.text).toBe('Tokyo');
    expect(result.ocrText).toBe('receipt total');
    expect(result.source).toBe('mlkit');
    expect(requireNativeModule).toHaveBeenCalledWith('OfflineAidPerception');
  });
});
