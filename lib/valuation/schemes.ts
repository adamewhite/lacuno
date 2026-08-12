/**
 * Candidate tile valuations for the harness to compare. SPEC §4.
 *
 * Design constraints (from the brief):
 *   1. Common letters spread across 1-5 so totals discriminate where English
 *      actually lives.
 *   2. A vowel in each band, so vowels do not clump on one value — a word's
 *      vowels should carry different weight from each other.
 *   3. Rare letters trend highest, preserving intuitive ordering.
 *   4. 0 is allowed, to keep totals small and readable.
 *
 * Letter frequency in the solution vocabulary, most common first:
 *   E S A R I T N O L D C U G P M H B Y F K W V Z X J Q
 * Note S ranks 2nd and C/L rank high — dictionary frequency, not prose
 * frequency (SPEC §4).
 */

import type { LetterValues } from '../procro/types';

/** Build a 26-slot value array from a letter->value map. */
function scheme(map: Record<string, number>): LetterValues {
  const values = new Array(26).fill(0);
  for (const [letter, value] of Object.entries(map)) {
    values[letter.charCodeAt(0) - 65] = value;
  }
  return values;
}

/**
 * Scrabble values — the baseline SPEC §4 argues against. Ten common letters
 * all worth 1 makes totals non-discriminating exactly where English lives.
 * Included to quantify that claim, not as a candidate.
 */
export const SCRABBLE = scheme({
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
});

/**
 * The brief, read literally: the 12 most common letters cycle 1-5, with the
 * vowels landing on different values. Rare letters climb from 6.
 *
 * Vowel spread: A=3 E=1 I=4 O=2 U=5.
 */
export const SPREAD_12 = scheme({
  E: 1, S: 2, A: 3, R: 4, I: 5, T: 1, N: 2, O: 2, L: 3, D: 4, C: 5, U: 5,
  G: 6, P: 6, M: 7, H: 7, B: 8, Y: 8, F: 9, K: 10, W: 10, V: 11,
  Z: 12, X: 13, J: 14, Q: 15,
});

/**
 * Same shape, but using 0 for the single most common letter. E appears in 12%
 * of all letter slots; making it free means totals are driven by the letters
 * that vary, and keeps maximum totals low.
 *
 * Vowel spread: A=3 E=0 I=4 O=2 U=5.
 */
export const ZERO_E = scheme({
  E: 0, S: 2, A: 3, R: 4, I: 5, T: 1, N: 2, O: 2, L: 3, D: 4, C: 5, U: 5,
  G: 6, P: 6, M: 7, H: 7, B: 8, Y: 8, F: 9, K: 10, W: 10, V: 11,
  Z: 12, X: 13, J: 14, Q: 15,
});

/**
 * Wider bands for the top letters (1-7 rather than 1-5) to test whether the
 * brief's 1-5 ceiling is costing discrimination. Rare letters still highest.
 *
 * Vowel spread: A=3 E=1 I=5 O=6 U=7.
 */
export const SPREAD_WIDE = scheme({
  E: 1, S: 2, A: 3, R: 4, I: 5, T: 6, N: 7, O: 6, L: 4, D: 5, C: 7, U: 7,
  G: 8, P: 8, M: 9, H: 9, B: 10, Y: 10, F: 11, K: 12, W: 12, V: 13,
  Z: 14, X: 15, J: 16, Q: 17,
});

/**
 * Coprime-leaning values for the common letters, so sums are less likely to
 * coincide. Same 1-5 band and vowel spread as SPREAD_12, but the mid-frequency
 * letters get values that do not share small factors with the top band.
 *
 * Vowel spread: A=3 E=1 I=4 O=2 U=7.
 */
export const COPRIME = scheme({
  E: 1, S: 2, A: 3, R: 4, I: 4, T: 5, N: 5, O: 2, L: 3, D: 7, C: 7, U: 7,
  G: 9, P: 9, M: 11, H: 11, B: 13, Y: 13, F: 16, K: 17, W: 17, V: 19,
  Z: 23, X: 26, J: 29, Q: 31,
});

