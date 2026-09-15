/**
 * Phrase puzzles.
 *
 * A phrase becomes one puzzle: one rack per word, in reading order. The player
 * gets every CONSONANT as a scarce tile plus an unlimited supply of vowels, and
 * reconstructs the phrase.
 *
 * This inverts what constrains the puzzle. In the word game, tile scarcity and
 * point totals were the only things that could tell you which word was right —
 * so the solver had to prove uniqueness. Here the PHRASE does that work: no
 * arithmetic is needed to see that `_ _ A T  A _ O U _ D  T _ E  B U _ _` is
 * BEAT AROUND THE BUSH. The totals survive as partial information — a rack's
 * total tells you how much consonant weight it holds before you have guessed
 * the word — but they no longer have to prove anything.
 *
 * Consequently there is no uniqueness gate. `BEAT AROUND THE BUSH` admits over
 * a thousand legal rack fillings; only one is a phrase, and only a human can
 * judge that. Curation replaces verification.
 */

import { scoreWord, TILE_VALUES, VOWELS, type LetterValues } from './letter-values';

export interface PhraseRack {
  /** Number of letters in this word. */
  readonly length: number;
  /** Sum of the word's consonant values; vowels score 0. */
  readonly target: number;
  /**
   * Which slots take a vowel, as 0-based indices. Not shown to the player —
   * used to check a completed rack and to place hints.
   */
  readonly vowelSlots: readonly number[];
}

export interface PhrasePuzzle {
  readonly id: string;
  /** The phrase, uppercase, words space-separated. Never sent to the client. */
  readonly phrase: string;
  /** Shown to the player as a clue to the kind of answer. */
  readonly category: string;
  /** One rack per word, in reading order. */
  readonly racks: readonly PhraseRack[];
  /** The scarce pool: every consonant in the phrase, sorted. */
  readonly consonants: readonly string[];
  /**
   * The vowels on offer: always all five, in A E I O U order.
   *
   * Supply is unlimited, and every vowel is offered whether or not the phrase
   * uses it. Restricting the piles to the vowels actually present would leak
   * which vowels are absent — a strong hint — so the piles stay uniform and
   * the player has to work out which belong.
   */
  readonly vowels: readonly string[];
  /** Total letters, for display ("24 letters"). */
  readonly letterCount: number;
}

/** True when `letter` is one of A E I O U. Y scores and is treated as a consonant. */
export function isVowelLetter(letter: string): boolean {
  return VOWELS.has(letter);
}

/** Shown to the player when a line gives no category of its own. */
export const DEFAULT_CATEGORY = 'Phrase';

export interface ParsedPhraseLine {
  readonly phrase: string;
  /** e.g. "Idiom", "People", "Place". Title-cased for display. */
  readonly category: string;
}

/**
 * Normalize a raw phrase line: uppercase, collapse whitespace, drop
 * punctuation. Returns null for blanks, comments, and anything that is not
 * letters and spaces once cleaned.
 */
export function normalizePhrase(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) return null;

  const cleaned = trimmed
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length === 0) return null;
  return cleaned;
}

/**
 * Parse a list line, which may carry a category: `Idiom | Cold feet`.
 *
 * The category is a clue about the kind of answer, not part of it. Without one
 * the puzzle is labelled `Phrase`, so a bare list of phrases still works.
 */
export function parsePhraseLine(raw: string): ParsedPhraseLine | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) return null;

  const bar = trimmed.indexOf('|');
  const categoryPart = bar >= 0 ? trimmed.slice(0, bar).trim() : '';
  const phrasePart = bar >= 0 ? trimmed.slice(bar + 1) : trimmed;

  const phrase = normalizePhrase(phrasePart);
  if (!phrase) return null;

  // Title-case whatever the curator typed, so "IDIOM" and "idiom" both read
  // the same on the board.
  const category = categoryPart
    ? categoryPart
        .toLowerCase()
        .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    : DEFAULT_CATEGORY;

  return { phrase, category };
}

/**
 * Build a puzzle from a phrase.
 *
 * Every consonant becomes a tile; vowels do not, since they are unlimited. A
 * rack's target is the sum of its consonant values.
 */
export function buildPhrasePuzzle(
  phrase: string,
  values: LetterValues,
  id: string,
  category: string = DEFAULT_CATEGORY,
): PhrasePuzzle {
  const words = phrase.split(' ');

  const racks: PhraseRack[] = words.map((word) => ({
    length: word.length,
    // Vowels score 0 in this valuation, so the plain word score is already the
    // consonant total.
    target: scoreWord(word, values),
    vowelSlots: [...word]
      .map((letter, index) => (isVowelLetter(letter) ? index : -1))
      .filter((index) => index >= 0),
  }));

  const letters = phrase.replace(/ /g, '');

  const consonants = [...letters].filter((letter) => !isVowelLetter(letter)).sort();

  // All five, always. See the `vowels` field comment: narrowing the piles to
  // the vowels the phrase uses would tell the player which ones are absent.
  const vowels = ['A', 'E', 'I', 'O', 'U'];

  return {
    id,
    phrase,
    category,
    racks,
    consonants,
    vowels,
    letterCount: letters.length,
  };
}

