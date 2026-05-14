/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { createDownloadResumable } from 'expo-file-system/legacy';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { stripFileUri } from '@/models/runtime';
import { closePackDatabase, readPackMetadata, type PackMetadata } from '@/services/pack';

const PACK_ARCHIVE_FORMAT_VERSION = '1.0';
const PACK_ARCHIVE_ARTIFACT_TYPE = 'offlineaid.pack.archive';
const PACK_ARCHIVE_MANIFEST_FILENAME = 'manifest.json';

type PackArchiveManifest = {
  format_version: string;
  artifact_type: string;
  pack_name: string;
  pack_version: string;
  db_filename: string;
  db_sha256: string;
  builder_version: string;
  created_at: string;
};

export type PreparedPackImport = {
  dbFile: File;
  dbFilename: string;
  metadata: PackMetadata;
  cleanup: () => Promise<void>;
};

export function isPackArchiveFilename(filename: string): boolean {
  return filename.toLowerCase().endsWith('.oapack.zip');
}

export function isPackDbFilename(filename: string): boolean {
  return filename.toLowerCase().endsWith('.db');
}

export function isSupportedPackImportFilename(filename: string): boolean {
  return isPackDbFilename(filename) || isPackArchiveFilename(filename);
}

export async function preparePackImport(
  sourceUri: string,
  sourceFilename: string
): Promise<PreparedPackImport> {
  const workspace = createTempWorkspace();
  workspace.create({ idempotent: true, intermediates: true });
  return preparePackImportInWorkspace(workspace, sourceUri, sourceFilename);
}

export async function downloadPackImport(
  url: string,
  sourceFilename: string,
  onProgress?: (progress: number) => void
): Promise<PreparedPackImport> {
  const workspace = createTempWorkspace();
  workspace.create({ idempotent: true, intermediates: true });

  const downloadDir = new Directory(workspace, 'download');
  downloadDir.create({ idempotent: true, intermediates: true });

  const downloadFile = new File(downloadDir, normaliseFilename(sourceFilename));
  const download = createDownloadResumable(
    url,
    downloadFile.uri,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      const ratio =
        totalBytesExpectedToWrite > 0 ? totalBytesWritten / totalBytesExpectedToWrite : 0;
      onProgress?.(ratio);
    }
  );

  try {
    await download.downloadAsync();
    onProgress?.(1);
    return await preparePackImportInWorkspace(workspace, downloadFile.uri, sourceFilename);
  } catch (error) {
    await cleanupWorkspace(workspace);
    throw error;
  }
}

