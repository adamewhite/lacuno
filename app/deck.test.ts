import { describe, expect, it } from 'vitest';

import phraseData from './puzzles-phrases.json';

/**
 * Puzzles are served from a shuffled deck rather than picked independently at
 * random, so a session never repeats one until every puzzle has been seen.
 * This mirrors the shuffle in page.tsx.
 */
function shuffle(count: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

describe('puzzle deck', () => {
  it('deals every puzzle exactly once', () => {
    // The point of a deck over independent random draws: no repeats, and
    // nothing is unreachable.
    for (let trial = 0; trial < 20; trial++) {
      const deck = shuffle(49);
      expect(new Set(deck).size).toBe(49);
      expect(Math.min(...deck)).toBe(0);
      expect(Math.max(...deck)).toBe(48);
    }
  });

  it('varies its order between shuffles', () => {
    // A deck that always dealt the same order would defeat the purpose. With
    // 49 puzzles the odds of two shuffles matching are vanishing.
    const first = shuffle(49).join();
    const differs = Array.from({ length: 10 }, () => shuffle(49).join()).some(
      (order) => order !== first,
    );
    expect(differs).toBe(true);
  });

  it('handles a single-puzzle deck', () => {
    expect(shuffle(1)).toEqual([0]);
  });
});

describe('puzzle library', () => {
  const puzzles = phraseData.puzzles as { category: string; phrase: string }[];

  it('carries the categories the board displays', () => {
    const categories = new Set(puzzles.map((p) => p.category));
    // Singular: each puzzle is one place or one person.
    expect(categories.has('Place')).toBe(true);
    expect(categories.has('Person')).toBe(true);
  });

  it('has no duplicate phrases', () => {
    const phrases = puzzles.map((p) => p.phrase);
    expect(new Set(phrases).size).toBe(phrases.length);
  });

  it('respects the content limits the layout can show', () => {
    // These bound what fits legibly on the smallest supported phone; the build
    // enforces them, and this guards the shipped payload.
    for (const { phrase } of puzzles) {
      const words = phrase.split(' ');
      expect(words.length).toBeLessThanOrEqual(5);
      // Nine, not ten: a ten-letter word drops below a comfortable tap target
      // on the narrowest phone supported (375px).
      for (const word of words) expect(word.length).toBeLessThanOrEqual(9);

      const consonants = [...phrase.replace(/ /g, '')].filter(
        (c) => !'AEIOU'.includes(c),
      );
      expect(consonants.length).toBeLessThanOrEqual(16);
    }
  });
});
