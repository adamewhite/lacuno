import { describe, expect, it } from 'vitest';

import puzzleData from './puzzles.json';
import vowelData from './puzzles-vowels.json';
import type { PuzzleData } from './usePuzzle';

/**
 * Verifies the generated puzzle payload itself — that every puzzle is coherent
 * and actually solvable by its stated answer. The React hook is exercised by
 * hand in the browser; this guards the data it depends on.
 */
const puzzles = puzzleData.puzzles as unknown as PuzzleData[];
const values = puzzleData.values as number[];

const score = (word: string) =>
  [...word].reduce((sum, c) => sum + values[c.charCodeAt(0) - 65], 0);

describe('generated puzzles', () => {
  it('ships at least one puzzle', () => {
    expect(puzzles.length).toBeGreaterThan(0);
  });

  it.each(puzzles.map((p, i) => [i, p] as const))('puzzle %i is coherent', (_i, puzzle) => {
    // Rack lengths match the answer words.
    expect(puzzle.racks.map((r) => r.length)).toEqual(puzzle.solution.map((w) => w.length));

    // Every rack's target is exactly its word's score.
    puzzle.racks.forEach((rack, i) => {
      expect(score(puzzle.solution[i])).toBe(rack.target);
    });

    // The answer uses every tile, exactly — no leftovers (SPEC §2).
    expect([...puzzle.solution.join('')].sort()).toEqual([...puzzle.tiles].sort());

    // Slot count equals tile count.
    const slots = puzzle.racks.reduce((n, r) => n + r.length, 0);
    expect(slots).toBe(puzzle.tiles.length);
  });

  it.each(puzzles.map((p, i) => [i, p] as const))('puzzle %i has usable hints', (_i, puzzle) => {
    for (const pin of puzzle.pins) {
      // The pin points at a real slot...
      expect(pin.rackIndex).toBeGreaterThanOrEqual(0);
      expect(pin.rackIndex).toBeLessThan(puzzle.racks.length);
      expect(pin.slot).toBeGreaterThanOrEqual(0);
      expect(pin.slot).toBeLessThan(puzzle.racks[pin.rackIndex].length);

      // ...and names the letter the answer actually has there, so revealing a
      // hint can never contradict a valid solution.
      expect(puzzle.solution[pin.rackIndex][pin.slot]).toBe(pin.letter);
    }
  });

  it('never places two hints in the same slot', () => {
    for (const puzzle of puzzles) {
      const keys = puzzle.pins.map((p) => `${p.rackIndex}:${p.slot}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('uses tile values consistently across the payload', () => {
    expect(values).toHaveLength(26);
    // E and O are free — the choice that keeps rack totals small.
    expect(values['E'.charCodeAt(0) - 65]).toBe(0);
    expect(values['O'.charCodeAt(0) - 65]).toBe(0);
  });
});

describe('zero-vowels variant', () => {
  const vowelPuzzles = vowelData.puzzles as unknown as (PuzzleData & {
    vowels: string[];
    consonants: string[];
  })[];
  const vowelValues = vowelData.values as number[];
  const vscore = (word: string) =>
    [...word].reduce((sum, c) => sum + vowelValues[c.charCodeAt(0) - 65], 0);

  it('ships puzzles', () => {
    expect(vowelPuzzles.length).toBeGreaterThan(0);
  });

  it('scores every vowel at zero', () => {
    for (const vowel of ['A', 'E', 'I', 'O', 'U']) {
      expect(vowelValues[vowel.charCodeAt(0) - 65]).toBe(0);
    }
  });

  it('gives Y a value — it is a consonant here', () => {
    expect(vowelValues['Y'.charCodeAt(0) - 65]).toBeGreaterThan(0);
  });

  it.each(vowelPuzzles.map((p, i) => [i, p] as const))(
    'puzzle %i splits the pool without changing it',
    (_i, puzzle) => {
      // The split is presentational: vowels + consonants must reconstitute the
      // full tile pool exactly, so "use every tile" still means every tile.
      expect([...puzzle.vowels, ...puzzle.consonants].sort()).toEqual([...puzzle.tiles].sort());

      // And the pool is still exactly the answer's letters — no unlimited
      // supply, no leftovers.
      expect([...puzzle.solution.join('')].sort()).toEqual([...puzzle.tiles].sort());
    },
  );

  it.each(vowelPuzzles.map((p, i) => [i, p] as const))(
    'puzzle %i targets only consonant value',
    (_i, puzzle) => {
      puzzle.racks.forEach((rack, i) => {
        expect(vscore(puzzle.solution[i])).toBe(rack.target);
      });
    },
  );

  it('keeps rack totals small', () => {
    // The whole point of zeroing vowels: less arithmetic per rack.
    const targets = vowelPuzzles.flatMap((p) => p.racks.map((r) => r.target));
    const mean = targets.reduce((a, b) => a + b, 0) / targets.length;
    expect(mean).toBeLessThan(20);
  });
});
