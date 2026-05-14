/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Directory, File, Paths } from 'expo-file-system';

import { mmkvStorage } from './mmkv';

export type AudioScribeClipSource = 'recorded' | 'imported';

export type AudioScribeClip = {
  name: string;
  size: number | null;
  source: AudioScribeClipSource;
  uri: string;
};

interface AudioScribeState {
  currentClip: AudioScribeClip | null;
  saveClip: (clip: Omit<AudioScribeClip, 'uri' | 'size'> & { sourceUri: string }) => Promise<AudioScribeClip>;
  clearClip: () => Promise<void>;
}

const AUDIO_SCRIBE_DIR = new Directory(Paths.document, 'audio-scribe');

function makeClipFileName(sourceName: string, sourceUri: string): string {
  const candidate = sourceName || sourceUri;
  const dotIndex = candidate.lastIndexOf('.');
  const extension = dotIndex >= 0 && dotIndex < candidate.length - 1 ? candidate.slice(dotIndex) : '.m4a';
  const timestamp = Date.now();
  return `clip-${timestamp}${extension}`;
}

function getClipFile(clip: AudioScribeClip): File {
  return new File(clip.uri);
}

export const useAudioScribeStore = create<AudioScribeState>()(
  persist(
    (set, get) => ({
      currentClip: null,
      saveClip: async ({ sourceUri, name, source }) => {
        const sourceFile = new File(sourceUri);
        if (!sourceFile.exists) {
          throw new Error('The selected audio clip could not be found.');
        }

        AUDIO_SCRIBE_DIR.create({ idempotent: true, intermediates: true });

        const previousClip = get().currentClip;
        const destination = new File(AUDIO_SCRIBE_DIR, makeClipFileName(name, sourceUri));
        if (destination.exists) {
          destination.delete();
        }

        sourceFile.copy(destination);

        if (previousClip && previousClip.uri !== destination.uri) {
          const previousFile = getClipFile(previousClip);
          if (previousFile.exists) {
            previousFile.delete();
          }
        }

        const nextClip: AudioScribeClip = {
          name,
          size: destination.size,
          source,
          uri: destination.uri,
        };
        set({ currentClip: nextClip });
        return nextClip;
      },
      clearClip: async () => {
        const currentClip = get().currentClip;
        if (currentClip) {
          const file = getClipFile(currentClip);
          if (file.exists) {
            file.delete();
          }
        }
        set({ currentClip: null });
      },
    }),
    {
      name: 'audio-scribe-store',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ currentClip: state.currentClip }),
    }
  )
);