/**
 * Frequency-proportional: the most common letters get the widest spacing,
 * following SPEC §4's claim that high-frequency letters need the MOST
 * differentiation because they do the discriminating work.
 *
 * Vowel spread: A=4 E=1 I=6 O=3 U=9.
 */
export const FREQ_WEIGHTED = scheme({
  E: 1, S: 2, A: 4, R: 5, I: 6, T: 7, N: 8, O: 3, L: 9, D: 10, C: 11, U: 9,
  G: 12, P: 12, M: 13, H: 13, B: 14, Y: 14, F: 15, K: 16, W: 16, V: 17,
  Z: 18, X: 19, J: 20, Q: 21,
});

/**
 * The brief's 1-5 band, but with the top letters using the FULL range rather
 * than clustering at the low end — E=1 S=2 A=3 R=4 I=5 uses every value, and
 * the next tier repeats the cycle offset so common letters keep differing from
 * each other. Tests whether 1-5 can compete once it is used efficiently.
 *
 * Vowel spread: A=3 E=1 I=5 O=4 U=2.
 */
export const BAND_5_TIGHT = scheme({
  E: 1, S: 2, A: 3, R: 4, I: 5, T: 3, N: 1, O: 4, L: 5, D: 2, C: 6, U: 2,
  G: 7, P: 6, M: 8, H: 7, B: 9, Y: 8, F: 10, K: 11, W: 10, V: 12,
  Z: 13, X: 14, J: 15, Q: 16,
});

/**
 * 0-5 band: E free, the rest of the top tier spread across 1-5 and reusing the
 * range. Keeps totals lowest of any candidate while testing whether 0 buys
 * discrimination or just shrinks numbers.
 *
 * Vowel spread: A=3 E=0 I=5 O=4 U=2.
 */
export const BAND_0_5 = scheme({
  E: 0, S: 2, A: 3, R: 4, I: 5, T: 3, N: 1, O: 4, L: 5, D: 2, C: 6, U: 2,
  G: 7, P: 6, M: 8, H: 7, B: 9, Y: 8, F: 10, K: 11, W: 10, V: 12,
  Z: 13, X: 14, J: 15, Q: 16,
});

/**
 * A compromise: the brief's vowel-per-band rule and intuitive rare-letter
 * ordering, but common letters get frequency-proportional spacing across 0-9
 * rather than being capped at 5. Rare letters stay highest.
 *
 * Vowel spread: A=4 E=0 I=6 O=3 U=8.
 */
export const HYBRID = scheme({
  E: 0, S: 2, A: 4, R: 5, I: 6, T: 7, N: 1, O: 3, L: 9, D: 8, C: 10, U: 8,
  G: 11, P: 11, M: 12, H: 12, B: 13, Y: 13, F: 14, K: 15, W: 15, V: 16,
  Z: 17, X: 18, J: 19, Q: 20,
});

/**
 * BAND_5_TIGHT with the mid-frequency letters pushed onto values that do not
 * share factors with the 1-5 band, so a 6th or 7th letter is less likely to
 * reproduce a sum reachable from the common ones. Top tier stays strictly 1-5.
 *
 * Vowel spread: A=3 E=1 I=5 O=4 U=2.
 */
export const BAND_5_COPRIME = scheme({
  E: 1, S: 2, A: 3, R: 4, I: 5, T: 3, N: 1, O: 4, L: 5, D: 2, C: 7, U: 2,
  G: 8, P: 7, M: 11, H: 8, B: 13, Y: 11, F: 14, K: 17, W: 14, V: 19,
  Z: 23, X: 26, J: 29, Q: 31,
});

/**
 * As BAND_5_COPRIME but E=0. E is 12% of all letter slots, so making it free
 * both shrinks totals and stops the most common letter from contributing noise
 * to every sum.
 *
 * Vowel spread: A=3 E=0 I=5 O=4 U=2.
 */
export const BAND_5_COPRIME_ZERO = scheme({
  E: 0, S: 2, A: 3, R: 4, I: 5, T: 3, N: 1, O: 4, L: 5, D: 2, C: 7, U: 2,
  G: 8, P: 7, M: 11, H: 8, B: 13, Y: 11, F: 14, K: 17, W: 14, V: 19,
  Z: 23, X: 26, J: 29, Q: 31,
});

