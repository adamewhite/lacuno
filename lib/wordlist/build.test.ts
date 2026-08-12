import { describe, expect, it } from 'vitest';

import { buildWordLists, hashDictionary, TIER_NAMES } from './build';
import { normalizeWord } from './ingest';
import type { RankedWord } from './ingest';

const DICT = new Set([
  'CAT', 'CATS', 'DOG', 'DOGS', 'WALK', 'WALKED', 'WALKING',
  'AEGIS', 'CHESS', 'HOUSE', 'STONE', 'RIVER', 'BAKE', 'BAKED', 'GO', 'ELEPHANTINE',
]);

/** Build a frequency list in descending-count order, as the source file is. */
const ranked = (...words: string[]): RankedWord[] =>
  words.map((word, i) => ({ word, count: 1000 - i, rank: i + 1 }));

describe('normalizeWord', () => {
  it('uppercases and trims', () => {
    expect(normalizeWord('  cat\r')).toBe('CAT');
  });

  it('strips 12dicts markup', () => {
    // `%` marks a plural of an uncountable noun, `!` a dubious entry. Both are
    // words a player may reasonably try, so the marker goes and the word stays.
    expect(normalizeWord('abandonments%')).toBe('ABANDONMENTS');
    expect(normalizeWord('abductee!')).toBe('ABDUCTEE');
  });

  it('rejects non-alphabetic entries', () => {
    expect(normalizeWord("don't")).toBeNull();
    expect(normalizeWord('a-b')).toBeNull();
    expect(normalizeWord('café')).toBeNull();
    expect(normalizeWord('')).toBeNull();
  });
});

