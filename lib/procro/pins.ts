/**
 * Anagram families and pin selection. See SPEC §2, §3.
 *
 * Every slot in a rack scores equally, so a word's total depends only on which
 * letters it holds — not their order. Anagrams therefore ALWAYS share a total,
 * and no choice of tile values can separate them.
 *
 * Two consequences shape the whole design:
 *
 *   1. Anagram families are ACCEPTED. If a rack admits both STARE and RATES,
 *      either is correct. Demanding a single answer would exclude 23% of the
 *      solution vocabulary — and disproportionately the most common words
 *      (37% of the top 1000), including STATE, YEAR, FIRST, TIME, NAME.
 *
 *   2. Pins go on racks that have NO anagram alternative. Pinning a letter of
 *      STARE would falsely imply RATES is wrong; pinning the M of MONTH is a
 *      genuine foothold, because MONTH is the only arrangement of its letters.
 *      A pin also removes its rack's letters from contention elsewhere, so it
 *      tightens the whole board.
 */

import { countLetters, letterIndex } from './letters';
import type { Pins, Rack, Solution } from './types';

/** Canonical key for a word's letter multiset. Anagrams share this key. */
export function anagramKey(word: string): string {
  return [...word].sort().join('');
}

/**
 * Index the dictionary by letter multiset, so anagram families can be looked up
 * in O(1). Build once and reuse — walking an 82k-word list per query is the
 * difference between milliseconds and minutes when generating candidates.
 */
export function buildAnagramIndex(dictionary: Iterable<string>): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const word of dictionary) {
    const key = anagramKey(word);
    const family = index.get(key);
    if (family) family.push(word);
    else index.set(key, [word]);
  }
  return index;
}

/**
 * Every dictionary word sharing this word's letters, including the word itself.
 */
export function anagramFamily(word: string, index: ReadonlyMap<string, string[]>): string[] {
  return index.get(anagramKey(word)) ?? [word];
}

/**
 * True if `word` is the only arrangement of its letters in the dictionary —
 * i.e. a rack holding it has a single true answer, so pinning it is honest.
 */
export function isPinnable(word: string, index: ReadonlyMap<string, string[]>): boolean {
  return anagramFamily(word, index).length === 1;
}

/**
 * Group solutions that differ only by rearranging letters WITHIN racks.
 *
 * Two solutions belong to the same group when every rack holds the same letters
 * in both. STARE|GLOW and RATES|GLOW are one group — the player made the same
 * deduction about how tiles split across racks, which is the actual puzzle.
 * STONE|CHAIR|MUD and ADORE|CHITS|MUN are different groups: a genuinely
 * different partition of the tiles.
 *
 * Returned groups are in first-seen order, each preserving solution order.
 */
export function groupByAnagram(solutions: readonly Solution[]): Solution[][] {
  const groups = new Map<string, Solution[]>();
  for (const solution of solutions) {
    const key = solution.map(anagramKey).join('|');
    const group = groups.get(key);
    if (group) group.push(solution);
    else groups.set(key, [solution]);
  }
  return [...groups.values()];
}

/**
 * The publish gate (SPEC §1): a board ships when all its solutions are the same
 * up to anagrams — one way to split the tiles across racks, even if a rack
 * admits several arrangements of its letters.
 */
export function hasSingleSolutionGroup(solutions: readonly Solution[]): boolean {
  return groupByAnagram(solutions).length === 1;
}

/**
 * How many racks of a solution could honestly carry a pin.
 */
export function countPinnableRacks(
  solution: Solution,
  index: ReadonlyMap<string, string[]>,
): number {
  return solution.reduce((n, word) => n + (isPinnable(word, index) ? 1 : 0), 0);
}

/**
 * Minimum pinnable racks a board must have: ceil(racks / 2).
 *
 * Even counts need half, odd counts more than half — 1 of 2, 2 of 3, 2 of 4,
 * 3 of 5. Chosen because it guarantees a real hint always exists while costing
 * only generator retries. Requiring EVERY rack to be pinnable would instead
 * cost vocabulary permanently, and the words it would exclude are
 * disproportionately common ones (see the module comment).
 */
export function requiredPinnableRacks(rackCount: number): number {
  return Math.ceil(rackCount / 2);
}

