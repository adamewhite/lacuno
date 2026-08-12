/**
 * Word list pipeline. SPEC §5.
 *
 * ONE dictionary (2of12inf + delta), used identically for client-side
 * validation and generator-side uniqueness verification. From it we derive:
 *
 *   dictionary         — what counts as a word, everywhere
 *   solution vocabulary — the frequency-ranked subset puzzles are BUILT from,
 *                         tiered for difficulty ramping across the week
 *
 * The solution vocabulary is a strict subset of the dictionary: a puzzle is
 * built from common words but may be solved with any dictionary word.
 */

import { createHash } from 'node:crypto';

import { classifyInflection, type InflectionKind } from './inflection';
import type { RankedWord } from './ingest';

/**
 * Difficulty tiers, easiest first. SPEC §5.2 ramps difficulty across the week
 * (Monday = top tier), so tier 0 holds the most common words.
 */
export const TIER_NAMES = ['common', 'familiar', 'uncommon', 'rare'] as const;
export type TierName = (typeof TIER_NAMES)[number];

export interface BuildOptions {
  /**
   * Words that may never be a puzzle's ANSWER (data/blocklist.txt).
   *
   * A solution filter, not a validation filter: blocked words stay in the
   * dictionary and still glow when a player spells them. They simply are not
   * words the generator will build a puzzle around. Frequency filtering cannot
   * catch these — the problem cases are common words.
   */
  readonly blocklist?: ReadonlySet<string>;
  /**
   * Ban -S plurals and -ED/-ING inflections from the SOLUTION vocabulary
   * (SPEC §5.2). They remain valid for VALIDATION either way — this only ever
   * narrows what puzzles are built from, never what players may spell.
   *
   * Defaults to FALSE. The spec proposed the ban to keep answers from feeling
   * cheap, but it costs a large share of the vocabulary and it is not obvious
   * that CATS or WALKED actually plays badly. Left off pending SPEC §11.5 —
   * play a puzzle on paper, then decide.
   */
  readonly banInflections?: boolean;
  /** Shortest word usable as a solution. Racks shorter than this can't be filled. */
  readonly minLength?: number;
  /** Longest word usable as a solution. */
  readonly maxLength?: number;
  /**
   * Cap on solution vocabulary size, keeping the most common words. SPEC §5.2
   * targets ~5k-20k. Omit for no cap.
   */
  readonly maxWords?: number;
}

const DEFAULTS = {
  banInflections: false,
  minLength: 3,
  maxLength: 8,
} as const;

/** A solution word with everything the generator needs to pick by difficulty. */
export interface SolutionWord {
  readonly word: string;
  readonly rank: number;
  readonly tier: TierName;
  /** Set when the word is an inflection, whether or not the ban is enabled. */
  readonly inflection?: InflectionKind;
}

export interface BuildResult {
  /**
   * The complete dictionary, uppercase and sorted. Ships client-side for glow
   * checks AND is what the generator verifies uniqueness against — same list,
   * same version, both places.
   */
  readonly dictionary: readonly string[];
  /** Tiered solution vocabulary, most common first. A subset of `dictionary`. */
  readonly solutions: readonly SolutionWord[];
  /** Hash of the dictionary — SPEC §5's drift guard. */
  readonly dictVersion: string;
  readonly stats: BuildStats;
}

export interface BuildStats {
  readonly dictionaryCount: number;
  readonly solutionCount: number;
  /** Candidates dropped at each stage, for pipeline sanity-checking. */
  readonly dropped: {
    readonly notInDictionary: number;
    readonly length: number;
    readonly blocked: number;
    readonly inflection: number;
    readonly overCap: number;
  };
  readonly byTier: Readonly<Record<TierName, number>>;
  readonly byLength: Readonly<Record<number, number>>;
  /** Inflections found, whether or not they were banned. */
  readonly inflectionsFound: number;
}

