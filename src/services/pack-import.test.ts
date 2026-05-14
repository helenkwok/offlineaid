/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import {
  isPackArchiveFilename,
  isPackDbFilename,
  isSupportedPackImportFilename,
} from '@/services/pack-import';

describe('pack-import filename helpers', () => {
  it('detects .oapack.zip archives case-insensitively', () => {
    expect(isPackArchiveFilename('MyPack.oapack.zip')).toBe(true);
    expect(isPackArchiveFilename('pack.OAPACK.ZIP')).toBe(true);
    expect(isPackArchiveFilename('pack.zip')).toBe(false);
  });

  it('detects .db packs', () => {
    expect(isPackDbFilename('offline.db')).toBe(true);
    expect(isPackDbFilename('x.DB')).toBe(true);
    expect(isPackDbFilename('pack.sqlite')).toBe(false);
  });

  it('accepts only db or oapack.zip for import', () => {
    expect(isSupportedPackImportFilename('a.db')).toBe(true);
    expect(isSupportedPackImportFilename('b.oapack.zip')).toBe(true);
    expect(isSupportedPackImportFilename('c.txt')).toBe(false);
  });
});
