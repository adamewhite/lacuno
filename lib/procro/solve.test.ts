import { describe, expect, it } from 'vitest';

import { countLetters, scoreWord } from './letters';
import { hasUniqueSolution, isRackSatisfied, rackSearchSpace, solve } from './solve';
import type { LetterValues, Rack } from './types';

/**
 * A flat valuation (every letter = 1) makes a rack's target equal to its
 * length, which is useless as a constraint but perfect for testing the
 * *structural* half of the solver: tile consumption and backtracking.
 */
const FLAT: LetterValues = new Array(26).fill(1);

/**
 * Distinct small primes per letter, so a word's score is effectively a
 * fingerprint. Lets tests assert on scoring without hand-summing a real
 * valuation, and makes accidental collisions vanishingly unlikely.
 */
// prettier-ignore
const PRIMES: LetterValues = [
   2,  3,  5,  7, 11, 13, 17, 19, 23, 29, 31, 37, 41,
  43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101,
];

const score = (word: string) => scoreWord(word, PRIMES);

/** Sort solutions so assertions do not depend on search order. */
const normalize = (solutions: readonly (readonly string[])[]) =>
  solutions.map((s) => [...s]).sort((a, b) => a.join().localeCompare(b.join()));

describe('scoreWord', () => {
  it('sums letter values', () => {
    // C=5, A=2, T=71
    expect(scoreWord('CAT', PRIMES)).toBe(78);
  });

  it('scores anagrams identically', () => {
    // Every slot scores equally, so order cannot affect a total. This is why
    // pins — not values — are what separate anagrams (SPEC §2).
    expect(countLetters('STARE')).toEqual(countLetters('RATES'));
    expect(score('STARE')).toBe(score('RATES'));
  });

  it('rejects non-alphabetic input rather than silently skipping it', () => {
    expect(() => scoreWord('CA-T', PRIMES)).toThrow();
  });
});

