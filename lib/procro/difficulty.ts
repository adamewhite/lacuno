/**
 * Difficulty levels, for playtesting how much vowel help a puzzle needs.
 *
 * Every level uses the same puzzles and the same consonant pool. What varies is
 * how much of the vowel work is done for the player:
 *
 *   Standard     every vowel is already on the board; all five piles disabled
 *   Challenging  one whole vowel pre-filled throughout (every E, say), and the
 *                piles show only the vowels genuinely in play
 *   Difficult    vowels the phrase never uses are disabled, so the piles show
 *                only what is in play — but nothing is placed for you
 *   Brutal       nothing given; all five piles live, whether or not the phrase
 *                uses them
 *
 * Brutal is the original behaviour, and Standard is what a new visitor gets.
 * Each is a route: /standard, /challenging, /difficult, /brutal.
 */

export const DIFFICULTIES = ['standard', 'challenging', 'difficult', 'brutal'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * What a first-time visitor gets. Standard is the friendliest introduction —
 * the puzzle still has to be worked out, but the vowels are not also a guessing
 * game on top of it.
 */
export const DEFAULT_DIFFICULTY: Difficulty = 'standard';

export interface DifficultyMeta {
  readonly slug: Difficulty;
  /** Shown in the menu. */
  readonly label: string;
  /** One line explaining what the level gives away. */
  readonly blurb: string;
}

export const DIFFICULTY_META: Record<Difficulty, DifficultyMeta> = {
  standard: {
    slug: 'standard',
    label: 'Standard',
    blurb: 'All vowels filled in',
  },
  challenging: {
    slug: 'challenging',
    label: 'Challenging',
    blurb: 'One vowel filled in for you',
  },
  difficult: {
    slug: 'difficult',
    label: 'Difficult',
    blurb: 'Only the vowels in play are offered',
  },
  brutal: {
    slug: 'brutal',
    label: 'Brutal',
    blurb: 'No vowel help',
  },
};

const VOWELS = ['A', 'E', 'I', 'O', 'U'] as const;

export interface VowelPlan {
  /** Slots pre-filled before play, as `${rackIndex}:${slot}` -> letter. */
  readonly prefilled: ReadonlyMap<string, string>;
  /** Piles the player may still use. Others render disabled. */
  readonly enabled: ReadonlySet<string>;
}

/**
 * Work out which vowels are given away and which piles stay live.
 *
 * `words` is the answer, which the client already holds for playtesting. A
 * shipped build would compute this server-side (SPEC §7).
 */
export function planVowels(words: readonly string[], difficulty: Difficulty): VowelPlan {
  const prefilled = new Map<string, string>();
  const used = new Set<string>();

  words.forEach((word) => {
    for (const letter of word) {
      if ((VOWELS as readonly string[]).includes(letter)) used.add(letter);
    }
  });

  /** Pre-fill every occurrence of the given vowels. */
  const fill = (letters: ReadonlySet<string>) => {
    words.forEach((word, rackIndex) => {
      [...word].forEach((letter, slot) => {
        if (letters.has(letter)) prefilled.set(`${rackIndex}:${slot}`, letter);
      });
    });
  };

  switch (difficulty) {
    case 'standard': {
      // Everything given: the puzzle becomes purely about the consonants.
      fill(used);
      return { prefilled, enabled: new Set() };
    }

    case 'challenging': {
      // Give away the vowel that appears most, so the help is worth something.
      // Ties break by A E I O U order, keeping it predictable across sessions.
      const counts = new Map<string, number>();
      for (const word of words) {
        for (const letter of word) {
          if (used.has(letter)) counts.set(letter, (counts.get(letter) ?? 0) + 1);
        }
      }
      const given = VOWELS.filter((v) => used.has(v)).sort(
        (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0),
      )[0];

      if (given) fill(new Set([given]));
      const enabled = new Set(used);
      enabled.delete(given ?? '');
      return { prefilled, enabled };
    }

    case 'difficult': {
      // Nothing filled, but the piles no longer lie about what is in play:
      // a vowel the phrase never uses is not offered.
      return { prefilled, enabled: used };
    }

    case 'brutal':
    default:
      // All five live, whether or not the phrase uses them — a disabled pile
      // would reveal that its vowel is absent.
      return { prefilled, enabled: new Set(VOWELS) };
  }
}
