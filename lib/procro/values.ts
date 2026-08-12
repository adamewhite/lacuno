/**
 * Tile point values. SPEC §4.
 *
 * Chosen empirically with the valuation harness (lib/valuation/), not by
 * intuition: candidate schemes were scored by how often a randomly generated
 * board yields a small number of solutions, and by how much arithmetic the
 * player has to do per placement.
 *
 * ONCE PUBLISHED THESE ARE FIXED FOREVER. Players build fluency over weeks and
 * deduction skill compounds (SPEC §4), so changing a value silently invalidates
 * every player's learned intuition. Treat edits here as breaking changes.
 */

import type { LetterValues } from './types';

/**
 * PROCRO tile values.
 *
 * CHOSEN FOR SMALL NUMBERS. People are put off by arithmetic, and SPEC §3 has
 * the player re-summing a rack on every single placement. Keeping totals small
 * is the priority; everything else gives way to it.
 *
 * Design:
 *   - Common letters occupy 0-4, so a typical 5-letter rack targets ~14 rather
 *     than the ~19 or ~32 a wider spread produces.
 *   - E and O are free. They are two of the three most common letters, so
 *     zeroing them means a player adds ~4.1 tiles per five-letter rack instead
 *     of all 5 — many racks have only three numbers to sum.
 *   - A vowel in each band (E=0, A=1, I=3, U=4) so vowels carry different
 *     weight from each other rather than clumping on one value.
 *   - Rare letters trend highest, preserving intuitive ordering.
 *
 * The cost is generator yield: ~42% of random boards are publishable versus
 * ~50% for a wider spread. That is paid once, offline, in retries — the
 * generator simply tries again, and only one puzzle ships per day. Arithmetic
 * load, by contrast, is paid by every player on every move.
 */
// prettier-ignore
export const TILE_VALUES: LetterValues = [
  //A  B  C  D  E  F  G  H  I  J   K  L  M
    1, 7, 4, 3, 0, 8, 5, 6, 3, 13, 9, 2, 6,
  //N  O  P  Q   R  S  T  U  V   W  X   Y  Z
    3, 0, 5, 14, 2, 1, 2, 4, 10, 8, 12, 7, 11,
];

/**
 * Retained under the old name so existing imports keep working. New code should
 * use TILE_VALUES.
 *
 * @deprecated Use TILE_VALUES — the values are no longer provisional.
 */
export const PROVISIONAL_VALUES = TILE_VALUES;

/** Look up a letter's value. Uppercase A-Z only. */
export function valueOf(letter: string, values: LetterValues = TILE_VALUES): number {
  const index = letter.charCodeAt(0) - 65;
  if (index < 0 || index >= 26) {
    throw new Error(`Expected uppercase A-Z, got ${JSON.stringify(letter)}`);
  }
  return values[index];
}
