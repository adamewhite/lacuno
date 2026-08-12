/**
 * Consonant valuations for the FREE_VOWELS variant.
 *
 * Vowels score 0 by definition here, so every scheme below differs only in its
 * consonants. With vowels carrying no information, the consonants must do all
 * the discriminating — which argues for a wider spread than the classic
 * variant needed.
 *
 * Consonant frequency in the solution vocabulary, most common first:
 *   S R T N L D C M P G H B Y F K W V Z X J Q
 */

import type { LetterValues } from '../procro/types';

/** Build a 26-slot array from a consonant map. Vowels are always 0. */
function consonantScheme(map: Record<string, number>): LetterValues {
  const values = new Array(26).fill(0);
  for (const [letter, value] of Object.entries(map)) {
    values[letter.charCodeAt(0) - 65] = value;
  }
  return values;
}

/**
 * The classic scheme's consonants, carried over unchanged. A baseline: it shows
 * what happens if we zero the vowels and change nothing else.
 */
export const CARRIED_OVER = consonantScheme({
  S: 1, R: 2, T: 2, L: 2, D: 3, N: 3, C: 4, G: 5, P: 5, H: 6, M: 6,
  B: 7, Y: 7, F: 8, W: 8, K: 9, V: 10, Z: 11, X: 12, J: 13, Q: 14,
});

/**
 * Tight 1-5 band across the common consonants. Smallest arithmetic, but the
 * least discriminating — included to see how far small numbers can go.
 */
export const TIGHT = consonantScheme({
  S: 1, R: 2, T: 3, N: 4, L: 5, D: 1, C: 2, M: 3, P: 4, G: 5,
  H: 6, B: 7, Y: 8, F: 9, K: 10, W: 11, V: 12, Z: 13, X: 14, J: 15, Q: 16,
});

/**
 * Spread the common consonants across 1-9 so sums separate further. Roughly
 * frequency-ordered: the most common consonants get the widest spacing, since
 * they appear most often and so do the most discriminating.
 */
export const SPREAD = consonantScheme({
  S: 1, R: 2, T: 3, N: 4, L: 5, D: 6, C: 7, M: 8, P: 9, G: 10,
  H: 11, B: 12, Y: 13, F: 14, K: 15, W: 16, V: 17, Z: 18, X: 19, J: 20, Q: 21,
});

/**
 * Coprime-leaning: values chosen to share few small factors, so different
 * consonant multisets are less likely to land on the same sum.
 */
export const COPRIME = consonantScheme({
  S: 1, R: 2, T: 3, N: 5, L: 7, D: 11, C: 13, M: 17, P: 19, G: 23,
  H: 29, B: 31, Y: 37, F: 41, K: 43, W: 47, V: 53, Z: 59, X: 61, J: 67, Q: 71,
});

/**
 * A middle setting: 1-7 for the eight most common consonants, climbing
 * moderately after. Aims to beat TIGHT on discrimination without SPREAD's
 * larger totals.
 */
export const MODERATE = consonantScheme({
  S: 1, R: 2, T: 3, N: 4, L: 5, D: 6, C: 7, M: 8, P: 9, G: 10,
  H: 11, B: 12, Y: 13, F: 14, K: 16, W: 18, V: 20, Z: 22, X: 24, J: 26, Q: 28,
});

/**
 * Deliberately LOW and REPEATED values.
 *
 * Distinct values make a total nearly identify its word, which turns the puzzle
 * into arithmetic bookkeeping. Repeated values make many consonant sets share a
 * total, so the player must reason about which letters actually spell a word
 * rather than just hitting a number. Generator hit rate suffers; that is paid
 * offline in retries and costs the player nothing.
 *
 * Frequency order: S R T N L D C M P G H B Y F K W V Z X J Q
 */

/** Common consonants all 1-3; rare ones only slightly higher. */
export const FLAT_3 = consonantScheme({
  S: 1, R: 1, T: 1, N: 2, L: 2, D: 2, C: 3, M: 3, P: 3, G: 3,
  H: 4, B: 4, Y: 4, F: 5, K: 5, W: 5, V: 6, Z: 6, X: 6, J: 7, Q: 7,
});

/** Four bands, 1-4, with rare letters capped low. Totals stay very small. */
export const FLAT_4 = consonantScheme({
  S: 1, R: 1, T: 2, N: 2, L: 2, D: 3, C: 3, M: 3, P: 4, G: 4,
  H: 4, B: 5, Y: 5, F: 5, K: 6, W: 6, V: 6, Z: 7, X: 7, J: 8, Q: 8,
});

/**
 * The most common consonants share just two values, so the bulk of any word
 * scores 1 or 2. Maximum ambiguity at minimum arithmetic.
 */
export const FLAT_2 = consonantScheme({
  S: 1, R: 1, T: 1, N: 1, L: 2, D: 2, C: 2, M: 2, P: 2, G: 3,
  H: 3, B: 3, Y: 3, F: 4, K: 4, W: 4, V: 5, Z: 5, X: 5, J: 6, Q: 6,
});

export const CONSONANT_CANDIDATES: ReadonlyArray<{
  readonly name: string;
  readonly values: LetterValues;
  readonly note: string;
}> = [
  { name: 'CARRIED_OVER', values: CARRIED_OVER, note: 'classic consonants, vowels zeroed' },
  { name: 'TIGHT', values: TIGHT, note: '1-5 common consonants' },
  { name: 'MODERATE', values: MODERATE, note: '1-10, then climbing' },
  { name: 'SPREAD', values: SPREAD, note: '1-10 evenly, frequency ordered' },
  { name: 'COPRIME', values: COPRIME, note: 'primes — maximum sum separation' },
  { name: 'FLAT_2', values: FLAT_2, note: 'common consonants share 1-2' },
  { name: 'FLAT_3', values: FLAT_3, note: 'common consonants 1-3' },
  { name: 'FLAT_4', values: FLAT_4, note: 'common consonants 1-4' },
];
