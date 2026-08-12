/**
 * Game variants.
 *
 * CLASSIC — every letter is a scarce tile with a point value. The deduction is
 *   "which rack gets this O?"
 *
 * ZERO_VOWELS ("vwldrp") — A E I O U are worth 0 points, but are still a FINITE
 *   pool with exact counts, displayed as a separate stack above the consonants.
 *   Rack lengths stay fixed, consonants sum to the target, and EVERY tile must
 *   be used — vowels included.
 *
 *   `vwldrp` is the working name for this variant only; the game as a whole is
 *   still PROCRO (SPEC §1, §9). The internal key stays `zero-vowels` so the
 *   code describes the mechanic rather than the branding.
 *
 * The point of zero-value vowels is arithmetic relief, not freedom: a five
 * letter word may only have two or three numbers to add. Keeping the vowel
 * counts exact preserves the scarcity that makes the deduction work — "which
 * rack gets the second E?" is still a live question, and the board still has a
 * clean "all tiles used" ending.
 *
 * An earlier draft made vowels unlimited. That removed too much: a rack wanting
 * consonants R,S,T accepted ASTER, RATES, ROAST, ROOST and ~30 others, since
 * nothing constrained the vowels. Exact counts bring that back under control.
 */

export type Variant = 'classic' | 'zero-vowels';

export const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

/** Y scores: it behaves as a consonant for supply and scoring purposes. */
export function isVowel(letter: string): boolean {
  return VOWELS.has(letter);
}

/** The consonants of a word, in order — the letters that actually score. */
export function consonantsOf(word: string): string[] {
  return [...word].filter((c) => !VOWELS.has(c));
}

/** The vowels of a word, in order — the free letters, drawn from their own stack. */
export function vowelsOf(word: string): string[] {
  return [...word].filter((c) => VOWELS.has(c));
}

/**
 * Letters a player must draw from the finite pool to spell `word`.
 *
 * Both variants consume every letter: zero-vowels splits the pool for DISPLAY
 * (vowels in their own stack) but the counts are still exact, so a word uses up
 * its vowels exactly as it uses up its consonants.
 */
export function poolLettersOf(word: string, _variant: Variant): string[] {
  return [...word];
}

/**
 * Canonical key for "words this rack cannot tell apart".
 *
 * Both variants score by letter multiset alone, so anagrams always collide —
 * STARE and RATES share a total under any valuation. Zeroing vowels does not
 * change this: with exact vowel counts, a rack is still pinned to an anagram
 * family, not to a looser consonant skeleton.
 */
export function ambiguityKey(word: string, _variant: Variant): string {
  return [...word].sort().join('');
}
