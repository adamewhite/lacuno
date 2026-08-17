import { describe, expect, it } from 'vitest';

import { DEFAULT_DIFFICULTY, DIFFICULTIES, planVowels } from './difficulty';

const COLD_FEET = ['COLD', 'FEET'];
const BLUE_MOON = ['ONCE', 'IN', 'A', 'BLUE', 'MOON'];

/** Render a plan's pre-filled board, `_` for slots left to the player. */
const board = (words: readonly string[], plan: ReturnType<typeof planVowels>) =>
  words
    .map((word, rack) =>
      [...word].map((_, slot) => plan.prefilled.get(`${rack}:${slot}`) ?? '_').join(''),
    )
    .join(' ');

describe('planVowels', () => {
  it('gives away every vowel at the easiest level, and disables all piles', () => {
    const plan = planVowels(COLD_FEET, 'easiest');
    expect(board(COLD_FEET, plan)).toBe('_O__ _EE_');
    expect(plan.enabled.size).toBe(0);
  });

  it('gives away one whole vowel at the easier level', () => {
    // E appears twice in FEET and O once in COLD, so E is the one worth giving.
    const plan = planVowels(COLD_FEET, 'easier');
    expect(board(COLD_FEET, plan)).toBe('____ _EE_');
    expect([...plan.enabled]).toEqual(['O']);
  });

  it('gives away nothing at the medium level, but offers only vowels in play', () => {
    // The help here is knowing which vowels are absent, not seeing any placed —
    // less than `easier` hands you, which is why it sits above it.
    const plan = planVowels(COLD_FEET, 'medium');
    expect(board(COLD_FEET, plan)).toBe('____ ____');
    expect([...plan.enabled].sort()).toEqual(['E', 'O']);
  });

  it('gives away nothing at the hardest level, and offers all five piles', () => {
    // COLD FEET has no A, I or U — but disabling those piles would say so.
    const plan = planVowels(COLD_FEET, 'hardest');
    expect(board(COLD_FEET, plan)).toBe('____ ____');
    expect([...plan.enabled].sort()).toEqual(['A', 'E', 'I', 'O', 'U']);
  });

  it('fills every occurrence of a given vowel, across racks', () => {
    // O appears in ONCE and twice in MOON: all three are filled together.
    const plan = planVowels(BLUE_MOON, 'easier');
    expect(board(BLUE_MOON, plan)).toBe('O___ __ _ ____ _OO_');
  });

  it('orders the levels by how much they give away', () => {
    // Each level should hand over at least as much as the one below it.
    const counts = DIFFICULTIES.map(
      (d) => planVowels(COLD_FEET, d).prefilled.size,
    );
    expect(counts[0]).toBeGreaterThanOrEqual(counts[1]); // easiest >= easier
    expect(counts[1]).toBeGreaterThanOrEqual(counts[2]); // easier  >= medium
    expect(counts[2]).toBeGreaterThanOrEqual(counts[3]); // medium  >= hardest
  });

  it('never leaves a pile enabled for a vowel it has given away', () => {
    for (const difficulty of DIFFICULTIES) {
      const plan = planVowels(BLUE_MOON, difficulty);
      const given = new Set(plan.prefilled.values());
      for (const letter of given) expect(plan.enabled.has(letter)).toBe(false);
    }
  });

  it('only ever fills slots that actually hold that vowel', () => {
    for (const difficulty of DIFFICULTIES) {
      const plan = planVowels(BLUE_MOON, difficulty);
      for (const [key, letter] of plan.prefilled) {
        const [rack, slot] = key.split(':').map(Number);
        expect(BLUE_MOON[rack][slot]).toBe(letter);
      }
    }
  });

  it('handles a phrase with no vowels at all', () => {
    const plan = planVowels(['MY', 'GYM'], 'easiest');
    expect(plan.prefilled.size).toBe(0);
    expect(plan.enabled.size).toBe(0);
  });

  it('lands a new visitor on the easiest level', () => {
    expect(DEFAULT_DIFFICULTY).toBe('easiest');
  });
});
