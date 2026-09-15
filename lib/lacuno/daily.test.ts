import { describe, expect, it } from 'vitest';

import {
  ANCHOR_DAY,
  DAY_MS,
  EPOCH_DAY,
  dateKeyOfDay,
  dayOfDateKey,
  gameDayNumber,
  isPlayableDay,
  roundsForDay,
  seededOrder,
} from './daily';
import { ROUND_COUNT } from './rounds';

const pool = (...lengths: number[]) => lengths.map((letterCount) => ({ letterCount }));
/** A pool broad enough to fill all three length bands. */
const broad = () => pool(5, 8, 9, 10, 11, 12, 13, 15, 18, 7, 11, 14);

describe('dateKeyOfDay / dayOfDateKey', () => {
  it('round-trips a date key', () => {
    const day = dayOfDateKey('2026-09-15');
    expect(day).not.toBeNull();
    expect(dateKeyOfDay(day as number)).toBe('2026-09-15');
  });

  it('rejects a malformed key', () => {
    expect(dayOfDateKey('2026-9-15')).toBeNull();
    expect(dayOfDateKey('nonsense')).toBeNull();
    expect(dayOfDateKey('')).toBeNull();
  });

  it('counts consecutive days one apart', () => {
    const a = dayOfDateKey('2026-09-15') as number;
    const b = dayOfDateKey('2026-09-16') as number;
    expect(b - a).toBe(1);
  });
});

describe('gameDayNumber', () => {
  it('names the day by its US Eastern calendar date', () => {
    // 04:00 UTC on the 15th is still the 14th in New York (UTC-4 in September).
    const day = gameDayNumber(Date.parse('2026-09-15T03:00:00Z'));
    expect(dateKeyOfDay(day)).toBe('2026-09-14');
  });

  it('rolls over at Eastern midnight', () => {
    const before = gameDayNumber(Date.parse('2026-09-15T03:59:00Z'));
    const after = gameDayNumber(Date.parse('2026-09-15T04:01:00Z'));
    expect(dateKeyOfDay(before)).toBe('2026-09-14');
    expect(dateKeyOfDay(after)).toBe('2026-09-15');
  });
});

describe('isPlayableDay', () => {
  const today = EPOCH_DAY + 100;

  it('accepts the epoch, today, and days between', () => {
    expect(isPlayableDay(EPOCH_DAY, today)).toBe(true);
    expect(isPlayableDay(today, today)).toBe(true);
    expect(isPlayableDay(EPOCH_DAY + 50, today)).toBe(true);
  });

  it('rejects days before the archive and in the future', () => {
    expect(isPlayableDay(EPOCH_DAY - 1, today)).toBe(false);
    expect(isPlayableDay(today + 1, today)).toBe(false);
  });
});

describe('seededOrder', () => {
  it('is deterministic for a seed', () => {
    expect(seededOrder(20, 7)).toEqual(seededOrder(20, 7));
  });

  it('differs between seeds', () => {
    expect(seededOrder(20, 7)).not.toEqual(seededOrder(20, 8));
  });

  it('is a permutation of every index', () => {
    const order = seededOrder(30, 3);
    expect([...order].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 30 }, (_, i) => i),
    );
  });
});

describe('roundsForDay', () => {
  const puzzles = broad();

  it('gives the same game for the same day', () => {
    const day = dayOfDateKey('2026-09-15') as number;
    expect(roundsForDay(puzzles, day)).toEqual(roundsForDay(puzzles, day));
  });

  it('gives three ascending rounds', () => {
    const day = dayOfDateKey('2026-09-15') as number;
    const rounds = roundsForDay(puzzles, day);
    expect(rounds).toHaveLength(ROUND_COUNT);
    const lengths = rounds.map((i) => puzzles[i].letterCount);
    for (let i = 1; i < lengths.length; i++) {
      expect(lengths[i]).toBeGreaterThan(lengths[i - 1]);
    }
  });

  it('varies from day to day', () => {
    // Consecutive days should not all serve the same puzzles.
    const day = dayOfDateKey('2026-09-15') as number;
    const games = Array.from({ length: 6 }, (_, i) =>
      roundsForDay(puzzles, day + i).join(','),
    );
    expect(new Set(games).size).toBeGreaterThan(1);
  });

  it('resolves a game for the anchor day', () => {
    expect(roundsForDay(puzzles, ANCHOR_DAY)).toHaveLength(ROUND_COUNT);
  });

  it('resolves a game for days before the anchor', () => {
    // The archive reaches back past the anchor; those days must still work.
    expect(roundsForDay(puzzles, EPOCH_DAY)).toHaveLength(ROUND_COUNT);
    expect(roundsForDay(puzzles, ANCHOR_DAY - 500)).toHaveLength(ROUND_COUNT);
  });

  it('serves an ascending game for every day of a long span', async () => {
    const data = (await import('../../app/puzzles-phrases.json')).default;
    const real = data.puzzles as unknown as { letterCount: number }[];
    for (let day = EPOCH_DAY; day < EPOCH_DAY + 400; day++) {
      const rounds = roundsForDay(real, day);
      expect(rounds).toHaveLength(ROUND_COUNT);
      const lengths = rounds.map((i) => real[i].letterCount);
      for (let i = 1; i < lengths.length; i++) {
        expect(lengths[i]).toBeGreaterThan(lengths[i - 1]);
      }
    }
  });

  it('keeps DAY_MS a whole day', () => {
    expect(DAY_MS).toBe(24 * 60 * 60 * 1000);
  });
});