/**
 * Check a completed board against the phrase.
 *
 * Compares the joined racks to the phrase itself. Unlike the word game — where
 * SPEC §2 forbids comparing against a stored answer because any anagram at the
 * right total is legitimate — a phrase puzzle has exactly one intended reading,
 * and "some other arrangement of these letters" is not a win.
 */
export function isPhraseSolved(
  filled: readonly string[],
  puzzle: PhrasePuzzle,
): boolean {
  return filled.join(' ') === puzzle.phrase;
}

/**
 * Hints, best first: reveal a letter of the phrase.
 *
 * Highest tile value first, so a hint always spends itself on the letter the
 * player gains most from. Value tracks scarcity here — a Q or J is both the
 * hardest letter to think of and the one whose placement pins down the most of
 * a rack's target, while an S adds almost nothing. Vowels score 0 and so fall
 * to the end naturally, which preserves the old rule that consonants come
 * first without stating it separately.
 *
 * Within one value, longer words first, since they constrain recall the most.
 *
 * This order is the *fallback*. A hint is chosen against the live board, and a
 * tile the player has already misplaced at this value or higher is relocated
 * instead of a new letter being revealed — see `chooseHint`.
 */
export interface PhraseHint {
  readonly rackIndex: number;
  readonly slot: number;
  readonly letter: string;
  /** Tile value of `letter`; 0 for vowels. Drives the ordering. */
  readonly value: number;
}

export function phraseHints(
  puzzle: PhrasePuzzle,
  values: LetterValues = TILE_VALUES,
): PhraseHint[] {
  const words = puzzle.phrase.split(' ');
  const hints: PhraseHint[] = [];

  words.forEach((word, rackIndex) => {
    [...word].forEach((letter, slot) => {
      hints.push({
        rackIndex,
        slot,
        letter,
        value: values[letter.charCodeAt(0) - 65] ?? 0,
      });
    });
  });

  return hints.sort((a, b) => {
    if (a.value !== b.value) return b.value - a.value;

    const aLen = words[a.rackIndex].length;
    const bLen = words[b.rackIndex].length;
    if (aLen !== bLen) return bLen - aLen;

    return a.rackIndex - b.rackIndex || a.slot - b.slot;
  });
}

/** A letter sitting somewhere it does not belong, and where it should go. */
export interface MisplacedHint extends PhraseHint {
  /** Where the tile currently sits, so the caller can vacate it. */
  readonly from: { readonly rackIndex: number; readonly slot: number };
}

/**
 * The next hint, resolved against the live board.
 *
 * Correcting beats revealing. A letter the player has already placed in the
 * wrong slot is a mistake actively working against them — it makes a rack's
 * total look satisfied while the phrase stays unreachable — so a hint spent
 * moving it to its home is worth more than one uncovering a letter they have
 * not thought about yet. We only prefer the correction when the misplaced tile
 * is worth AT LEAST as much as the letter we would otherwise reveal; a stray S
 * does not get to pre-empt revealing a J.
 *
 * `board[rack][slot]` is the letter in that slot, or null when empty. Slots
 * already settled (a given vowel, an earlier hint) belong in `locked` so a
 * hint never spends itself re-revealing them.
 */
export function chooseHint(
  hints: readonly PhraseHint[],
  board: readonly (readonly (string | null)[])[],
  locked: ReadonlySet<string> = new Set(),
): PhraseHint | MisplacedHint | null {
  /** The letter the phrase wants at a slot, from the hints themselves. */
  const wants = new Map(hints.map((h) => [`${h.rackIndex}:${h.slot}`, h.letter]));

  // The best letter not yet correctly in place — what we would reveal.
  const target = hints.find(
    (h) => !locked.has(`${h.rackIndex}:${h.slot}`) && board[h.rackIndex]?.[h.slot] !== h.letter,
  );
  if (!target) return null;

  // A misplaced tile whose letter is still needed somewhere, worth >= target.
  for (const h of hints) {
    if (h.value < target.value) break; // hints are value-descending
    if (locked.has(`${h.rackIndex}:${h.slot}`)) continue;
    if (board[h.rackIndex]?.[h.slot] === h.letter) continue;

    for (let rackIndex = 0; rackIndex < board.length; rackIndex++) {
      for (let slot = 0; slot < board[rackIndex].length; slot++) {
        if (rackIndex === h.rackIndex && slot === h.slot) continue;
        if (locked.has(`${rackIndex}:${slot}`)) continue;
        if (board[rackIndex][slot] !== h.letter) continue;
        // A tile of the letter h needs sits here. It is MISPLACED when this
        // slot wants something else — so moving it home both fixes a mistake
        // and fills h, rather than robbing a slot that was already right.
        if (wants.get(`${rackIndex}:${slot}`) !== h.letter) {
          return { ...h, from: { rackIndex, slot } };
        }
      }
    }
  }

  return target;
}