/**
 * Hash the dictionary. Every puzzle stores this, so any change to the base list
 * OR the delta file re-triggers uniqueness re-verification of the unpublished
 * queue — a word added later must never retroactively create a second solution
 * (SPEC §5, drift guard).
 *
 * Hashes the sorted word list rather than the source file so that reordering or
 * reformatting the input does not spuriously invalidate every queued puzzle.
 */
export function hashDictionary(words: readonly string[]): string {
  const hash = createHash('sha256');
  for (const word of [...words].sort()) {
    hash.update(word);
    hash.update('\n');
  }
  return hash.digest('hex').slice(0, 16);
}

/**
 * Assign tier by position within the *final* solution list, so tiers stay
 * balanced regardless of how much filtering happened upstream. Quartiles:
 * the most common quarter is `common`, the rarest quarter is `rare`.
 */
function assignTier(index: number, total: number): TierName {
  if (total <= 0) return TIER_NAMES[0];
  const quartile = Math.floor((index * TIER_NAMES.length) / total);
  return TIER_NAMES[Math.min(quartile, TIER_NAMES.length - 1)];
}

/**
 * Build the dictionary and its tiered solution vocabulary.
 *
 * `dictionary` is the merged base+delta list; `frequency` is the ranked
 * commonness list. The solution vocabulary is their intersection — a puzzle
 * word must be both in the dictionary and common enough to be fair — then
 * filtered by length, optionally by inflection, and capped.
 */
export function buildWordLists(
  dictionary: ReadonlySet<string>,
  frequency: readonly RankedWord[],
  options: BuildOptions = {},
): BuildResult {
  const {
    banInflections = DEFAULTS.banInflections,
    minLength = DEFAULTS.minLength,
    maxLength = DEFAULTS.maxLength,
    maxWords,
    blocklist,
  } = options;

  const words = [...dictionary].sort();

  const dropped = { notInDictionary: 0, length: 0, blocked: 0, inflection: 0, overCap: 0 };
  let inflectionsFound = 0;

  // Frequency order is preserved throughout, so the list stays most-common-first.
  const kept: { word: string; rank: number; inflection?: InflectionKind }[] = [];

  for (const { word, rank } of frequency) {
    // Must be in the dictionary. The frequency list is web-derived and contains
    // plenty the dictionary rightly excludes.
    if (!dictionary.has(word)) {
      dropped.notInDictionary++;
      continue;
    }

    if (word.length < minLength || word.length > maxLength) {
      dropped.length++;
      continue;
    }

    // Never an ANSWER, but still in the dictionary and still valid to spell.
    if (blocklist?.has(word)) {
      dropped.blocked++;
      continue;
    }

    // Classified regardless of the ban so the metadata is always available —
    // the generator may want to avoid inflections without excluding them.
    const inflection = classifyInflection(word, dictionary);
    if (inflection) {
      inflectionsFound++;
      if (banInflections) {
        dropped.inflection++;
        continue;
      }
    }

    kept.push({ word, rank, inflection: inflection?.kind });
  }

  if (maxWords !== undefined && kept.length > maxWords) {
    dropped.overCap = kept.length - maxWords;
    kept.length = maxWords;
  }

  const solutions: SolutionWord[] = kept.map((entry, index) => ({
    word: entry.word,
    rank: entry.rank,
    tier: assignTier(index, kept.length),
    ...(entry.inflection ? { inflection: entry.inflection } : {}),
  }));

  const byTier = Object.fromEntries(TIER_NAMES.map((t) => [t, 0])) as Record<TierName, number>;
  const byLength: Record<number, number> = {};
  for (const entry of solutions) {
    byTier[entry.tier]++;
    byLength[entry.word.length] = (byLength[entry.word.length] ?? 0) + 1;
  }

  return {
    dictionary: words,
    solutions,
    dictVersion: hashDictionary(words),
    stats: {
      dictionaryCount: words.length,
      solutionCount: solutions.length,
      dropped,
      byTier,
      byLength,
      inflectionsFound,
    },
  };
}
