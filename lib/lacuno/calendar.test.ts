import { describe, expect, it } from 'vitest';

import {
  hasPlayableDays,
  monthName,
  monthWeeks,
  playableWeeks,
  stepMonth,
  WEEKDAYS,
} from './calendar';
import { DAY_MS, EPOCH_DAY, dateKeyOfDay, dayOfDateKey } from './daily';

describe('monthWeeks', () => {
  it('pads every row to seven cells', () => {
    for (const month of [0, 1, 5, 8, 11]) {
      for (const week of monthWeeks(2026, month)) {
        expect(week).toHaveLength(7);
      }
    }
  });

  it('leads with blanks up to the first weekday', () => {
    // 1 September 2026 is a Tuesday, so Sunday and Monday lead as blanks.
    const weeks = monthWeeks(2026, 8);
    expect(weeks[0][0]).toBeNull();
    expect(weeks[0][1]).toBeNull();
    expect(dateKeyOfDay(weeks[0][2] as number)).toBe('2026-09-01');
  });

  it('covers every day of the month exactly once', () => {
    const days = monthWeeks(2026, 8).flat().filter((d): d is number => d !== null);
    expect(days).toHaveLength(30); // September
    expect(new Set(days).size).toBe(30);
  });

  it('handles February in a leap year', () => {
    const days = monthWeeks(2024, 1).flat().filter((d) => d !== null);
    expect(days).toHaveLength(29);
  });

  it('handles a month starting on Sunday with no lead blanks', () => {
    // 1 February 2026 is a Sunday.
    const weeks = monthWeeks(2026, 1);
    expect(dateKeyOfDay(weeks[0][0] as number)).toBe('2026-02-01');
  });

  it('numbers days consecutively across a row', () => {
    const weeks = monthWeeks(2026, 8);
    const row = weeks[1] as number[];
    for (let i = 1; i < row.length; i++) expect(row[i] - row[i - 1]).toBe(1);
  });
});

describe('playableWeeks', () => {
  it('drops weeks entirely in the future', () => {
    const today = dayOfDateKey('2026-09-10') as number;
    const weeks = playableWeeks(2026, 8, today);
    const allDays = weeks.flat().filter((d): d is number => d !== null);
    // The last week of September is wholly after the 10th, so it is gone.
    expect(Math.min(...allDays)).toBeLessThanOrEqual(today);
    expect(weeks.every((w) => w.some((d) => d !== null && d <= today))).toBe(true);
  });

  it('drops weeks entirely before the epoch', () => {
    const today = EPOCH_DAY + 400;
    const epochDate = new Date(EPOCH_DAY * DAY_MS);
    // The month before the epoch month has no playable days at all.
    const weeks = playableWeeks(
      epochDate.getUTCFullYear(),
      epochDate.getUTCMonth() - 1,
      today,
    );
    expect(weeks).toEqual([]);
  });

  it('keeps a fully playable month intact', () => {
    const today = EPOCH_DAY + 400;
    const d = new Date((EPOCH_DAY + 60) * DAY_MS);
    const weeks = playableWeeks(d.getUTCFullYear(), d.getUTCMonth(), today);
    expect(weeks.length).toBeGreaterThan(0);
  });
});

describe('hasPlayableDays', () => {
  const today = dayOfDateKey('2026-09-15') as number;

  it('accepts the current month', () => {
    expect(hasPlayableDays(2026, 8, today)).toBe(true);
  });

  it('rejects a month wholly in the future', () => {
    expect(hasPlayableDays(2026, 10, today)).toBe(false);
  });

  it('rejects a month wholly before the epoch', () => {
    expect(hasPlayableDays(2020, 0, today)).toBe(false);
  });
});

describe('stepMonth', () => {
  const today = dayOfDateKey('2026-09-15') as number;

  it('steps back a month', () => {
    expect(stepMonth(2026, 8, -1, today)).toEqual({ year: 2026, month: 7 });
  });

  it('wraps a year backwards from January', () => {
    // Today has to be late enough that December 2026 is reachable at all.
    const later = dayOfDateKey('2027-01-15') as number;
    expect(stepMonth(2027, 0, -1, later)).toEqual({ year: 2026, month: 11 });
  });

  it('refuses to step past today', () => {
    expect(stepMonth(2026, 8, 1, today)).toBeNull();
  });

  it('refuses to step before the epoch', () => {
    const d = new Date(EPOCH_DAY * DAY_MS);
    expect(stepMonth(d.getUTCFullYear(), d.getUTCMonth(), -1, today)).toBeNull();
  });
});

describe('monthName', () => {
  it('names the month and year', () => {
    expect(monthName(2026, 8)).toBe('September 2026');
    expect(monthName(2026, 0)).toBe('January 2026');
  });
});

describe('WEEKDAYS', () => {
  it('has seven initials starting on Sunday', () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0]).toBe('S');
  });
});