/**
 * Low-arithmetic candidates.
 *
 * The schemes above optimize discrimination and let totals land wherever they
 * land — typically 21-25 for a 5-letter rack. But SPEC §3 has the player
 * re-summing a rack on EVERY placement, so the size of that sum is a real
 * usability cost, not a cosmetic one. These trade some generator yield for
 * arithmetic a player can do at a glance.
 *
 * Two levers, both aimed at reducing mental effort rather than digit count:
 *   - more ZEROS, so fewer tiles participate in the sum at all
 *   - a smaller top value, so no single addition crosses a decade
 */

/**
 * 0-3 across the common letters. Three of the five vowels are free, so a
 * typical word has only 2-3 tiles that need adding.
 *
 * Vowel spread: A=1 E=0 I=2 O=0 U=3.
 */
export const TINY_0_3 = scheme({
  E: 0, O: 0, S: 1, A: 1, T: 2, I: 2, R: 3, N: 3, L: 1, D: 2, C: 3, U: 3,
  G: 4, P: 4, M: 5, H: 5, B: 6, Y: 6, F: 7, K: 8, W: 7, V: 9,
  Z: 10, X: 11, J: 12, Q: 13,
});

/**
 * 0-4, a middle setting: the four most common letters (E, S, A, plus O) are
 * free or near-free, and the rest of the top tier stays single-digit-friendly.
 *
 * Vowel spread: A=1 E=0 I=3 O=0 U=4.
 */
export const TINY_0_4 = scheme({
  E: 0, O: 0, S: 1, A: 1, R: 2, T: 2, I: 3, N: 3, L: 2, D: 3, C: 4, U: 4,
  G: 5, P: 5, M: 6, H: 6, B: 7, Y: 7, F: 8, K: 9, W: 8, V: 10,
  Z: 11, X: 12, J: 13, Q: 14,
});

/**
 * As TINY_0_4 but with the rare letters capped much lower. Rare letters still
 * rank highest, but a Q no longer single-handedly doubles a rack's total —
 * which is where the ugly outlier arithmetic came from.
 *
 * Vowel spread: A=1 E=0 I=3 O=0 U=4.
 */
export const TINY_CAPPED = scheme({
  E: 0, O: 0, S: 1, A: 1, R: 2, T: 2, I: 3, N: 3, L: 2, D: 3, C: 4, U: 4,
  G: 4, P: 5, M: 5, H: 5, B: 6, Y: 6, F: 6, K: 7, W: 7, V: 7,
  Z: 8, X: 8, J: 9, Q: 9,
});

export const CANDIDATES: ReadonlyArray<{
  readonly name: string;
  readonly values: LetterValues;
  readonly note: string;
}> = [
  { name: 'SCRABBLE', values: SCRABBLE, note: 'baseline — not a candidate' },
  { name: 'SPREAD_12', values: SPREAD_12, note: 'brief as written, 1-5 bands' },
  { name: 'ZERO_E', values: ZERO_E, note: 'as above but E=0' },
  { name: 'SPREAD_WIDE', values: SPREAD_WIDE, note: 'wider 1-7 bands' },
  { name: 'COPRIME', values: COPRIME, note: '1-5 bands, coprime mids' },
  { name: 'FREQ_WEIGHTED', values: FREQ_WEIGHTED, note: 'spacing tracks frequency' },
  { name: 'BAND_5_TIGHT', values: BAND_5_TIGHT, note: '1-5 used efficiently' },
  { name: 'BAND_0_5', values: BAND_0_5, note: '0-5, E free' },
  { name: 'HYBRID', values: HYBRID, note: '0-9 common, vowels spread' },
  { name: 'BAND_5_COPRIME', values: BAND_5_COPRIME, note: '1-5 top, coprime mids' },
  { name: 'BAND_5_COPRIME_ZERO', values: BAND_5_COPRIME_ZERO, note: '0-5 top, coprime mids' },
  { name: 'TINY_0_3', values: TINY_0_3, note: '0-3 common, many zeros' },
  { name: 'TINY_0_4', values: TINY_0_4, note: '0-4 common, many zeros' },
  { name: 'TINY_CAPPED', values: TINY_CAPPED, note: '0-4 common, rare capped at 9' },
];
