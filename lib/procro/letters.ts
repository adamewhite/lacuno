/**
 * Letter multiset primitives.
 *
 * Words and tile pools are both represented as 26-int counts (A=0..Z=25).
 * This keeps containment checks and subtraction allocation-free in the
 * solver's hot loop. See SPEC §6.
 */

import type { LetterValues, Pins } from './types';

export const ALPHABET_SIZE = 26;
const CODE_A = 65; // 'A'

/** Counts of each letter, indexed A=0..Z=25. */
export type LetterCounts = Int8Array;

/** 0-based alphabet index for an uppercase letter, or -1 if not A-Z. */
export function letterIndex(ch: string): number {
  const i = ch.charCodeAt(0) - CODE_A;
  return i >= 0 && i < ALPHABET_SIZE ? i : -1;
}

/**
 * Build letter counts from a word or list of tiles.
 *
 * Throws on any non-A-Z character: silently dropping a stray character would
 * make a puzzle look solvable when it isn't, and these inputs come from
 * dictionaries and puzzle files where a bad character is a data bug worth
 * surfacing loudly.
 */
export function countLetters(letters: string | readonly string[]): LetterCounts {
  const counts = new Int8Array(ALPHABET_SIZE);
  const source = typeof letters === 'string' ? letters : letters.join('');
  for (let i = 0; i < source.length; i++) {
    const index = letterIndex(source[i]);
    if (index < 0) {
      throw new Error(`Expected uppercase A-Z, got ${JSON.stringify(source[i])}`);
    }
    counts[index]++;
  }
  return counts;
}

/** Total number of letters across all counts. */
export function totalCount(counts: LetterCounts): number {
  let total = 0;
  for (let i = 0; i < ALPHABET_SIZE; i++) total += counts[i];
  return total;
}

/** True if `pool` contains at least as many of every letter as `word`. */
export function contains(pool: LetterCounts, word: LetterCounts): boolean {
  for (let i = 0; i < ALPHABET_SIZE; i++) {
    if (word[i] > pool[i]) return false;
  }
  return true;
}

/** True if every count is zero — i.e. the pool is fully consumed. */
export function isEmpty(pool: LetterCounts): boolean {
  for (let i = 0; i < ALPHABET_SIZE; i++) {
    if (pool[i] !== 0) return false;
  }
  return true;
}

/** Subtract `word` from `pool` in place. Caller must have checked containment. */
export function subtractInPlace(pool: LetterCounts, word: LetterCounts): void {
  for (let i = 0; i < ALPHABET_SIZE; i++) pool[i] -= word[i];
}

/** Add `word` back into `pool` in place — the undo half of backtracking. */
export function addInPlace(pool: LetterCounts, word: LetterCounts): void {
  for (let i = 0; i < ALPHABET_SIZE; i++) pool[i] += word[i];
}

/**
 * Score a word: the plain sum of its letter values.
 *
 * Every slot scores equally, so a word's score depends only on which letters it
 * contains — not their order. Anagrams therefore always score identically, and
 * only a rack's pins can tell them apart (see `matchesPins`).
 */
export function scoreWord(word: string, values: LetterValues): number {
  let total = 0;
  for (let i = 0; i < word.length; i++) {
    const index = letterIndex(word[i]);
    if (index < 0) {
      throw new Error(`Expected uppercase A-Z, got ${JSON.stringify(word[i])}`);
    }
    total += values[index];
  }
  return total;
}

/**
 * True if `word` has the right letter in every pinned slot.
 *
 * Pins are the game's only positional constraint, so this is what separates
 * anagrams: STARE and RATES score the same, but only one of them has `A` in
 * slot 2.
 */
export function matchesPins(word: string, pins?: Pins): boolean {
  if (!pins) return true;
  for (const [slot, letter] of Object.entries(pins)) {
    if (word[Number(slot)] !== letter) return false;
  }
  return true;
}
