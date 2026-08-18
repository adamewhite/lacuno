/**
 * Letter values and scoring for the phrase game.
 *
 * Vowels are worth nothing: they are an unlimited supply, so scoring them would
 * make a rack's target say nothing about what is in it. Only the consonants —
 * the scarce tiles — carry points, which is what lets a rack's total be partial
 * information about a word before the player has guessed it. A rack targeting 0
 * is all vowels.
 *
 * The consonant values are deliberately LOW and REPEATED. Distinct values would
 * make a total nearly identify its word, turning the puzzle into arithmetic
 * bookkeeping; repeated values mean many consonant sets share a total, so the
 * player has to reason about what actually spells a word. Small numbers also
 * keep the mental arithmetic light — a typical rack targets under 10.
 *
 * Ordering is roughly by frequency in English, so the commonest consonants are
 * cheapest: S R T N L D C M P G H B Y F K W V Z X J Q.
 */

export type LetterValues = readonly number[];

export const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

/** Build a 26-slot value array from a consonant map. Vowels stay at 0. */
function consonantScheme(map: Record<string, number>): LetterValues {
  const values = new Array(26).fill(0);
  for (const [letter, value] of Object.entries(map)) {
    values[letter.charCodeAt(0) - 65] = value;
  }
  return values;
}

/** The shipped valuation. Y scores: it behaves as a consonant here. */
export const TILE_VALUES = consonantScheme({
  S: 1, R: 1, T: 1, N: 2, L: 2, D: 2, C: 3, M: 3, P: 3, G: 3,
  H: 4, B: 4, Y: 4, F: 5, K: 5, W: 5, V: 6, Z: 6, X: 6, J: 7, Q: 7,
});

/**
 * Score a word: the plain sum of its letter values.
 *
 * Order does not matter, so anagrams always score identically — in the phrase
 * game that is harmless, since the phrase itself is what makes the answer
 * unique.
 *
 * Throws on anything but uppercase A-Z: silently skipping a stray character
 * would make a rack's target quietly wrong.
 */
export function scoreWord(word: string, values: LetterValues = TILE_VALUES): number {
  let total = 0;
  for (let i = 0; i < word.length; i++) {
    const index = word.charCodeAt(i) - 65;
    if (index < 0 || index >= 26) {
      throw new Error(`Expected uppercase A-Z, got ${JSON.stringify(word[i])}`);
    }
    total += values[index];
  }
  return total;
}
