/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import {
  extractGeoSearchQuery,
  extractMapCategory,
  normaliseRagText,
  truncateText,
} from '@/app/(tabs)/(index)/index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/hooks/useLLM', () => ({
  useLLM: () => ({ generate: jest.fn(), abort: jest.fn() }),
}));

jest.mock('@/hooks/use-speech-input', () => ({
  useSpeechInput: () => ({
    statusText: null,
    statusTone: 'info',
    startListening: jest.fn(),
    stopListening: jest.fn(),
    clearStatus: jest.fn(),
  }),
}));

jest.mock('@/store', () => ({
  useChatDraftStore: () => ({ pendingDraft: null, consumePendingDraft: jest.fn() }),
  usePackStore: () => ({
    activePacks: [],
    activePackCount: 0,
    togglePack: jest.fn(),
  }),
  useModelStore: () => ({
    loadedModelId: null,
    modelLoaded: false,
    loadModel: jest.fn(),
  }),
  usePreferencesStore: () => ({ ragOn: true, setRagOn: jest.fn() }),
}));

jest.mock('@/services/pack', () => ({
  searchPack: jest.fn(),
  searchGeoPoints: jest.fn(),
  listGeoPointsByCategory: jest.fn(),
}));

describe('index chat helpers', () => {
  it('normalises RAG whitespace', () => {
    expect(normaliseRagText('  a  \n b ')).toBe('a b');
  });

  it('truncates long text', () => {
    expect(truncateText('hello world', 8)).toBe('hello w…');
  });

  it('extracts geo search query by stripping map phrasing', () => {
    expect(extractGeoSearchQuery('please find hospitals near me')).toContain('hospital');
  });

  it('detects map category hints', () => {
    expect(extractMapCategory('where are the shelters')).toBe('shelter');
  });
});
