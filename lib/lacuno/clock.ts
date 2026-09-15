/**
 * The game clock, for the archive's times.
 *
 * A game spans three rounds and the fades between them, so the clock cannot
 * just be "now minus when the board appeared". It is kept as two parts, the
 * shape vwldrp's chain clock uses:
 *
 *   - `bankedMs`  time from rounds already finished, plus hint penalties
 *   - `startedAt` when the running round's clock started, or null when stopped
 *
 * Pausing banks the running time and nulls `startedAt`; resuming sets it
 * again. Nothing accumulates while stopped, so the fade between rounds and any
 * time with a menu open are free.
 *
 * Every function here is pure and takes `now`, so the tests never touch the
 * real clock.
 */

/** A hint costs this much, banked the moment it is spent. */
export const HINT_PENALTY_MS = 30_000;

export interface Clock {
  readonly bankedMs: number;
  readonly startedAt: number | null;
}

export const startedClock = (now: number): Clock => ({ bankedMs: 0, startedAt: now });

/** A clock that has not started counting yet. */
export const idleClock = (): Clock => ({ bankedMs: 0, startedAt: null });

/** Total elapsed time: what is banked, plus whatever the running round adds. */
export function elapsedMs(clock: Clock, now: number): number {
  const running = clock.startedAt === null ? 0 : Math.max(0, now - clock.startedAt);
  return clock.bankedMs + running;
}

/** Stop the clock, banking the running round's time. A no-op when stopped. */
export function pause(clock: Clock, now: number): Clock {
  if (clock.startedAt === null) return clock;
  return { bankedMs: elapsedMs(clock, now), startedAt: null };
}

/** Start the clock again. A no-op when already running. */
export function resume(clock: Clock, now: number): Clock {
  if (clock.startedAt !== null) return clock;
  return { bankedMs: clock.bankedMs, startedAt: now };
}

/**
 * Charge a hint. The penalty is banked immediately rather than added at the
 * end, so the running display reflects it the moment the hint is taken.
 */
export function chargeHint(clock: Clock, penaltyMs = HINT_PENALTY_MS): Clock {
  return { ...clock, bankedMs: clock.bankedMs + penaltyMs };
}

/**
 * M:SS, or H:MM:SS once a game runs past an hour — a bare M:SS would read
 * "5:04" for a game that actually took an hour and five minutes.
 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours === 0) return `${minutes}:${ss}`;
  return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
}

/** The compact form the calendar tiles use: whole minutes, rounded up. */
export function formatTileClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 100) return `${minutes}m`;
  // Past 99 minutes the tile has no room for a useful number.
  return '99m+';
}
