/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { requireNativeModule } from 'expo-modules-core';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('expo-modules-core', () => ({
  LegacyEventEmitter: jest.fn(),
  requireNativeModule: jest.fn(),
}));

jest.mock('@/models/runtime', () => ({
  getLiteRtModelPath: jest.fn(),
  getLiteRtModelPlatformBlockReason: jest.fn(),
  stripFileUri: (value: string) => value,
}));

describe('generateLiteRtAudioResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('rejects on iOS before calling the native module', async () => {
    const { generateLiteRtAudioResponse } = require('./index');

    await expect(
      generateLiteRtAudioResponse(
        'litert-community/gemma-4-E2B-it-litert-lm/gemma-4-E2B-it.litertlm',
        'file:///tmp/clip.m4a',
        'Transcribe this audio'
      )
    ).rejects.toThrow('LiteRT Audio Scribe is only available on Android.');

    expect(requireNativeModule).not.toHaveBeenCalled();
  });
});
