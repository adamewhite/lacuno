import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isFullySolved, loadDays, recordDay } from './storage';

/** A minimal in-memory localStorage, since vitest runs without a DOM here. */
function stubStorage() {
  const map = new Map<string, string>();
  const store = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
  vi.stubGlobal('window', { localStorage: store });
  return map;
}

describe('recordDay / loadDays', () => {
  beforeEach(() => {
    stubStorage();
  });

  it('reads back a recorded day', () => {
    recordDay('2026-09-15', { solved: 3, rounds: 3, hints: 1 });
    expect(loadDays()['2026-09-15']).toEqual({ solved: 3, rounds: 3, hints: 1 });
  });

  it('starts empty', () => {
    expect(loadDays()).toEqual({});
  });

  it('keeps several days apart', () => {
    recordDay('2026-09-14', { solved: 1, rounds: 3, hints: 0 });
    recordDay('2026-09-15', { solved: 3, rounds: 3, hints: 2 });
    expect(Object.keys(loadDays()).sort()).toEqual(['2026-09-14', '2026-09-15']);
  });

  it('keeps the first completion of a day', () => {
    // Replaying an archived day must not overwrite a better result.
    recordDay('2026-09-15', { solved: 3, rounds: 3, hints: 0 });
    recordDay('2026-09-15', { solved: 0, rounds: 3, hints: 9 });
    expect(loadDays()['2026-09-15'].solved).toBe(3);
  });

  it('survives unparseable stored data', () => {
    const map = stubStorage();
    map.set('lacuno:days', 'not json');
    expect(loadDays()).toEqual({});
  });

  it('discards data from a different schema version', () => {
    const map = stubStorage();
    map.set('lacuno:days', JSON.stringify({ version: 99, days: { x: {} } }));
    expect(loadDays()).toEqual({});
  });

  it('does not throw when storage is unavailable', () => {
    vi.stubGlobal('window', undefined);
    expect(() => recordDay('2026-09-15', { solved: 1, rounds: 3, hints: 0 })).not.toThrow();
    expect(loadDays()).toEqual({});
  });

  it('does not throw when writing throws', () => {
    // Private browsing and exhausted quotas throw on setItem.
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('quota');
        },
      },
    });
    expect(() => recordDay('2026-09-15', { solved: 1, rounds: 3, hints: 0 })).not.toThrow();
  });
});

describe('isFullySolved', () => {
  it('is true only when every round was solved', () => {
    expect(isFullySolved({ solved: 3, rounds: 3, hints: 0 })).toBe(true);
  });

  it('is false for a partial game', () => {
    // Giving up on a round must not read as a solve — the board fills with the
    // answer either way, so this distinction is the whole point of the record.
    expect(isFullySolved({ solved: 2, rounds: 3, hints: 0 })).toBe(false);
    expect(isFullySolved({ solved: 0, rounds: 3, hints: 0 })).toBe(false);
  });

  it('is false for a missing record', () => {
    expect(isFullySolved(undefined)).toBe(false);
  });

  it('is false for a zero-round record', () => {
    expect(isFullySolved({ solved: 0, rounds: 0, hints: 0 })).toBe(false);
  });
});
