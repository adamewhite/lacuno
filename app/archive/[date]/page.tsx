'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import Game from '../../Game';
import { DEFAULT_DIFFICULTY, type Difficulty } from '../../../lib/lacuno/difficulty';
import { dayOfDateKey, gameDayNumber, isPlayableDay } from '../../../lib/lacuno/daily';

/**
 * A past day's game, straight from the archive calendar. The date names a
 * fixed three-round set, so the same link always plays the same puzzles.
 *
 * A date outside the archive — malformed, before the epoch, or in the future —
 * redirects to the calendar rather than 404ing, since the usual way to land on
 * one is an edited URL or a stale link.
 */
export default function ArchiveDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ level?: string }>;
}) {
  const { date } = use(params);
  const { level } = use(searchParams);
  const router = useRouter();

  // The clock cannot be read during render without risking a hydration
  // mismatch, so validity is resolved on mount.
  const [day, setDay] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const candidate = dayOfDateKey(date);
    const today = gameDayNumber(Date.now());
    if (candidate !== null && isPlayableDay(candidate, today)) setDay(candidate);
    else router.replace('/archive');
    setChecked(true);
  }, [date, router]);

  // A blank beat while the date is validated, not a second gate.
  if (!checked || day === null) return <main className="h-full" />;

  return <Game difficulty={(level as Difficulty) ?? DEFAULT_DIFFICULTY} day={day} />;
}
