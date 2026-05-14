import { sanitiseFtsQuery } from '../pack';

describe('sanitiseFtsQuery (D-FTS-3)', () => {
  it('ASCII whitespace → OR-of-prefix grammar', () => {
    expect(sanitiseFtsQuery('banking information scammer')).toBe(
      '(banking* OR information* OR scammer*)'
    );
  });

  it('CJK no-whitespace → per-grapheme prefix-OR', () => {
    const out = sanitiseFtsQuery('网络诈骗');
    expect(out).toContain('网*');
    expect(out).toContain('络*');
    expect(out).toContain('诈*');
    expect(out).toContain('骗*');
    expect(out.startsWith('(')).toBe(true);
    expect(out.endsWith(')')).toBe(true);
  });

  it('Mixed EN + ZH → union of both transforms', () => {
    const out = sanitiseFtsQuery('scam 网络');
    expect(out).toContain('scam*');
    expect(out).toContain('网*');
    expect(out).toContain('络*');
  });

  it('Empty / whitespace-only → empty string', () => {
    expect(sanitiseFtsQuery('   ')).toBe('');
    expect(sanitiseFtsQuery('')).toBe('');
  });

  it('Strips FTS5 metacharacters', () => {
    const out = sanitiseFtsQuery('"banking" * info^');
    expect(out).not.toContain('"');
    expect(out).not.toContain('^');
    expect(out).toContain('banking*');
    expect(out).toContain('info*');
  });
});

describe('searchPack zero-hit OFFLINEAID_FTS_DIAG log (D-FTS-4)', () => {
  it('logs OFFLINEAID_FTS_DIAG zero-hit with sanitised query when retrieval is empty', async () => {
    const origDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = true;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    jest.resetModules();
    jest.doMock('expo-sqlite', () => ({
      openDatabaseAsync: async () => ({
        getAllAsync: async () => [],
        getFirstAsync: async () => null,
        closeAsync: async () => {},
      }),
    }));

    const { searchPack: searchPackMocked } = require('../pack');
    await searchPackMocked('/fake/pack.db', 'definitelyNoMatch');

    const diagCalls = logSpy.mock.calls.filter(
      ([first]) => typeof first === 'string' && first.startsWith('OFFLINEAID_FTS_DIAG ')
    );
    expect(diagCalls).toHaveLength(1);
    const payload = JSON.parse(
      (diagCalls[0][0] as string).slice('OFFLINEAID_FTS_DIAG '.length)
    );
    expect(payload).toMatchObject({
      kind: 'zero-hit',
      originalQuery: 'definitelyNoMatch',
      packId: '/fake/pack.db',
    });
    expect(typeof payload.sanitisedQuery).toBe('string');

    logSpy.mockRestore();
    (globalThis as any).__DEV__ = origDev;
    jest.dontMock('expo-sqlite');
  });
});
