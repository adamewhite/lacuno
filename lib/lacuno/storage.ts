/**
 * Local persistence for the daily archive.
 *
 * Only what the calendar needs: which days the player finished, and whether
 * each was solved outright or given up on. Everything is wrapped in try/catch
 * and guarded on `available()`, because localStorage throws rather than
 * returning null in private-browsing modes and when a quota is exhausted — an
 * archive is not worth crashing a game over.
 *
 * Writes carry a schema version. Anything written by an older schema is
 * discarded rather than migrated; v1 has no prior schema to migrate from.
 */

const SCHEMA_VERSION = 1;
const PREFIX = 'lacuno';
const daysKey = `${PREFIX}:days`;

export interface DayRecord {
  /** How many of the day's rounds the player solved without giving up. */
  readonly solved: number;
  /** Rounds in the day's game, so a partial record still renders. */
  readonly rounds: number;
  /** Hints spent across the whole game. */
  readonly hints: number;
  /**
   * Total time, hint penalties included. Optional: days recorded before the
   * clock existed have none, and the calendar shows them without a time
   * rather than pretending they were instant.
   */
  readonly timeMs?: number;
}

interface DayStore {
  readonly version: number;
  readonly days: Record<string, DayRecord>;
}

function available(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function read<T extends { version?: number }>(key: string): T | null {
  if (!available()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    if (parsed?.version !== SCHEMA_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (!available()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Full or blocked storage: the archive silently stops remembering rather
    // than taking the game down with it.
  }
}

/** Every finished day, keyed by 2026-09-15 date keys. */
export function loadDays(): Record<string, DayRecord> {
  return read<DayStore>(daysKey)?.days ?? {};
}

/**
 * Record a finished day. The first completion of a date is the one kept, so
 * replaying an archived day cannot overwrite a better result with a worse one.
 */
export function recordDay(dateKey: string, record: DayRecord): void {
  const days = loadDays();
  if (days[dateKey]) return;
  write(daysKey, {
    version: SCHEMA_VERSION,
    days: { ...days, [dateKey]: record },
  });
}

/** True when a day is fully solved — every round, no giving up. */
export const isFullySolved = (record: DayRecord | undefined): boolean =>
  !!record && record.rounds > 0 && record.solved >= record.rounds;