describe('solve', () => {
  it('solves a single rack', () => {
    const dictionary = ['CAT', 'DOG', 'ACT'];
    const racks: Rack[] = [{ length: 3, target: score('DOG') }];

    expect(solve(['D', 'O', 'G'], racks, dictionary, PRIMES)).toEqual([['DOG']]);
  });

  it('returns both anagrams when nothing distinguishes them', () => {
    // No multiplier, so ACT and CAT score identically off the same tiles.
    // Exactly the ambiguity the generator must detect and repair (SPEC §6).
    const dictionary = ['CAT', 'ACT'];
    const racks: Rack[] = [{ length: 3, target: score('CAT') }];

    const solutions = solve(['C', 'A', 'T'], racks, dictionary, PRIMES);

    expect(normalize(solutions)).toEqual([['ACT'], ['CAT']]);
  });

  it('uses a pin to break an anagram tie', () => {
    // Same tiles and dictionary as above; the pin alone makes it unique.
    const dictionary = ['CAT', 'ACT'];
    const racks: Rack[] = [{ length: 3, target: score('CAT'), pins: { 0: 'C' } }];

    expect(solve(['C', 'A', 'T'], racks, dictionary, PRIMES)).toEqual([['CAT']]);
  });

  it('rejects a word that contradicts a pin', () => {
    const dictionary = ['CAT', 'ACT'];
    const racks: Rack[] = [{ length: 3, target: score('CAT'), pins: { 0: 'Z' } }];

    expect(solve(['C', 'A', 'T'], racks, dictionary, PRIMES)).toEqual([]);
  });

  it('honours a pin in a non-initial slot', () => {
    const dictionary = ['CAT', 'ACT'];
    const racks: Rack[] = [{ length: 3, target: score('ACT'), pins: { 2: 'T' } }];

    // Both end in T, so this pin does not disambiguate — proving the filter
    // matches the right slot rather than accidentally matching anything.
    expect(normalize(solve(['C', 'A', 'T'], racks, dictionary, PRIMES)))
      .toEqual([['ACT'], ['CAT']]);
  });

  it('returns words aligned to the racks that were passed in', () => {
    // Racks are searched fewest-candidates-first, so this pins down that
    // results are written back to original positions, not search order.
    const dictionary = ['CAT', 'DOGS'];
    const racks: Rack[] = [
      { length: 4, target: score('DOGS') },
      { length: 3, target: score('CAT') },
    ];

    const solutions = solve(
      ['D', 'O', 'G', 'S', 'C', 'A', 'T'],
      racks,
      dictionary,
      PRIMES,
    );

    expect(solutions).toEqual([['DOGS', 'CAT']]);
  });

  it('splits a shared pool across racks by backtracking', () => {
    // A greedy first pass could hand OAT's tiles to the wrong rack; only
    // backtracking finds the split that consumes the pool exactly.
    const dictionary = ['OAT', 'TOAD', 'GOAT', 'DO', 'AT', 'TAG'];
    const racks: Rack[] = [
      { length: 4, target: score('GOAT') },
      { length: 2, target: score('DO') },
    ];

    const solutions = solve(
      ['G', 'O', 'A', 'T', 'D', 'O'],
      racks,
      dictionary,
      PRIMES,
    );

    expect(solutions).toEqual([['GOAT', 'DO']]);
  });

  it('rejects a board that leaves tiles unused', () => {
    // CAT is a valid word at the right target, but one tile would be left
    // over. All tiles must be used (SPEC §2).
    const dictionary = ['CAT'];
    const racks: Rack[] = [{ length: 3, target: score('CAT') }];

    expect(solve(['C', 'A', 'T', 'S'], racks, dictionary, PRIMES)).toEqual([]);
  });

  it('rejects a valid word that misses the target', () => {
    const dictionary = ['CAT'];
    const racks: Rack[] = [{ length: 3, target: score('CAT') + 1 }];

    expect(solve(['C', 'A', 'T'], racks, dictionary, PRIMES)).toEqual([]);
  });

  it('rejects a word not in the dictionary', () => {
    const racks: Rack[] = [{ length: 3, target: score('CAT') }];

    expect(solve(['C', 'A', 'T'], racks, ['DOG'], PRIMES)).toEqual([]);
  });

  it('does not reuse a tile across two racks', () => {
    // One O in the pool, two racks that each want one. Under a flat valuation
    // the targets are satisfiable individually but not together.
    const dictionary = ['DO', 'ON'];
    const racks: Rack[] = [
      { length: 2, target: 2 },
      { length: 2, target: 2 },
    ];

    expect(solve(['D', 'O', 'N'], racks, dictionary, FLAT)).toEqual([]);
  });

  it('handles a pool with repeated letters', () => {
    const dictionary = ['NOON', 'MOON'];
    const racks: Rack[] = [{ length: 4, target: score('NOON') }];

    expect(solve(['N', 'O', 'O', 'N'], racks, dictionary, PRIMES)).toEqual([
      ['NOON'],
    ]);
  });

  it('finds every distinct way to fill three racks', () => {
    // Two interchangeable 3-letter fills over a shared pool, so the exhaustive
    // search must report both rather than stopping at the first.
    const dictionary = ['CAT', 'ACT', 'DOG'];
    const racks: Rack[] = [
      { length: 3, target: score('DOG') },
      { length: 3, target: score('CAT') },
    ];

    const solutions = solve(
      ['D', 'O', 'G', 'C', 'A', 'T'],
      racks,
      dictionary,
      PRIMES,
    );

    expect(normalize(solutions)).toEqual([
      ['DOG', 'ACT'],
      ['DOG', 'CAT'],
    ]);
  });

  it('respects the solution limit', () => {
    const dictionary = ['CAT', 'ACT'];
    const racks: Rack[] = [{ length: 3, target: score('CAT') }];

    expect(solve(['C', 'A', 'T'], racks, dictionary, PRIMES, { limit: 1 })).toHaveLength(1);
  });

  it('returns nothing for a board with no racks', () => {
    expect(solve(['C'], [], ['CAT'], PRIMES)).toEqual([]);
  });
});

