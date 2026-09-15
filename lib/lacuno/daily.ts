/**
 * The daily game: one three-round set per calendar date.
 *
 * Until now a game was three puzzles drawn from a shuffled deck, different on
 * every load. A dated archive needs the opposite — the game for a given day
 * must be the SAME game whenever it is opened, by anyone, so a date can be
 * revisited and shared. So the day number seeds the selection instead of
 * Math.random, and `pickRounds` runs against a deterministically shuffled
 * order rather than a random one.
 *
 * Modelled on vwldrp's chain archive: a UTC day number as the unit, an anchor
 * day the queue counts from, and an epoch the archive reaches back to.
 */

import { pickRounds, type RoundCandidate } from './rounds';

export const DAY_MS = 86_400_000;

/**
 * The first day the archive reaches back to. Backdated so the calendar opens
 * well stocked — the day mapping resolves a game for any date, so days before
 * the anchor are served just as well as days after it.
 */
export const EPOCH_DAY = Date.UTC(2026, 3, 1) / DAY_MS;

/**
 * The anchor: the day the deck's natural order was (notionally) served. Day
 * numbers offset from here, so the mapping is stable as the phrase pool grows
 * at the end — appending phrases leaves earlier days untouched.
 */
export const ANCHOR_DAY = Date.UTC(2026, 8, 1) / DAY_MS;

// The game day rolls over at midnight US Eastern, not UTC — the calendar date
// in New York names the day. Intl handles DST, so the boundary is genuinely
// midnight there all year.
const easternDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Game-day number for a timestamp — the unit the daily mapping runs on. */
export function gameDayNumber(ms: number): number {
  const [y, m, d] = easternDate.format(ms).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** 2026-09-15 for a UTC day number. */
export const dateKeyOfDay = (day: number): string =>
  new Date(day * DAY_MS).toISOString().slice(0, 10);

/** UTC day number for a 2026-09-15 key, or null if malformed. */
export function dayOfDateKey(key: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const ms = Date.parse(`${key}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms / DAY_MS;
}

/** True when a day falls inside the archive: from the epoch up to today. */
export const isPlayableDay = (day: number, today: number): boolean =>
  day >= EPOCH_DAY && day <= today;

/**
 * A small deterministic PRNG (mulberry32). Seeded per day so a date's shuffle
 * — and therefore its three puzzles — is identical on every visit, which is
 * what makes a dated archive meaningful.
 */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A deck shuffled deterministically from a seed. */
export function seededOrder(count: number, seed: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  const rand = seededRandom(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * The three puzzle indices a given day plays, shortest first.
 *
 * Offsetting the seed from the anchor (rather than using the raw day number)
 * keeps the numbers small and the anchor day's game stable.
 */
export function roundsForDay(
  puzzles: readonly RoundCandidate[],
  day: number,
): number[] {
  // +1 so the anchor day itself gets a non-zero seed; seed 0 would make
  // mulberry32's first outputs degenerate.
  const seed = day - ANCHOR_DAY + 1;
  return pickRounds(puzzles, seededOrder(puzzles.length, seed));
}
