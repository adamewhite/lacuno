/**
 * Tile valuation harness. SPEC §4, §11.3.
 *
 * Tile values exist to make a rack's total an INFORMATION CHANNEL — a checksum
 * the player reasons with. A scheme is good when same-length words rarely
 * collide on the same total, because collisions are exactly what let a puzzle
 * have two answers.
 *
 * This measures schemes so the choice is empirical rather than intuitive. The
 * numbers it picks are then FIXED FOREVER (SPEC §4) — players build fluency
 * over weeks, so the scoring cannot drift.
 */

import { scoreWord } from '../procro/letters';
import type { LetterValues } from '../procro/types';

export interface SchemeStats {
  /**
   * Share of words that share their (length, score) with no other word.
   * The headline number: higher means totals discriminate better.
   */
  readonly uniqueRate: number;
  /**
   * Expected collision-set size for a random word — how many words a player
   * cannot distinguish by total alone. Lower is better; 1.0 is perfect.
   */
  readonly meanAmbiguity: number;
  /** Largest single group of same-length words sharing one total. */
  readonly worstCollision: number;
  /** Distinct totals actually produced, per word length. */
  readonly spreadByLength: Readonly<Record<number, number>>;
  /** Highest total any word reaches — keeps arithmetic humane. */
  readonly maxScore: number;
}

/**
 * Group words by (length, score) and measure how well the scheme separates
 * them. Multipliers are excluded deliberately: they are a per-puzzle repair
 * tool, and a scheme that only works once multipliers rescue it is a weak
 * scheme. This measures the base signal.
 */
export function evaluateScheme(
  words: readonly string[],
  values: LetterValues,
): SchemeStats {
  const groups = new Map<string, number>();
  const totalsByLength = new Map<number, Set<number>>();
  let maxScore = 0;

  for (const word of words) {
    const score = scoreWord(word, values);
    if (score > maxScore) maxScore = score;

    const key = `${word.length}:${score}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);

    let seen = totalsByLength.get(word.length);
    if (!seen) totalsByLength.set(word.length, (seen = new Set()));
    seen.add(score);
  }

  let unique = 0;
  let ambiguitySum = 0;
  let worstCollision = 0;

  for (const size of groups.values()) {
    if (size === 1) unique++;
    // Each of the `size` words sees a collision set of `size`.
    ambiguitySum += size * size;
    if (size > worstCollision) worstCollision = size;
  }

  const spreadByLength: Record<number, number> = {};
  for (const [length, totals] of totalsByLength) spreadByLength[length] = totals.size;

  return {
    uniqueRate: unique / words.length,
    meanAmbiguity: ambiguitySum / words.length,
    worstCollision,
    spreadByLength,
    maxScore,
  };
}

/**
 * Anagram sets are the hardest case: identical letters, so identical totals no
 * matter what the values are. Only positional multipliers can separate them
 * (SPEC §2), which is why they exist. Reported separately so it is never
 * mistaken for a flaw in the valuation.
 */
export function anagramBurden(words: readonly string[]): {
  readonly setsOfTwoPlus: number;
  readonly wordsInSets: number;
  readonly largestSet: number;
} {
  const byLetters = new Map<string, number>();
  for (const word of words) {
    const key = [...word].sort().join('');
    byLetters.set(key, (byLetters.get(key) ?? 0) + 1);
  }

  let setsOfTwoPlus = 0;
  let wordsInSets = 0;
  let largestSet = 0;
  for (const size of byLetters.values()) {
    if (size > 1) {
      setsOfTwoPlus++;
      wordsInSets += size;
      if (size > largestSet) largestSet = size;
    }
  }

  return { setsOfTwoPlus, wordsInSets, largestSet };
}
