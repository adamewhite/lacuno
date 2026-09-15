'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import {
  hasPlayableDays,
  monthName,
  playableWeeks,
  stepMonth,
  WEEKDAYS,
} from '../../lib/lacuno/calendar';
import {
  DAY_MS,
  dateKeyOfDay,
  gameDayNumber,
  isPlayableDay,
} from '../../lib/lacuno/daily';
import { isFullySolved, loadDays, type DayRecord } from '../../lib/lacuno/storage';
import { formatTileClock } from '../../lib/lacuno/clock';

/**
 * The archive: a month calendar of every daily game the archive reaches. Each
 * past date is a tile — filled once finished, outlined otherwise — linking to
 * that day's three rounds. Today links to the live game instead. Dates before
 * the archive began and dates yet to come are blank.
 */
export default function ArchivePage() {
  const [days, setDays] = useState<Record<string, DayRecord>>({});

  // gameDayNumber reads the clock, so it cannot run during render without
  // risking a hydration mismatch. Resolved on mount instead.
  const [today, setToday] = useState<number | null>(null);
  const [month, setMonth] = useState<{ year: number; month: number } | null>(null);

  useEffect(() => {
    const now = gameDayNumber(Date.now());
    setToday(now);

    // Finishing an archived day links back with ?m=YYYY-MM, so the calendar
    // opens on the month the player came from rather than on today's.
    const m = new URLSearchParams(window.location.search).get('m');
    const match = m?.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const y = Number(match[1]);
      const mo = Number(match[2]) - 1;
      if (hasPlayableDays(y, mo, now)) {
        setMonth({ year: y, month: mo });
        setDays(loadDays());
        return;
      }
    }

    const d = new Date(now * DAY_MS);
    setMonth({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
    setDays(loadDays());
  }, []);

  // A blank frame while the clock resolves, rather than a flash of the wrong
  // month. Matches the page background so it reads as loading, not as empty.
  if (today === null || month === null) {
    return <main className="h-full" />;
  }

  const weeks = playableWeeks(month.year, month.month, today);
  const canPrev = hasPlayableDays(month.year, month.month - 1, today);
  const canNext = hasPlayableDays(month.year, month.month + 1, today);
  const step = (delta: number) => {
    const next = stepMonth(month.year, month.month, delta, today);
    if (next) setMonth(next);
  };

  return (
    <main className="h-full overflow-y-auto">
      <div
        className="mx-auto flex w-full flex-col gap-5 px-5 py-6"
        style={{ maxWidth: 560 }}
      >
        <div className="flex items-baseline justify-between">
          <h1
            className="text-[13px] font-semibold uppercase sm:text-[16px]"
            style={{ letterSpacing: '0.18em', color: 'var(--frame-text)' }}
          >
            Archive
          </h1>
          <Link
            href="/"
            className="text-[11px] font-semibold uppercase sm:text-[13px]"
            style={{ letterSpacing: '0.16em', color: 'var(--frame-text)' }}
          >
            Today&apos;s Game
          </Link>
        </div>

        {/* Month navigation. Buttons disable at the archive's two ends. */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => step(-1)}
            disabled={!canPrev}
            className="rounded-md border-[1.5px] border-accent bg-transparent px-3 py-1.5 text-[11px] font-semibold uppercase text-accent-text transition-colors hover:bg-[rgba(217,155,127,0.16)] disabled:opacity-30 sm:text-[13px]"
            style={{ letterSpacing: '0.12em' }}
          >
            Prev
          </button>
          <span
            className="text-[12px] font-semibold uppercase sm:text-[15px]"
            style={{ letterSpacing: '0.14em', color: 'var(--frame-text)' }}
          >
            {monthName(month.year, month.month)}
          </span>
          <button
            onClick={() => step(1)}
            disabled={!canNext}
            className="rounded-md border-[1.5px] border-accent bg-transparent px-3 py-1.5 text-[11px] font-semibold uppercase text-accent-text transition-colors hover:bg-[rgba(217,155,127,0.16)] disabled:opacity-30 sm:text-[13px]"
            style={{ letterSpacing: '0.12em' }}
          >
            Next
          </button>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((d, i) => (
            <span
              key={`${d}-${i}`}
              className="text-center text-[10px] font-semibold uppercase sm:text-[12px]"
              style={{ letterSpacing: '0.1em', opacity: 0.55, color: 'var(--frame-text)' }}
            >
              {d}
            </span>
          ))}
        </div>

        {/* Day tiles */}
        <div className="flex flex-col gap-1.5">
          {weeks.map((week, w) => (
            <div key={w} className="grid grid-cols-7 gap-1.5">
              {week.map((day, i) => {
                if (day === null || !isPlayableDay(day, today)) {
                  return <span key={i} className="aspect-square" />;
                }
                const key = dateKeyOfDay(day);
                const record = days[key];
                const done = isFullySolved(record);
                const partial = !!record && !done;
                const isToday = day === today;
                return (
                  <Link
                    key={i}
                    href={isToday ? '/' : `/archive/${key}`}
                    aria-label={`${key}${done ? ', solved' : partial ? ', partly solved' : ''}`}
                    className="flex aspect-square flex-col items-center justify-center rounded-md border-[1.5px] transition-opacity hover:opacity-80"
                    style={{
                      borderColor:
                        done || partial || isToday ? 'var(--accent)' : 'var(--frame)',
                      background: done ? 'var(--accent)' : 'transparent',
                      color: done ? 'var(--page)' : 'var(--frame-text)',
                    }}
                  >
                    <span className="text-[13px] font-semibold leading-none sm:text-[15px]">
                      {new Date(day * DAY_MS).getUTCDate()}
                    </span>
                    {/* Every finished day shows its time. A part-solved day
                        also shows the count, since the time alone would not
                        say it was left unfinished — and days recorded before
                        the clock existed have no time to show. */}
                    {record?.timeMs !== undefined && (
                      <span className="tabular-nums text-[9px] leading-none sm:text-[10px]">
                        {formatTileClock(record.timeMs)}
                      </span>
                    )}
                    {partial && (
                      <span className="text-[9px] leading-none opacity-70 sm:text-[10px]">
                        {record.solved}/{record.rounds}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6">
          <span
            className="text-[10px] font-semibold uppercase sm:text-[12px]"
            style={{ letterSpacing: '0.1em', opacity: 0.55, color: 'var(--frame-text)' }}
          >
            ▢ Not played
          </span>
          <span
            className="text-[10px] font-semibold uppercase sm:text-[12px]"
            style={{ letterSpacing: '0.1em', color: 'var(--accent-text)' }}
          >
            ▣ Solved
          </span>
        </div>
      </div>
    </main>
  );
}
