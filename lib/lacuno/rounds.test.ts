import { describe, expect, it } from 'vitest';

import { pickRounds, ROUND_BANDS, ROUND_COUNT } from './rounds';

/** A pool with one puzzle at each given length. */
const pool = (...lengths: number[]) => lengths.map((letterCount) => ({ letterCount }));
/** Play the pool in its natural order. */
const inOrder = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('pickRounds', () => {
  it('picks one puzzle per round', () => {
    const puzzles = pool(8, 11, 15);
    expect(pickRounds(puzzles, inOrder(3))).toHaveLength(ROUND_COUNT);
  });

  it('picks strictly ascending lengths', () => {
    const puzzles = pool(4, 8, 9, 10, 11, 12, 13, 16, 21);
    const rounds = pickRounds(puzzles, inOrder(puzzles.length));
    const lengths = rounds.map((i) => puzzles[i].letterCount);
    for (let i = 1; i < lengths.length; i++) {
      expect(lengths[i]).toBeGreaterThan(lengths[i - 1]);
    }
  });

  it('draws each round from its band', () => {
    const puzzles = pool(8, 11, 15);
    const rounds = pickRounds(puzzles, inOrder(3));
    rounds.forEach((pick, round) => {
      const n = puzzles[pick].letterCount;
      expect(n).toBeGreaterThanOrEqual(ROUND_BANDS[round].min);
      expect(n).toBeLessThanOrEqual(ROUND_BANDS[round].max);
    });
  });

  it('never repeats a puzzle', () => {
    const puzzles = pool(9, 9, 11, 11, 14, 14);
    const rounds = pickRounds(puzzles, inOrder(puzzles.length));
    expect(new Set(rounds).size).toBe(rounds.length);
  });

  it('follows the shuffled order within a band', () => {
    // Two phrases fit round one; the order decides which is used.
    const puzzles = pool(8, 9, 11, 15);
    expect(pickRounds(puzzles, [0, 1, 2, 3])[0]).toBe(0);
    expect(pickRounds(puzzles, [1, 0, 2, 3])[0]).toBe(1);
  });

  it('still ascends when a band is empty', () => {
    // Nothing in the 10-12 band: round two must still beat round one.
    const puzzles = pool(8, 14, 16);
    const rounds = pickRounds(puzzles, inOrder(3));
    const lengths = rounds.map((i) => puzzles[i].letterCount);
    expect(lengths).toEqual([8, 14, 16]);
  });

  it('falls back when every puzzle is short', () => {
    const puzzles = pool(4, 5, 6);
    const rounds = pickRounds(puzzles, inOrder(3));
    expect(rounds.map((i) => puzzles[i].letterCount)).toEqual([4, 5, 6]);
  });

  it('returns fewer rounds than three when lengths cannot ascend', () => {
    // All the same length: only one round is possible.
    const puzzles = pool(11, 11, 11);
    expect(pickRounds(puzzles, inOrder(3))).toHaveLength(1);
  });

  it('handles an empty pool', () => {
    expect(pickRounds([], [])).toEqual([]);
  });

  it('works on the shipped pool', async () => {
    const data = (await import('../../app/puzzles-phrases.json')).default;
    const puzzles = data.puzzles as unknown as { letterCount: number }[];
    const rounds = pickRounds(puzzles, inOrder(puzzles.length));
    expect(rounds).toHaveLength(ROUND_COUNT);
    const lengths = rounds.map((i) => puzzles[i].letterCount);
    for (let i = 1; i < lengths.length; i++) {
      expect(lengths[i]).toBeGreaterThan(lengths[i - 1]);
    }
  });
});
