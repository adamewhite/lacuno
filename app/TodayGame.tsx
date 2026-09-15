'use client';

import { useEffect, useState } from 'react';

import Game from './Game';
import { DEFAULT_DIFFICULTY, type Difficulty } from '../lib/lacuno/difficulty';
import { gameDayNumber } from '../lib/lacuno/daily';

/**
 * Today's daily game.
 *
 * The day number comes from the clock, which cannot be read during render
 * without risking a hydration mismatch — the server and the client can sit on
 * opposite sides of midnight Eastern. So the day resolves on mount and the
 * board waits a frame for it, the same shape the archive pages use.
 */
export default function TodayGame({
  difficulty = DEFAULT_DIFFICULTY,
}: {
  difficulty?: Difficulty;
}) {
  const [day, setDay] = useState<number | null>(null);

  useEffect(() => {
    setDay(gameDayNumber(Date.now()));
  }, []);

  if (day === null) return <main className="h-full" />;
  return <Game difficulty={difficulty} day={day} />;
}
