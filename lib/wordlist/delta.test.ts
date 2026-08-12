import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { applyDelta, loadDelta, loadDictionary, loadWordList } from './ingest';

/** Write `content` to a temp file and return its path. */
function tempFile(name: string, content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'procro-'));
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

describe('loadWordList', () => {
  it('parses one word per line, uppercased', () => {
    const path = tempFile('base.txt', 'cat\ndog\nemu\n');
    expect([...loadWordList(path)].sort()).toEqual(['CAT', 'DOG', 'EMU']);
  });

  it('strips 12dicts markup and skips blanks and comments', () => {
    const path = tempFile('base.txt', '# header\ncat\n\nabandonments%\nabductee!\n');
    expect([...loadWordList(path)].sort()).toEqual(['ABANDONMENTS', 'ABDUCTEE', 'CAT']);
  });
});

describe('loadDelta', () => {
  it('parses additions and removals', () => {
    const path = tempFile('delta.txt', '+zorp\n-cat\n');
    const delta = loadDelta(path);

    expect([...delta.additions]).toEqual(['ZORP']);
    expect([...delta.removals]).toEqual(['CAT']);
  });

  it('ignores comments and blank lines', () => {
    const path = tempFile('delta.txt', '# a comment\n\n  \n+zorp\n');
    const delta = loadDelta(path);

    expect([...delta.additions]).toEqual(['ZORP']);
    expect(delta.removals.size).toBe(0);
  });

  it('rejects an entry with no + or - sign', () => {
    // Silently ignoring these would let a curator think a word was added when
    // it was not — the dictionary would drift from the file describing it.
    const path = tempFile('delta.txt', 'zorp\n');
    expect(() => loadDelta(path)).toThrow(/must start with/);
  });

  it('rejects a word that is both added and removed', () => {
    const path = tempFile('delta.txt', '+zorp\n-zorp\n');
    expect(() => loadDelta(path)).toThrow(/both adds and removes/);
  });

  it('rejects a non-alphabetic entry', () => {
    const path = tempFile('delta.txt', "+don't\n");
    expect(() => loadDelta(path)).toThrow(/not a valid word/);
  });
});

describe('applyDelta', () => {
  const base = new Set(['CAT', 'DOG']);

  it('adds and removes', () => {
    const merged = applyDelta(base, {
      additions: new Set(['EMU']),
      removals: new Set(['CAT']),
    });

    expect([...merged].sort()).toEqual(['DOG', 'EMU']);
  });

  it('leaves the base set untouched', () => {
    applyDelta(base, { additions: new Set(['EMU']), removals: new Set(['CAT']) });
    expect([...base].sort()).toEqual(['CAT', 'DOG']);
  });

  it('tolerates removing a word that is not present', () => {
    const merged = applyDelta(base, { additions: new Set(), removals: new Set(['ZORP']) });
    expect([...merged].sort()).toEqual(['CAT', 'DOG']);
  });
});

describe('loadDictionary', () => {
  it('merges base and delta into one list', () => {
    const basePath = tempFile('base.txt', 'cat\ndog\n');
    const deltaPath = tempFile('delta.txt', '+emu\n-cat\n');

    expect([...loadDictionary(basePath, deltaPath)].sort()).toEqual(['DOG', 'EMU']);
  });

  it('returns the base list when no delta is given', () => {
    const basePath = tempFile('base.txt', 'cat\ndog\n');
    expect([...loadDictionary(basePath)].sort()).toEqual(['CAT', 'DOG']);
  });
});
