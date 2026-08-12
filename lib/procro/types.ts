/**
 * Core PROCRO types.
 *
 * A puzzle is a pool of letter tiles plus a set of racks. Each rack has a
 * fixed length and an exact point target; the player must place ALL tiles so
 * every rack holds a valid word hitting its target exactly.
 */

/** Point value for each letter, indexed A=0 .. Z=25. See SPEC §4. */
export type LetterValues = readonly number[];

/**
 * Letters fixed in place before play begins, keyed by 0-based slot index.
 *
 * A pinned tile is locked: the player cannot move or remove it. Pins do two
 * jobs at once — they give the player a foothold, and they constrain the
 * generator's search.
 *
 * Pins are the only positional constraint in the game, which makes them the
 * only thing that can separate anagrams. STARE and RATES contain the same
 * letters and therefore always share a total; no valuation can tell them apart.
 * Pinning slot 2 to `A` admits STARE and excludes RATES.
 */
export type Pins = Readonly<Record<number, string>>;

/**
 * A rack: a fixed number of slots and the exact total they must sum to.
 *
 * Every slot scores equally — there are no positional bonuses, so a rack's
 * total is the plain sum of its tiles. (An earlier design had per-slot
 * multipliers; they were cut as too complex for the player. See SPEC §2.)
 */
export interface Rack {
  /** Number of slots; equals the length of the word that fills it. */
  readonly length: number;
  /** Exact point total this rack must hit. */
  readonly target: number;
  /** Letters locked into specific slots before play, by 0-based slot index. */
  readonly pins?: Pins;
}

/**
 * A solved board: one word per rack, in the same order as the input racks.
 */
export type Solution = readonly string[];

export interface SolveOptions {
  /**
   * Stop as soon as this many solutions are found. Uniqueness checking only
   * needs 2 ("is there more than one?"), which lets the generator bail early.
   * Omit for an exhaustive search.
   */
  readonly limit?: number;
}
