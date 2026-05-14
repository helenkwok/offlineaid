/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

function findTestFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return findTestFiles(fullPath);
    }
    return /\.test\.[tj]sx?$/.test(entry) ? [fullPath] : [];
  });
}

describe('Expo Router app directory', () => {
  it('does not contain Jest test files that Expo Router would bundle as routes', () => {
    const appDir = join(process.cwd(), 'src', 'app');
    const routeTestFiles = findTestFiles(appDir).map((file) => relative(process.cwd(), file));

    expect(routeTestFiles).toEqual([]);
  });
});

