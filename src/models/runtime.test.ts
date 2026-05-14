/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import {
  AUDIO_SCRIBE_LITERT_MODEL_ID,
  getChatModelBackend,
  getLiteRtModelPlatformBlockReason,
  getModelDownloadUrl,
  getModelFilename,
  getModelRepoUrl,
  getModelShortName,
  isLlamaModelId,
  requiresHuggingFaceAccess,
  supportsAudioScribe,
  stripFileUri,
} from '@/models/runtime';

describe('runtime model helpers', () => {
  const sampleGguf = 'bartowski/gemma-2-2b-it-GGUF/gemma-2-2b-it-Q4_K_M.gguf';
  const sampleTask = 'litert-community/Gemma3-1B-IT/Gemma3-1B-IT_multi-prefill-seq_q4_ekv2048.task';
  const audioScribeModelId = AUDIO_SCRIBE_LITERT_MODEL_ID;

  it('parses filename from HuggingFace-style id', () => {
    expect(getModelFilename(sampleGguf)).toBe('gemma-2-2b-it-Q4_K_M.gguf');
  });

  it('builds download and repo URLs', () => {
    expect(getModelDownloadUrl(sampleGguf)).toBe(
      'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf?download=true'
    );
    expect(getModelRepoUrl(sampleGguf)).toBe('https://huggingface.co/bartowski/gemma-2-2b-it-GGUF');
    expect(getModelRepoUrl(audioScribeModelId)).toBe(
      'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm'
    );
    expect(getModelDownloadUrl(audioScribeModelId)).toBe(
      'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm?download=true'
    );
  });

  it('classifies chat backends', () => {
    expect(getChatModelBackend(sampleGguf)).toBe('llama');
    expect(getChatModelBackend(sampleTask)).toBe('litert');
    expect(isLlamaModelId(sampleGguf)).toBe(true);
  });

  it('flags gated models', () => {
    expect(requiresHuggingFaceAccess(sampleTask)).toBe(true);
    expect(requiresHuggingFaceAccess(sampleGguf)).toBe(false);
  });

  it('marks the Audio Scribe model as supported', () => {
    expect(supportsAudioScribe(audioScribeModelId)).toBe(true);
  });

  it('derives short display name from repo segment', () => {
    expect(getModelShortName(sampleGguf)).toContain('gemma');
  });

  it('strips file:// prefix', () => {
    expect(stripFileUri('file:///tmp/x')).toBe('/tmp/x');
    expect(stripFileUri('/tmp/x')).toBe('/tmp/x');
  });

  it('returns LiteRT block reason on web', () => {
    expect(getLiteRtModelPlatformBlockReason(sampleTask, 'web')).toMatch(/native/i);
  });

  it('does not throw from boolean helpers for unsupported catalogue entries', () => {
    expect(isLlamaModelId('gemma-2b-it-cpu-int4.bin')).toBe(false);
  });
});
