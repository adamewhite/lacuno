/**
 * The PROCRO solver. See SPEC §6 — this one function serves four roles:
 * uniqueness validator, puzzle generator (run backwards), difficulty grader,
 * and tile-value optimizer.
 *
 * Exhaustiveness IS the correctness guarantee: a puzzle ships only once we
 * have proven it has exactly one solution, so the search must never prune a
 * branch it has not disproven.
 */

import {
  addInPlace,
  contains,
  countLetters,
  isEmpty,
  matchesPins,
  scoreWord,
  subtractInPlace,
  totalCount,
  type LetterCounts,
} from './letters';
import type { LetterValues, Rack, Solution, SolveOptions } from './types';

export { matchesPins, scoreWord };

/** A dictionary word paired with its precomputed letter counts. */
interface Candidate {
  readonly word: string;
  readonly counts: LetterCounts;
}

/** Per-rack candidate lists, in the racks' original order. */
export type RackCandidates = readonly (readonly string[])[];

/**
 * Find every word that could legally fill `rack` given `pool`.
 *
 * Four filters, cheapest first (SPEC §6): length match, then pinned letters,
 * then multiset containment against the tile pool, then exact score.
 */
function candidatesForRack(
  rack: Rack,
  pool: LetterCounts,
  dictionary: readonly string[],
  values: LetterValues,
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const word of dictionary) {
    if (word.length !== rack.length) continue;
    if (!matchesPins(word, rack.pins)) continue;
    const counts = countLetters(word);
    if (!contains(pool, counts)) continue;
    if (scoreWord(word, values) !== rack.target) continue;
    candidates.push({ word, counts });
  }
  return candidates;
}

/**
 * Candidate counts per rack *before* the total constraint is applied — the
 * difficulty proxy from SPEC §6 (search-space size). Returned in the racks'
 * original order.
 */
export function rackSearchSpace(
  tiles: readonly string[],
  racks: readonly Rack[],
  dictionary: readonly string[],
): number[] {
  const pool = countLetters(tiles);
  return racks.map((rack) => {
    let count = 0;
    for (const word of dictionary) {
      if (word.length !== rack.length) continue;
      if (!contains(pool, countLetters(word))) continue;
      count++;
    }
    return count;
  });
}

/**
 * Solve a PROCRO board: place all tiles into the racks so each rack holds a
 * dictionary word hitting its exact target.
 *
 * Returns every distinct solution, each an array of words in the same order
 * as `racks`. An empty result means the board is unsolvable.
 *
 * Pass `options.limit` to stop early — uniqueness checking only needs 2.
 */
export function solve(
  tiles: readonly string[],
  racks: readonly Rack[],
  dictionary: readonly string[],
  values: LetterValues,
  options: SolveOptions = {},
): Solution[] {
  const solutions: Solution[] = [];
  if (racks.length === 0) return solutions;

  const limit = options.limit ?? Infinity;
  if (limit < 1) return solutions;

  const pool = countLetters(tiles);

  // Total rack slots must equal the tile count, or no assignment can consume
  // the pool exactly. Cheap to check, and it rules out malformed puzzles
  // before we touch the dictionary.
  const slots = racks.reduce((sum, rack) => sum + rack.length, 0);
  if (slots !== totalCount(pool)) return solutions;

  const candidates = racks.map((rack) =>
    candidatesForRack(rack, pool, dictionary, values),
  );

  // Order racks by fewest candidates first (SPEC §6) so the search fails fast.
  // We recurse over this order but write results back to original positions,
  // so callers always get words aligned to the racks they passed in.
  const order = racks
    .map((_, index) => index)
    .sort((a, b) => candidates[a].length - candidates[b].length);

  const chosen: string[] = new Array(racks.length).fill('');

  const recurse = (depth: number): void => {
    if (solutions.length >= limit) return;

    if (depth === order.length) {
      // Every rack is filled. The slot-count check above guarantees the pool
      // is exactly consumed here, but assert it rather than assume it — this
      // is the one invariant that makes "all tiles used" true.
      if (isEmpty(pool)) solutions.push([...chosen]);
      return;
    }

    const rackIndex = order[depth];
    for (const candidate of candidates[rackIndex]) {
      // The pool shrinks as we descend, so re-check containment: a candidate
      // that fit the full pool may not fit what earlier racks left behind.
      if (!contains(pool, candidate.counts)) continue;

      subtractInPlace(pool, candidate.counts);
      chosen[rackIndex] = candidate.word;

      recurse(depth + 1);

      addInPlace(pool, candidate.counts);
      chosen[rackIndex] = '';

      if (solutions.length >= limit) return;
    }
  };

  recurse(0);
  return solutions;
}

/**
 * True if the board has exactly one solution — the gate a puzzle must pass
 * before it can be published (SPEC §1). Stops searching at the second
 * solution, since that is already disqualifying.
 *
 * Note this is a rule about which PUZZLES ship, not about which words a player
 * may spell. During play the engine accepts any dictionary word hitting the
 * target (SPEC §2), so if STARE and RATES both satisfy a rack, both glow — but
 * such a board fails this gate and is never published in the first place.
 */
export function hasUniqueSolution(
  tiles: readonly string[],
  racks: readonly Rack[],
  dictionary: readonly string[],
  values: LetterValues,
): boolean {
  return solve(tiles, racks, dictionary, values, { limit: 2 }).length === 1;
}

/**
 * Whether a rack is currently satisfied: a dictionary word at the exact target.
 *
 * This is the client-side glow check (SPEC §3) and the whole of the win
 * condition. It is deliberately a CONSTRAINT test, never a comparison against a
 * stored intended answer (SPEC §2) — the engine does not know or care which
 * word the generator had in mind.
 */
export function isRackSatisfied(
  word: string,
  rack: Rack,
  dictionary: ReadonlySet<string>,
  values: LetterValues,
): boolean {
  if (word.length !== rack.length) return false;
  if (!matchesPins(word, rack.pins)) return false;
  if (!dictionary.has(word)) return false;
  return scoreWord(word, values) === rack.target;
}
