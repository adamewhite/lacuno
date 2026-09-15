/**
 * A game is three rounds, each phrase longer than the last.
 *
 * Length is the ramp: round one is a short phrase to get the player reading the
 * rack totals, and by round three they are holding a long phrase's worth of
 * scarce consonants in mind. Unlike vwldrp's chains — where each round's
 * consonants must nest inside the next — rounds here are independent puzzles.
 * Nesting would constrain phrase selection so hard that a 210-phrase pool could
 * not fill it; ascending length gives the same sense of escalation while any
 * three phrases can form a game.
 *
 * Rounds are drawn from LENGTH BANDS rather than by sorting the whole pool, so
 * the difficulty curve is the same shape every game while the phrases differ.
 */

export const ROUND_COUNT = 3;

/**
 * Letter-count bands, easiest first. Chosen from the shipped pool's actual
 * distribution (4–21 letters) so each band holds enough phrases to stay varied
 * across sessions — roughly a quarter, a half and a third of the pool.
 */
export const ROUND_BANDS: readonly { readonly min: number; readonly max: number }[] = [
  { min: 0, max: 9 },
  { min: 10, max: 12 },
  { min: 13, max: Infinity },
];

/** The least a puzzle must carry for the round logic to place it. */
export interface RoundCandidate {
  readonly letterCount: number;
}

/**
 * Pick one puzzle index per round: three ascending-length puzzles.
 *
 * `order` is a shuffled list of indices into `puzzles` — the caller's deck — so
 * which phrase fills a band varies per game while the ramp does not. Taking the
 * first match in the shuffled order is what keeps selection random within a
 * band.
 *
 * Bands are only a preference. If a band is empty (a small or heavily filtered
 * pool), the round falls back to the shortest unused puzzle that is still longer
 * than the round before it, so the ascending guarantee holds even when the
 * bands cannot be honoured. Returns fewer than ROUND_COUNT rounds only when the
 * pool genuinely cannot supply three ascending lengths.
 */
export function pickRounds(
  puzzles: readonly RoundCandidate[],
  order: readonly number[],
): number[] {
  const chosen: number[] = [];
  const used = new Set<number>();
  // Only ever go up: each round must beat the last round's length.
  let floor = -1;

  for (const band of ROUND_BANDS) {
    const low = Math.max(band.min, floor + 1);

    let pick = order.find((i) => {
      if (used.has(i)) return false;
      const n = puzzles[i]?.letterCount;
      return n !== undefined && n >= low && n <= band.max;
    });

    // Band empty at this floor: take the shortest puzzle that still ascends,
    // which keeps the ramp intact at the cost of the intended band.
    if (pick === undefined) {
      const fallback = order
        .filter((i) => !used.has(i) && (puzzles[i]?.letterCount ?? -1) > floor)
        .sort((a, b) => puzzles[a].letterCount - puzzles[b].letterCount);
      pick = fallback[0];
    }

    if (pick === undefined) break; // pool exhausted; return what we have
    chosen.push(pick);
    used.add(pick);
    floor = puzzles[pick].letterCount;
  }

  return chosen;
}
