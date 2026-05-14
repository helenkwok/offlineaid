/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Directory, File, Paths } from 'expo-file-system';
import { mmkvStorage } from './mmkv';
import { closePackDatabase, readPackMetadata, type PackMetadata } from '@/services/pack';
import {
  downloadPackImport,
  isPackDbFilename,
  preparePackImport,
  type PreparedPackImport,
} from '@/services/pack-import';

/** Base directory for downloaded packs. */
const packsDir = () => new Directory(Paths.document, 'packs');

/** Local file reference for a downloaded pack. */
function packLocalFile(filename: string): File {
  return new File(packsDir(), filename);
}

/** Check if a file exists at the given path. */
function fileExists(path: string): boolean {
  return new File(path).exists;
}

async function installPreparedPack(destFile: File, prepared: PreparedPackImport): Promise<void> {
  await closePackDatabase(destFile.uri);

  if (destFile.exists) {
    destFile.delete();
  }

  prepared.dbFile.copy(destFile);
}

type ProgressMap = Record<string, number>;

function omitProgressKey(progress: ProgressMap, key: string): ProgressMap {
  const { [key]: _removed, ...rest } = progress;
  return rest;
}

interface PackState {
  availablePacks: PackMetadata[];
  activePacks: PackMetadata[];
  packDownloadProgress: ProgressMap;
  scanPacks: () => Promise<void>;
  togglePack: (id: string) => void;
  downloadPack: (id: string, url: string, filename: string) => Promise<void>;
  importPack: (sourceUri: string, filename: string) => Promise<void>;
  removePack: (id: string) => Promise<void>;
}

/** Directories to scan for .db pack files. */
async function findPackDbs(): Promise<string[]> {
  const dirs: Directory[] = [packsDir(), Paths.document];
  const devPackDir = process.env.EXPO_DEV_PACK_DIR;
  if (devPackDir) dirs.push(new Directory(devPackDir));

  const paths: string[] = [];
  const seenDirs = new Set<string>();
  for (const dir of dirs) {
    if (seenDirs.has(dir.uri)) {
      continue;
    }
    seenDirs.add(dir.uri);
    try {
      const items = dir.list();
      for (const item of items) {
        if (item instanceof File && item.name.endsWith('.db')) {
          paths.push(item.uri);
        }
      }
    } catch {
      // directory may not exist in all environments
    }
  }
  return [...new Set(paths)];
}

export const usePackStore = create<PackState>()(
  persist(
    (set, get) => ({
      availablePacks: [],
      activePacks: [],
      packDownloadProgress: {},

      scanPacks: async () => {
        const dbPaths = await findPackDbs();
        const metas: PackMetadata[] = [];

        for (const dbPath of dbPaths) {
          const file = new File(dbPath);
          const meta = await readPackMetadata(dbPath);
          if (meta) {
            meta.sizeBytes = file.exists ? file.size : 0;
            metas.push(meta);
          }
        }

        const activeIds = new Set(get().activePacks.map((p) => p.id));
        const stillActive = metas.filter((m) => activeIds.has(m.id));

        set({ availablePacks: metas, activePacks: stillActive });
      },

      togglePack: (id) => {
        const { availablePacks, activePacks } = get();
        const isActive = activePacks.some((p) => p.id === id);
        if (isActive) {
          set({ activePacks: activePacks.filter((p) => p.id !== id) });
        } else {
          const pack = availablePacks.find((p) => p.id === id);
          if (pack) set({ activePacks: [...activePacks, pack] });
        }
      },

      downloadPack: async (id, url, filename) => {
        const packDir = packsDir();
        packDir.create({ idempotent: true, intermediates: true });

        if (isPackDbFilename(filename) && fileExists(packLocalFile(filename).uri)) {
          await get().scanPacks();
          return;
        }

        let prepared: PreparedPackImport | null = null;
        try {
          prepared = await downloadPackImport(url, filename, (ratio) => {
            set((s) => ({
              packDownloadProgress: { ...s.packDownloadProgress, [id]: ratio },
            }));
          });

          const destFile = packLocalFile(prepared.dbFilename);
          if (!destFile.exists) {
            await installPreparedPack(destFile, prepared);
          }

          set((s) => ({
            packDownloadProgress: { ...s.packDownloadProgress, [id]: 1 },
          }));
          await get().scanPacks();
        } catch (error) {
          set((s) => ({
            packDownloadProgress: omitProgressKey(s.packDownloadProgress, id),
          }));
          throw error;
        } finally {
          if (prepared) {
            await prepared.cleanup();
          }
        }
      },

      importPack: async (sourceUri, filename) => {
        const packDir = packsDir();
        packDir.create({ idempotent: true, intermediates: true });

        let prepared: PreparedPackImport | null = null;
        try {
          prepared = await preparePackImport(sourceUri, filename);
          const destFile = packLocalFile(prepared.dbFilename);
          await installPreparedPack(destFile, prepared);
          await get().scanPacks();
        } finally {
          if (prepared) {
            await prepared.cleanup();
          }
        }
      },

      removePack: async (id) => {
        const pack = get().availablePacks.find((p) => p.id === id);
        if (!pack) return;

        await closePackDatabase(pack.dbPath);

        const file = new File(pack.dbPath);
        if (file.exists) {
          try {
            file.delete();
          } catch {
            // Best-effort cleanup
          }
        }

        set((s) => ({
          availablePacks: s.availablePacks.filter((p) => p.id !== id),
          activePacks: s.activePacks.filter((p) => p.id !== id),
        }));
      },
    }),
    {
      name: 'pack-store',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ activePacks: state.activePacks }),
    }
  )
);