function createTempWorkspace(): Directory {
  return new Directory(
    Paths.cache,
    'pack-imports',
    `pack-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
}

async function preparePackImportInWorkspace(
  workspace: Directory,
  sourceUri: string,
  sourceFilename: string
): Promise<PreparedPackImport> {
  let dbFile: File | null = null;

  try {
    if (isPackDbFilename(sourceFilename)) {
      dbFile = new File(workspace, 'staged', normaliseDbFilename(sourceFilename));
      await copyReadableFile(sourceUri, dbFile);
    } else if (isPackArchiveFilename(sourceFilename)) {
      const archiveFile = new File(workspace, 'archive', normaliseFilename(sourceFilename));
      await copyReadableFile(sourceUri, archiveFile);
      dbFile = await extractArchivedPack(archiveFile, new Directory(workspace, 'extracted'));
    } else {
      throw new Error('Unsupported pack format. Import a .db or .oapack.zip knowledge pack.');
    }

    const metadata = await validatePackDb(dbFile);
    const preparedDbFile = dbFile;
    return {
      dbFile: preparedDbFile,
      dbFilename: preparedDbFile.name,
      metadata,
      cleanup: async () => {
        await cleanupWorkspace(workspace, preparedDbFile.uri);
      },
    };
  } catch (error) {
    await cleanupWorkspace(workspace, dbFile?.uri);
    throw error;
  }
}

async function extractArchivedPack(archiveFile: File, extractDir: Directory): Promise<File> {
  if (Platform.OS === 'web') {
    throw new Error('Compressed pack imports require a native development build.');
  }

  extractDir.create({ idempotent: true, intermediates: true });
  const { unzip } = await import('react-native-zip-archive');
  await unzip(stripFileUri(archiveFile.uri), stripFileUri(extractDir.uri));

  const items = extractDir.list();
  const nestedDirs = items.filter((item): item is Directory => item instanceof Directory);
  if (nestedDirs.length > 0) {
    throw new Error('Malformed pack archive: nested directories are not allowed.');
  }

  const files = items.filter((item): item is File => item instanceof File);
  const manifestFiles = files.filter((file) => file.name === PACK_ARCHIVE_MANIFEST_FILENAME);
  const dbFiles = files.filter((file) => isPackDbFilename(file.name));
  const checksumFiles = files.filter((file) => file.name.toLowerCase().endsWith('.sha256'));
  const allowedNames = new Set<string>([
    PACK_ARCHIVE_MANIFEST_FILENAME,
    ...dbFiles.map((file) => file.name),
    ...checksumFiles.map((file) => file.name),
  ]);
  const extraFiles = files.filter((file) => !allowedNames.has(file.name));

  if (manifestFiles.length !== 1) {
    throw new Error('Malformed pack archive: expected exactly one manifest.json file.');
  }
  if (dbFiles.length !== 1) {
    throw new Error('Malformed pack archive: expected exactly one SQLite .db file.');
  }
  if (checksumFiles.length > 1) {
    throw new Error('Malformed pack archive: expected at most one checksum file.');
  }
  if (extraFiles.length > 0) {
    throw new Error(
      `Malformed pack archive: unexpected files ${extraFiles.map((file) => file.name).join(', ')}.`
    );
  }

  const manifest = parseArchiveManifest(await manifestFiles[0].text());
  const dbFile = dbFiles[0];

  if (manifest.db_filename !== dbFile.name) {
    throw new Error('Malformed pack archive: manifest db_filename does not match the packaged .db file.');
  }

  const expectedChecksumName = `${dbFile.name}.sha256`;
  if (checksumFiles[0] && checksumFiles[0].name !== expectedChecksumName) {
    throw new Error('Malformed pack archive: checksum filename must match the packaged .db file.');
  }

  const dbSha256 = await hashFileSha256(dbFile);
  if (dbSha256 !== manifest.db_sha256) {
    throw new Error('Malformed pack archive: db_sha256 does not match the packaged database.');
  }

  if (checksumFiles[0]) {
    const checksumDigest = parseChecksum(await checksumFiles[0].text(), dbFile.name);
    if (checksumDigest !== manifest.db_sha256) {
      throw new Error('Malformed pack archive: checksum file does not match the manifest digest.');
    }
  }

  return dbFile;
}

function parseArchiveManifest(contents: string): PackArchiveManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error('Malformed pack archive: manifest.json is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Malformed pack archive: manifest.json must contain an object.');
  }

  const manifest = parsed as Partial<PackArchiveManifest>;
  const requiredStringFields: (keyof PackArchiveManifest)[] = [
    'format_version',
    'artifact_type',
    'pack_name',
    'pack_version',
    'db_filename',
    'db_sha256',
    'builder_version',
    'created_at',
  ];

  for (const field of requiredStringFields) {
    if (typeof manifest[field] !== 'string' || !manifest[field]?.trim()) {
      throw new Error(`Malformed pack archive: manifest field "${field}" is required.`);
    }
  }

  const validatedManifest = manifest as PackArchiveManifest;

  if (validatedManifest.format_version !== PACK_ARCHIVE_FORMAT_VERSION) {
    throw new Error(
      `Unsupported pack archive format version "${validatedManifest.format_version}".`
    );
  }

  if (validatedManifest.artifact_type !== PACK_ARCHIVE_ARTIFACT_TYPE) {
    throw new Error(
      `Unsupported pack archive artifact type "${validatedManifest.artifact_type}".`
    );
  }

  if (
    !isPackDbFilename(validatedManifest.db_filename) ||
    validatedManifest.db_filename.includes('/')
  ) {
    throw new Error('Malformed pack archive: manifest db_filename must be a top-level .db file.');
  }

  if (!/^[a-f0-9]{64}$/i.test(validatedManifest.db_sha256)) {
    throw new Error('Malformed pack archive: manifest db_sha256 must be a SHA-256 digest.');
  }

  return validatedManifest;
}

function parseChecksum(contents: string, expectedFilename: string): string {
  const trimmed = contents.trim();
  if (!trimmed) {
    throw new Error('Malformed pack archive: checksum file is empty.');
  }

  const [digest, filename] = trimmed.split(/\s+/);
  if (!digest || !/^[a-f0-9]{64}$/i.test(digest)) {
    throw new Error('Malformed pack archive: checksum file does not contain a SHA-256 digest.');
  }
  if (filename && filename.replace(/^\*/, '') !== expectedFilename) {
    throw new Error('Malformed pack archive: checksum file references the wrong database file.');
  }
  return digest.toLowerCase();
}

async function validatePackDb(dbFile: File): Promise<PackMetadata> {
  const metadata = await readPackMetadata(dbFile.uri);
  if (!metadata) {
    throw new Error('Selected file is not a valid OfflineAid knowledge pack.');
  }
  metadata.sizeBytes = dbFile.exists ? dbFile.size : 0;
  await closePackDatabase(dbFile.uri);
  return metadata;
}

async function hashFileSha256(file: File): Promise<string> {
  if (Platform.OS === 'web') {
    throw new Error('Compressed pack imports require a native development build.');
  }

  const ReactNativeBlobUtil = (await import('react-native-blob-util')).default;
  return ReactNativeBlobUtil.fs.hash(stripFileUri(file.uri), 'sha256');
}

async function copyReadableFile(sourceUri: string, destination: File): Promise<void> {
  destination.parentDirectory.create({ idempotent: true, intermediates: true });
  if (destination.exists) {
    destination.delete();
  }

  const sourceFile = new File(sourceUri);
  sourceFile.copy(destination);
}

function normaliseFilename(filename: string): string {
  return filename.replace(/[^\w.-]+/g, '-');
}

function normaliseDbFilename(filename: string): string {
  const cleaned = normaliseFilename(filename);
  return cleaned.toLowerCase().endsWith('.db') ? cleaned : `${cleaned}.db`;
}

async function cleanupWorkspace(workspace: Directory, dbUri?: string): Promise<void> {
  if (dbUri) {
    await closePackDatabase(dbUri);
  }
  try {
    if (workspace.exists) {
      workspace.delete();
    }
  } catch {
    // Best-effort cleanup only.
  }
}
