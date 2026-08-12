/**
 * Inflection detection for the solution-vocabulary ban (SPEC §5.2).
 *
 * SPEC §5.2 calls for banning -S plurals and -ED/-ING inflections as SOLUTION
 * words while still accepting them in validation. That ban is OPTIONAL and
 * defaults to OFF — see `BuildOptions.banInflections` in build.ts. This module
 * only classifies; the decision to act on it lives in the build.
 *
 * The classification is STEM-AWARE, not suffix-matching. A plain "ends in -S"
 * test is wrong in both directions:
 *
 *   false positives — AEGIS, ACCESS, ALIAS, CHESS, ATLAS end in S but are not
 *     plurals. Suffix-matching discards 17,168 such words from enable2k.
 *   false negatives — BAGGED, BANNED, ABETTED double their final consonant, so
 *     neither BAGGE nor BAGG is a word; a naive stem test misses them. Likewise
 *     BABIED -> BABY and TRIES -> TRY change Y to I.
 *
 * So a word is an inflection only if removing its suffix — allowing for the
 * standard English spelling changes — yields something that is ITSELF a word in
 * the dictionary. That makes the dictionary the arbiter rather than a
 * hand-written exception list.
 */

/** Which inflection rule matched, or null if the word is not an inflection. */
export type InflectionKind = 'plural-s' | 'plural-es' | 'past-ed' | 'gerund-ing';

export interface InflectionResult {
  readonly kind: InflectionKind;
  /** The base word this was inflected from, e.g. BAGGED -> BAG. */
  readonly stem: string;
}

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

/**
 * Shortest acceptable stem.
 *
 * Below this, the spelling-change rules generate junk that happens to exist in
 * a Scrabble-derived dictionary full of obscure two- and three-letter entries:
 * GAS would "stem" to GAE, WAS to WAE, THIS to THY, THING to THE. Requiring
 * three letters kills that whole class without costing any real inflection —
 * the shortest true stems we care about (BAG, RUN, TRY) are all 3+.
 */
const MIN_STEM_LENGTH = 3;

/**
 * Words that look derived but are their own lexical item today.
 *
 * These pass the stem test legitimately — WICK, RUG, MORN, and CEIL really are
 * words, and the derivations are historically true — but the modern words are
 * not inflections of them and banning them would be wrong. Rule-based
 * morphology cannot see this; the list is the exception mechanism.
 *
 * Deliberately small. Add only on evidence, and prefer fixing a rule when the
 * failure is a class rather than a one-off.
 */
const LEXICALIZED = new Set([
  // -ED that is now an adjective
  'WICKED', 'RUGGED', 'BLESSED', 'SACRED', 'NAKED', 'HUNDRED', 'LEGGED',
  'CROOKED', 'LEARNED', 'AGED', 'BELOVED', 'DOGGED', 'JAGGED',
  // -ING that is now a noun
  'MORNING', 'CEILING', 'EVENING', 'BUILDING', 'FEELING', 'MEANING',
  'NOTHING', 'SOMETHING', 'STRING', 'SPRING', 'THING',
  // -S that is not a plural
  'NEWS', 'MEANS', 'SERIES', 'SPECIES', 'GAS', 'WAS', 'HAS', 'THIS', 'ITS',
  'HIS', 'ALWAYS', 'PERHAPS', 'LENS', 'BIAS', 'CRISIS', 'BASIS', 'BUS', 'PLUS',
]);

/**
 * Candidate stems for a word ending in `suffix`, covering the standard English
 * spelling changes. Order does not matter; the caller accepts the first that is
 * a real word.
 */
function candidateStems(word: string, suffix: string): string[] {
  const base = word.slice(0, word.length - suffix.length);
  if (base.length < MIN_STEM_LENGTH) return [];

  const stems = [base];

  // Silent-E restored: BAKED -> BAKE, BAKING -> BAKE, HOPES -> HOPE.
  stems.push(base + 'E');

  // Doubled final consonant: BAGGED -> BAG, RUNNING -> RUN, BANNED -> BAN.
  const last = base[base.length - 1];
  const prior = base[base.length - 2];
  if (last === prior && !VOWELS.has(last)) {
    stems.push(base.slice(0, -1));
  }

  // Y -> I: BABIED -> BABY, TRIES -> TRY, CARRIED -> CARRY.
  if (last === 'I') {
    stems.push(base.slice(0, -1) + 'Y');
  }

  return stems.filter((stem) => stem.length >= MIN_STEM_LENGTH);
}

/** First candidate stem that is itself a dictionary word, or null. */
function findStem(word: string, suffix: string, dictionary: ReadonlySet<string>): string | null {
  for (const stem of candidateStems(word, suffix)) {
    // A stem must be a real word AND differ from the word itself.
    if (stem !== word && dictionary.has(stem)) return stem;
  }
  return null;
}

/**
 * Classify `word` as an inflection of some other dictionary word, or null if it
 * stands on its own.
 *
 * Rules are tried longest-suffix-first so that -IES and -ES are considered
 * before bare -S, and -ING before -S. `dictionary` should be the full
 * validation list: the more complete it is, the more accurate this is.
 */
export function classifyInflection(
  word: string,
  dictionary: ReadonlySet<string>,
): InflectionResult | null {
  if (LEXICALIZED.has(word)) return null;

  // -ING: RUNNING -> RUN, BAKING -> BAKE, SEEING -> SEE.
  if (word.endsWith('ING')) {
    const stem = findStem(word, 'ING', dictionary);
    if (stem) return { kind: 'gerund-ing', stem };
  }

  // -ED: BAKED -> BAKE, BAGGED -> BAG, BABIED -> BABY.
  // Checked before -S rules since no -ED word ends in S.
  if (word.endsWith('ED')) {
    const stem = findStem(word, 'ED', dictionary);
    if (stem) return { kind: 'past-ed', stem };
  }

  if (word.endsWith('S')) {
    // -ES: BOXES -> BOX, DISHES -> DISH, TRIES -> TRY. Tried before bare -S
    // because BOXES' bare-S stem BOXE is not a word but BOX is.
    if (word.endsWith('ES')) {
      const stem = findStem(word, 'ES', dictionary);
      if (stem) return { kind: 'plural-es', stem };
    }

    // Bare -S: CATS -> CAT, WALKS -> WALK.
    // Double-S words (CHESS, ACCESS) are excluded: CHES is not a word, so
    // findStem returns null and they correctly survive as base words.
    const stem = findStem(word, 'S', dictionary);
    if (stem) return { kind: 'plural-s', stem };
  }

  return null;
}

/** Convenience predicate over `classifyInflection`. */
export function isInflection(word: string, dictionary: ReadonlySet<string>): boolean {
  return classifyInflection(word, dictionary) !== null;
}
