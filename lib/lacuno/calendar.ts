/**
 * Month-grid arithmetic for the archive calendar.
 *
 * Kept apart from the page so the awkward parts — leading blanks, short final
 * weeks, which months are reachable — are testable without rendering.
 */

import { DAY_MS, EPOCH_DAY, isPlayableDay } from './daily';

export const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/**
 * The weeks of a UTC month as day numbers, null-padded to whole weeks so every
 * row has seven cells and the columns line up under the weekday header.
 */
export function monthWeeks(year: number, month: number): (number | null)[][] {
  const first = Date.UTC(year, month, 1) / DAY_MS;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = new Date(first * DAY_MS).getUTCDay();

  const cells: (number | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 0; d < daysInMonth; d++) cells.push(first + d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * A month's weeks with the empty ones dropped — rows entirely before the
 * archive began or entirely in the future would render as blank strips.
 */
export function playableWeeks(
  year: number,
  month: number,
  today: number,
): (number | null)[][] {
  return monthWeeks(year, month).filter((week) =>
    week.some((day) => day !== null && isPlayableDay(day, today)),
  );
}

/** A month is reachable while any of its days falls inside the archive. */
export function hasPlayableDays(year: number, month: number, today: number): boolean {
  const first = Date.UTC(year, month, 1) / DAY_MS;
  const last = Date.UTC(year, month + 1, 0) / DAY_MS;
  return last >= EPOCH_DAY && first <= today;
}

/** The month `delta` steps away, if the archive reaches it. */
export function stepMonth(
  year: number,
  month: number,
  delta: number,
  today: number,
): { year: number; month: number } | null {
  const next = new Date(Date.UTC(year, month + delta, 1));
  const y = next.getUTCFullYear();
  const m = next.getUTCMonth();
  return hasPlayableDays(y, m, today) ? { year: y, month: m } : null;
}

/** "September 2026" for a month, in UTC so it matches the day numbers. */
export const monthName = (year: number, month: number): string =>
  new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