describe('buildWordLists', () => {
  it('ships the whole dictionary, sorted', () => {
    const { dictionary } = buildWordLists(DICT, ranked('CAT'));

    expect(dictionary).toHaveLength(DICT.size);
    expect(dictionary).toEqual([...dictionary].sort());
    // Inflections stay valid to SPELL even when banned as solutions.
    expect(dictionary).toContain('CATS');
  });

  it('keeps the solution vocabulary a subset of the dictionary', () => {
    // The core invariant of the one-dictionary design: puzzles are built from
    // common words, but every one of them is a word the game accepts.
    const { dictionary, solutions } = buildWordLists(DICT, ranked('CAT', 'WALK', 'RIVER'));

    for (const { word } of solutions) expect(dictionary).toContain(word);
  });

  it('keeps inflections in the solution vocabulary by default', () => {
    // The flag defaults off, so CATS and WALKED are legal answers.
    const { solutions } = buildWordLists(DICT, ranked('CAT', 'CATS', 'WALKED'));

    expect(solutions.map((s) => s.word)).toEqual(['CAT', 'CATS', 'WALKED']);
  });

  it('drops inflections when the ban is enabled', () => {
    const { solutions, stats } = buildWordLists(
      DICT,
      ranked('CAT', 'CATS', 'WALKED', 'WALKING'),
      { banInflections: true },
    );

    expect(solutions.map((s) => s.word)).toEqual(['CAT']);
    expect(stats.dropped.inflection).toBe(3);
  });

  it('never bans a word that merely ends in S', () => {
    const { solutions } = buildWordLists(DICT, ranked('AEGIS', 'CHESS'), {
      banInflections: true,
    });

    expect(solutions.map((s) => s.word)).toEqual(['AEGIS', 'CHESS']);
  });

  it('tags inflections even when the ban is off', () => {
    // Metadata is always present so the generator can prefer non-inflections
    // without the pipeline having excluded them.
    const { solutions } = buildWordLists(DICT, ranked('CAT', 'CATS'));

    expect(solutions[0].inflection).toBeUndefined();
    expect(solutions[1].inflection).toBe('plural-s');
  });

  it('bars blocklisted words from being answers but keeps them spellable', () => {
    // The whole point of the blocklist: a player who spells CAT still wins,
    // but the generator will never build a puzzle whose answer is CAT.
    const { dictionary, solutions, stats } = buildWordLists(
      DICT,
      ranked('CAT', 'DOG'),
      { blocklist: new Set(['CAT']) },
    );

    expect(solutions.map((s) => s.word)).toEqual(['DOG']);
    expect(dictionary).toContain('CAT');
    expect(stats.dropped.blocked).toBe(1);
  });

  it('ignores blocklist entries that are not candidates anyway', () => {
    const { stats } = buildWordLists(DICT, ranked('CAT'), {
      blocklist: new Set(['ZORP']),
    });

    expect(stats.dropped.blocked).toBe(0);
  });

  it('drops frequency words that are not real words', () => {
    const { solutions, stats } = buildWordLists(DICT, ranked('CAT', 'AGGREGATOR'));

    expect(solutions.map((s) => s.word)).toEqual(['CAT']);
    expect(stats.dropped.notInDictionary).toBe(1);
  });

  it('filters by length', () => {
    const { solutions, stats } = buildWordLists(
      DICT,
      ranked('GO', 'CAT', 'ELEPHANTINE'),
      { minLength: 3, maxLength: 8 },
    );

    expect(solutions.map((s) => s.word)).toEqual(['CAT']);
    expect(stats.dropped.length).toBe(2);
  });

  it('preserves frequency order, most common first', () => {
    const { solutions } = buildWordLists(DICT, ranked('CAT', 'DOG', 'RIVER'));

    expect(solutions.map((s) => s.word)).toEqual(['CAT', 'DOG', 'RIVER']);
    expect(solutions.map((s) => s.rank)).toEqual([1, 2, 3]);
  });

  it('caps the vocabulary at the most common words', () => {
    const { solutions, stats } = buildWordLists(
      DICT,
      ranked('CAT', 'DOG', 'RIVER', 'STONE'),
      { maxWords: 2 },
    );

    expect(solutions.map((s) => s.word)).toEqual(['CAT', 'DOG']);
    expect(stats.dropped.overCap).toBe(2);
  });

  it('assigns tiers easiest-first across the vocabulary', () => {
    const words = ['CAT', 'DOG', 'WALK', 'BAKE', 'HOUSE', 'STONE', 'RIVER', 'AEGIS'];
    const { solutions } = buildWordLists(DICT, ranked(...words));

    // Eight words, four tiers, two per tier.
    expect(solutions.map((s) => s.tier)).toEqual([
      'common', 'common', 'familiar', 'familiar',
      'uncommon', 'uncommon', 'rare', 'rare',
    ]);
  });

  it('reports stats that account for every candidate', () => {
    const input = ranked('CAT', 'CATS', 'GO', 'AGGREGATOR');
    const { solutions, stats } = buildWordLists(DICT, input, { banInflections: true });

    const { notInDictionary, length, blocked, inflection, overCap } = stats.dropped;
    expect(
      solutions.length + notInDictionary + length + blocked + inflection + overCap,
    ).toBe(input.length);
    expect(stats.solutionCount).toBe(solutions.length);
    expect(stats.dictionaryCount).toBe(DICT.size);
    expect(Object.values(stats.byTier).reduce((a, b) => a + b, 0)).toBe(solutions.length);
  });

  it('handles an empty frequency list', () => {
    const { solutions, stats } = buildWordLists(DICT, []);

    expect(solutions).toEqual([]);
    expect(TIER_NAMES.every((t) => stats.byTier[t] === 0)).toBe(true);
  });
});

describe('hashDictionary', () => {
  it('is stable across input order', () => {
    // Reformatting or reordering the source must not invalidate queued puzzles.
    expect(hashDictionary(['CAT', 'DOG'])).toBe(hashDictionary(['DOG', 'CAT']));
  });

  it('changes when a word is added or removed', () => {
    // The drift guard: any patch must force re-verification (SPEC §5).
    const base = hashDictionary(['CAT', 'DOG']);
    expect(hashDictionary(['CAT', 'DOG', 'EMU'])).not.toBe(base);
    expect(hashDictionary(['CAT'])).not.toBe(base);
  });
});
