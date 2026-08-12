/**
 * Puzzle generator. See SPEC §6, §11.4.
 *
 * Runs the solver backwards: pick words, pool their tiles, then verify with
 * solve() that the resulting board admits only that one answer.
 *
 * Three gates, in increasing cost order:
 *   1. pinnable floor  — ceil(racks/2) racks must be anagram-free, so a real
 *                        hint always exists (cheap: a dictionary lookup)
 *   2. solvability     — the board must have at least one solution
 *   3. single group    — all solutions must be the same up to anagrams
 *
 * Only one puzzle ships per day, so the generator is deliberately CHOOSY: it
 * samples many candidates and keeps the best rather than the first that passes.
 */

import { scoreWord } from './letters';
import {
  buildAnagramIndex,
  choosePins,
  countPinnableRacks,
  groupByAnagram,
  meetsPinnableFloor,
  type PinChoice,
} from './pins';
import { solve } from './solve';
import type { LetterValues, Rack, Solution } from './types';

/** A verified, publishable puzzle. */
export interface Puzzle {
  /** The tile pool, sorted so the payload does not leak word boundaries. */
  readonly tiles: readonly string[];
  /** Racks in board order, without pins — the expert's board. */
  readonly racks: readonly Rack[];
  /**
   * Hints, most useful first. Pins are OPTIONAL: the board is solvable without
   * any of them, and they are verified against the unpinned board so revealing
   * one can never change what counts as correct.
   */
  readonly pins: readonly PinChoice[];
  /** One representative solution. Others may exist as anagrams of these words. */
  readonly solution: Solution;
  /** Every accepted solution, including anagram rearrangements. */
  readonly allSolutions: readonly Solution[];
  /** Racks whose word has no anagram — where pins may honestly go. */
  readonly pinnableRacks: number;
  /** Per-rack candidate count before the target constraint: the difficulty proxy. */
  readonly searchSpace: readonly number[];
}

export interface GenerateOptions {
  /** Word length per rack, e.g. [5, 4, 3]. */
  readonly shape: readonly number[];
  /** Words puzzles may be built from — the solution vocabulary. */
  readonly vocabulary: readonly string[];
  /** The dictionary: what counts as a word, for both solving and validation. */
  readonly dictionary: readonly string[];
  readonly values: LetterValues;
  /** Random source; inject a seeded one for reproducible puzzles. */
  readonly random?: () => number;
  /**
   * How many candidate boards to try. The generator returns the BEST passing
   * candidate, not the first, so higher means choosier. One puzzle per day
   * makes this cheap.
   */
  readonly attempts?: number;
  /**
   * Stop early once this many candidates have passed every gate. Guards against
   * spending the full attempt budget when good boards are plentiful.
   */
  readonly enough?: number;
}

const DEFAULTS = { attempts: 200, enough: 25 } as const;

/**
 * Score a passing candidate so the generator can prefer better boards.
 *
 * Ranked by, in order:
 *   - more pinnable racks (the stated preference: hints wherever honest)
 *   - fewer total solutions (a crisper puzzle)
 *   - larger search space (harder to brute-force, so more deduction)
 */
function rank(puzzle: Puzzle): number {
  const space = puzzle.searchSpace.reduce((a, b) => a + b, 0);
  return puzzle.pinnableRacks * 1_000_000 - puzzle.allSolutions.length * 1_000 + Math.min(space, 999);
}

/**
 * Generate one puzzle, or null if no candidate passed within the attempt budget.
 *
 * Failure is normal and cheap — roughly half of random boards fail the
 * single-group gate — so callers should simply retry with a different shape or
 * a larger budget.
 */
export function generatePuzzle(options: GenerateOptions): Puzzle | null {
  const {
    shape,
    vocabulary,
    dictionary,
    values,
    random = Math.random,
    attempts = DEFAULTS.attempts,
    enough = DEFAULTS.enough,
  } = options;

  if (shape.length === 0) return null;

  const anagramIndex = buildAnagramIndex(dictionary);

  // Bucket the vocabulary once; the inner loop only samples.
  const byLength = new Map<number, string[]>();
  for (const word of vocabulary) {
    const list = byLength.get(word.length);
    if (list) list.push(word);
    else byLength.set(word.length, [word]);
  }
  for (const length of shape) {
    if (!byLength.has(length)) return null;
  }

  const passing: Puzzle[] = [];

  for (let attempt = 0; attempt < attempts && passing.length < enough; attempt++) {
    const words = shape.map((length) => {
      const pool = byLength.get(length)!;
      return pool[Math.floor(random() * pool.length)];
    });

    // A word must not repeat across racks, and must not be contained in a
    // sibling. YOURS / RIGID / YOU is legal under every other rule but reads as
    // a generator bug, and the repetition gives the answer away.
    if (new Set(words).size !== words.length) continue;
    if (words.some((a) => words.some((b) => a !== b && b.includes(a)))) continue;

    // Gate 1: the pinnable floor. A dictionary lookup per word — far cheaper
    // than solving, so it runs first.
    if (!meetsPinnableFloor(words, anagramIndex)) continue;

    const racks: Rack[] = words.map((word) => ({
      length: word.length,
      target: scoreWord(word, values),
    }));
    const tiles = words.join('').split('');

    // Gates 2 and 3: solve exhaustively, then require a single anagram group.
    // No limit — we need every solution to know the groups are all the same.
    const solutions = solve(tiles, racks, dictionary, values);
    if (solutions.length === 0) continue;
    if (groupByAnagram(solutions).length !== 1) continue;

    const candidatesByRack = racks.map((rack) =>
      dictionary.filter(
        (word) => word.length === rack.length && scoreWord(word, values) === rack.target,
      ),
    );

    passing.push({
      // Sorting the pool keeps word boundaries out of the payload.
      tiles: [...tiles].sort(),
      racks,
      pins: choosePins(words, candidatesByRack, anagramIndex),
      solution: words,
      allSolutions: solutions,
      pinnableRacks: countPinnableRacks(words, anagramIndex),
      searchSpace: candidatesByRack.map((c) => c.length),
    });
  }

  if (passing.length === 0) return null;

  return passing.reduce((best, candidate) => (rank(candidate) > rank(best) ? candidate : best));
}

/**
 * Deterministic PRNG (mulberry32). Seed a puzzle by its date so a given day
 * always regenerates identically.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
