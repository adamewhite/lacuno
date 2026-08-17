/**
 * Difficulty levels, for playtesting how much vowel help a puzzle needs.
 *
 * Every level uses the same puzzles and the same consonant pool. What varies is
 * how much of the vowel work is done for the player:
 *
 *   easiest   every vowel is already on the board; all five piles disabled
 *   easier    one whole vowel pre-filled throughout (every E, say), and the
 *             piles show only the vowels genuinely in play
 *   medium    vowels the phrase never uses are disabled, so the piles show
 *             only what is in play — but nothing is placed for you
 *   hardest   nothing given; all five piles live, whether or not the phrase
 *             uses them
 *
 * `hardest` is the shipped behaviour. The other three exist to find out where
 * the puzzle actually lands for a person who is not the author.
 */

export const DIFFICULTIES = ['easiest', 'easier', 'medium', 'hardest'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * What a first-time visitor gets. The easiest level is the friendliest
 * introduction — the puzzle still has to be worked out, but the vowels are not
 * also a guessing game on top of it.
 */
export const DEFAULT_DIFFICULTY: Difficulty = 'easiest';

export interface DifficultyMeta {
  readonly slug: Difficulty;
  /** Shown in the menu. */
  readonly label: string;
  /** One line explaining what the level gives away. */
  readonly blurb: string;
}

export const DIFFICULTY_META: Record<Difficulty, DifficultyMeta> = {
  easiest: {
    slug: 'easiest',
    label: 'Easiest',
    blurb: 'All vowels filled in',
  },
  easier: {
    slug: 'easier',
    label: 'Easier',
    blurb: 'One vowel filled in for you',
  },
  medium: {
    slug: 'medium',
    label: 'Medium',
    blurb: 'Only the vowels in play are offered',
  },
  hardest: {
    slug: 'hardest',
    label: 'Hardest',
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
    case 'easiest': {
      // Everything given: the puzzle becomes purely about the consonants.
      fill(used);
      return { prefilled, enabled: new Set() };
    }

    case 'easier': {
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

    case 'medium': {
      // Nothing filled, but the piles no longer lie about what is in play:
      // a vowel the phrase never uses is not offered.
      return { prefilled, enabled: used };
    }

    case 'hardest':
    default:
      // All five live, whether or not the phrase uses them — a disabled pile
      // would reveal that its vowel is absent.
      return { prefilled, enabled: new Set(VOWELS) };
  }
}