/** True if the board clears the pinnable floor. */
export function meetsPinnableFloor(
  solution: Solution,
  index: ReadonlyMap<string, string[]>,
): boolean {
  return countPinnableRacks(solution, index) >= requiredPinnableRacks(solution.length);
}

export interface PinChoice {
  /** Index of the rack this pin belongs to, in the board's rack order. */
  readonly rackIndex: number;
  /** 0-based slot within that rack. */
  readonly slot: number;
  /** The letter locked into that slot. */
  readonly letter: string;
  /** Candidate words remaining for that rack once this pin applies. */
  readonly remaining: number;
  /** Candidates before the pin, for reporting how much it narrowed things. */
  readonly before: number;
}

/**
 * Choose the most discriminating pin for a single rack.
 *
 * "Discriminating" means eliminating the most candidate words. `candidates` is
 * every dictionary word that already satisfies the rack's length and target, so
 * this measures real narrowing rather than a guess.
 *
 * Returns null when no pin helps — the rack has one candidate already, or every
 * slot leaves the same set. Ties break toward the earlier slot, which reads
 * more naturally as a foothold.
 */
export function bestPinForRack(
  word: string,
  candidates: readonly string[],
  rackIndex: number,
): PinChoice | null {
  if (candidates.length <= 1) return null;

  let best: PinChoice | null = null;

  for (let slot = 0; slot < word.length; slot++) {
    const letter = word[slot];
    let remaining = 0;
    for (const candidate of candidates) {
      if (candidate[slot] === letter) remaining++;
    }

    // A pin that leaves everything is useless.
    if (remaining === candidates.length) continue;

    if (best === null || remaining < best.remaining) {
      best = { rackIndex, slot, letter, remaining, before: candidates.length };
    }
  }

  return best;
}

/**
 * Choose pins for a whole board, best-first.
 *
 * Only anagram-free racks are considered (see the module comment). Pins are
 * ranked by how much they narrow their rack, so the first is the most useful
 * hint — which is what a player asking for help should receive.
 *
 * `candidatesByRack` must align with `solution`: for each rack, the words that
 * satisfy its length and target constraints.
 */
export function choosePins(
  solution: Solution,
  candidatesByRack: readonly (readonly string[])[],
  index: ReadonlyMap<string, string[]>,
): PinChoice[] {
  const choices: PinChoice[] = [];

  solution.forEach((word, rackIndex) => {
    if (!isPinnable(word, index)) return;
    const pin = bestPinForRack(word, candidatesByRack[rackIndex] ?? [word], rackIndex);
    if (pin) choices.push(pin);
  });

  // Most discriminating first: fewest candidates left, then biggest reduction.
  return choices.sort(
    (a, b) => a.remaining - b.remaining || b.before - a.before || a.rackIndex - b.rackIndex,
  );
}

/** Collect the pins for one rack into the shape a Rack carries. */
export function pinsForRack(choices: readonly PinChoice[], rackIndex: number): Pins | undefined {
  const pins: Record<number, string> = {};
  let any = false;
  for (const choice of choices) {
    if (choice.rackIndex === rackIndex) {
      pins[choice.slot] = choice.letter;
      any = true;
    }
  }
  return any ? pins : undefined;
}

/**
 * Apply pin choices to a board's racks, returning new racks. Used to hand the
 * player a hinted board without mutating the verified one.
 */
export function applyPins(racks: readonly Rack[], choices: readonly PinChoice[]): Rack[] {
  return racks.map((rack, rackIndex) => {
    const pins = pinsForRack(choices, rackIndex);
    return pins ? { ...rack, pins } : { ...rack };
  });
}

/**
 * Sanity check that a pinned letter is actually available among the tiles.
 * A pin naming a letter the pool does not contain would make the board
 * unsolvable, which is a generator bug rather than a puzzle.
 */
export function pinsAreConsistent(tiles: readonly string[], racks: readonly Rack[]): boolean {
  const pool = countLetters(tiles);
  for (const rack of racks) {
    if (!rack.pins) continue;
    for (const [slot, letter] of Object.entries(rack.pins)) {
      const index = letterIndex(letter);
      if (index < 0) return false;
      if (Number(slot) < 0 || Number(slot) >= rack.length) return false;
      if (pool[index] <= 0) return false;
      pool[index]--;
    }
  }
  return true;
}