describe('hasUniqueSolution', () => {
  const dictionary = ['CAT', 'ACT', 'DOG'];

  it('is true when exactly one solution exists', () => {
    const racks: Rack[] = [{ length: 3, target: score('DOG') }];
    expect(hasUniqueSolution(['D', 'O', 'G'], racks, dictionary, PRIMES)).toBe(true);
  });

  it('is false when a second solution exists', () => {
    const racks: Rack[] = [{ length: 3, target: score('CAT') }];
    expect(hasUniqueSolution(['C', 'A', 'T'], racks, dictionary, PRIMES)).toBe(false);
  });

  it('is false when no solution exists', () => {
    const racks: Rack[] = [{ length: 3, target: 1 }];
    expect(hasUniqueSolution(['C', 'A', 'T'], racks, dictionary, PRIMES)).toBe(false);
  });
});

describe('the publish gate vs. what a player may spell', () => {
  // These two rules are easy to conflate, so they are pinned down together.
  // hasUniqueSolution decides which PUZZLES ship; isRackSatisfied decides what
  // the engine accepts during PLAY. A word is never "wrong" for being an
  // anagram of the intended answer — the board it would have spoiled simply
  // never gets published.
  const dictionary = ['STARE', 'RATES', 'GLOW'];
  const dictSet = new Set(dictionary);
  const tiles = [...'STARE'];

  it('rejects a board whose anagrams both satisfy the rack', () => {
    // Anagrams always share a total, so with no pin this is not publishable.
    const rack: Rack = { length: 5, target: score('STARE') };

    expect(hasUniqueSolution(tiles, [rack], dictionary, PRIMES)).toBe(false);
  });

  it('accepts a board where a pin isolates one anagram', () => {
    const rack: Rack = { length: 5, target: score('STARE'), pins: { 0: 'S' } };

    expect(hasUniqueSolution(tiles, [rack], dictionary, PRIMES)).toBe(true);
  });

  it('glows for ANY dictionary word hitting the target, not a stored answer', () => {
    // On an (unpublishable) board where both fit, both are accepted. The engine
    // has no notion of which word was "intended" — SPEC §2.
    const rack: Rack = { length: 5, target: score('STARE') };

    expect(isRackSatisfied('STARE', rack, dictSet, PRIMES)).toBe(true);
    expect(isRackSatisfied('RATES', rack, dictSet, PRIMES)).toBe(true);
  });

  it('does not glow for a word that contradicts a pin', () => {
    const rack: Rack = { length: 5, target: score('STARE'), pins: { 0: 'S' } };

    expect(isRackSatisfied('STARE', rack, dictSet, PRIMES)).toBe(true);
    // RATES is a perfectly good word at the right total, but the S is locked
    // into slot 0 and RATES does not have one there.
    expect(isRackSatisfied('RATES', rack, dictSet, PRIMES)).toBe(false);
  });

  it('does not glow for a non-dictionary word or a length mismatch', () => {
    const rack: Rack = { length: 5, target: score('STARE') };

    expect(isRackSatisfied('SATRE', rack, dictSet, PRIMES)).toBe(false);
    expect(isRackSatisfied('GLOW', rack, dictSet, PRIMES)).toBe(false);
  });
});

describe('rackSearchSpace', () => {
  it('counts candidates before the total constraint is applied', () => {
    // The difficulty proxy (SPEC §6): length + pool containment only, so both
    // 3-letter anagrams count even though a target would eliminate one.
    const dictionary = ['CAT', 'ACT', 'DOG', 'AT'];
    const racks: Rack[] = [
      { length: 3, target: score('CAT') },
      { length: 2, target: score('AT') },
    ];

    expect(rackSearchSpace(['C', 'A', 'T'], racks, dictionary)).toEqual([2, 1]);
  });
});
