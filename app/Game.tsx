'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import PhraseBoard from './PhraseBoard';
import phraseData from './puzzles-phrases.json';
import type { PhrasePuzzleData } from './usePhrase';
import { DEFAULT_DIFFICULTY, type Difficulty } from '../lib/lacuno/difficulty';
import { pickRounds, ROUND_COUNT } from '../lib/lacuno/rounds';
import { dateKeyOfDay, gameDayNumber, roundsForDay } from '../lib/lacuno/daily';
import { recordDay } from '../lib/lacuno/storage';

/**
 * Phrase puzzles: one rack per word of a phrase, consonants scarce, vowels
 * supplied according to the difficulty. Content comes from data/phrases.txt via
 * `npm run build:puzzles`.
 */
const puzzles = phraseData.puzzles as unknown as PhrasePuzzleData[];
const values = phraseData.values as number[];

export default function Game({
  difficulty = DEFAULT_DIFFICULTY,
  day,
}: {
  difficulty?: Difficulty;
  /**
   * Set to play a specific archived day: the game is then FIXED — the same
   * three puzzles every visit — and finishing it fills that date's calendar
   * tile. Left unset, the game is a random set that records nothing.
   */
  day?: number;
}) {
  const isDaily = day !== undefined;

  /**
   * A game is three rounds of increasing length (see lib/lacuno/rounds).
   *
   * In daily mode the day number seeds the choice, so the set is stable. In
   * random mode the puzzles come from a shuffled deck: the first render must
   * match the server's, so the deck starts unshuffled and is shuffled in an
   * effect — picking randomly during render would produce a hydration
   * mismatch.
   */
  const shuffle = useCallback((count: number): number[] => {
    const order = Array.from({ length: count }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }, []);

  const [rounds, setRounds] = useState<number[]>(() =>
    isDaily
      ? roundsForDay(puzzles, day as number)
      : pickRounds(puzzles, puzzles.map((_, i) => i)),
  );
  const [roundIndex, setRoundIndex] = useState(0);
  /** Set once the last round is finished, replacing the board. */
  const [complete, setComplete] = useState(false);
  /** Rounds solved outright this game — giving up does not count. */
  const [solvedCount, setSolvedCount] = useState(0);
  const [hintCount, setHintCount] = useState(0);

  const newGame = useCallback(() => {
    setRounds(pickRounds(puzzles, shuffle(puzzles.length)));
    setRoundIndex(0);
    setComplete(false);
    setSolvedCount(0);
    setHintCount(0);
  }, [shuffle]);

  // A daily game is fixed, so only the random deck needs shuffling on mount.
  useEffect(() => {
    if (isDaily) setRounds(roundsForDay(puzzles, day as number));
    else if (puzzles.length > 0) setRounds(pickRounds(puzzles, shuffle(puzzles.length)));
  }, [isDaily, day, shuffle]);

  /**
   * Advance with a fade. The next board is a different shape — different
   * racks, tiles and often tile size — so it fades out before swapping and
   * fades back in, rather than cutting between two unrelated layouts.
   */
  const [leaving, setLeaving] = useState(false);

  const next = useCallback(
    (outcome: { solved: boolean; hintsUsed: number }) => {
      const solved = solvedCount + (outcome.solved ? 1 : 0);
      const hints = hintCount + outcome.hintsUsed;
      setSolvedCount(solved);
      setHintCount(hints);

      setLeaving(true);
      setTimeout(() => {
        // Past the last round the game is over; the summary offers a fresh one.
        if (roundIndex + 1 >= rounds.length) {
          setComplete(true);
          // Only a dated game belongs in the archive.
          if (isDaily) {
            recordDay(dateKeyOfDay(day as number), {
              solved,
              rounds: rounds.length,
              hints,
            });
          }
        } else setRoundIndex(roundIndex + 1);
        setLeaving(false);
      }, 160); // matches .board-leave
    },
    [roundIndex, rounds.length, isDaily, day, solvedCount, hintCount],
  );

  const startAgain = useCallback(() => {
    setLeaving(true);
    setTimeout(() => {
      newGame();
      setLeaving(false);
    }, 160); // matches .board-leave
  }, [newGame]);

  if (puzzles.length === 0) {
    return (
      <main className="h-full p-8 text-sm">
        No puzzles. Run <code>npm run build:puzzles</code>.
      </main>
    );
  }

  if (complete) {
    const dateKey = isDaily ? dateKeyOfDay(day as number) : null;
    const isToday = isDaily && day === gameDayNumber(Date.now());
    return (
      <main className={`h-full ${leaving ? 'board-leave' : 'board-enter'}`}>
        <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
          <p
            className="text-[13px] font-semibold uppercase sm:text-[16px]"
            style={{ letterSpacing: '0.18em', color: 'var(--frame-text)' }}
          >
            {solvedCount === rounds.length
              ? `All ${rounds.length} rounds solved`
              : `${solvedCount} of ${rounds.length} rounds solved`}
          </p>

          {/* A dated game returns to the calendar rather than reshuffling:
              replaying it would serve the same three puzzles. */}
          {isDaily ? (
            <div className="flex flex-col items-center gap-3">
              <Link
                href={`/archive${dateKey ? `?m=${dateKey.slice(0, 7)}` : ''}`}
                className="rounded-md border-[1.5px] border-frame bg-frame px-6 py-2.5 text-[12px] font-bold uppercase text-frame-text transition-opacity hover:opacity-90 sm:py-3.5 sm:text-[15px]"
                style={{ letterSpacing: '0.12em' }}
              >
                Back to Archive
              </Link>
              {!isToday && (
                <Link
                  href="/"
                  className="text-[11px] font-semibold uppercase sm:text-[13px]"
                  style={{ letterSpacing: '0.16em', color: 'var(--frame-text)' }}
                >
                  Today&apos;s Game
                </Link>
              )}
            </div>
          ) : (
            <button
              onClick={startAgain}
              className="rounded-md border-[1.5px] border-frame bg-frame px-6 py-2.5 text-[12px] font-bold uppercase text-frame-text transition-opacity hover:opacity-90 sm:py-3.5 sm:text-[15px]"
              style={{ letterSpacing: '0.12em' }}
            >
              Play Again
            </button>
          )}
        </div>
      </main>
    );
  }

  const puzzle = puzzles[rounds[roundIndex] ?? 0];
  const isFinal = roundIndex + 1 >= rounds.length;

  return (
    // h-full so the board's own h-full resolves against the fixed body.
    <main
      key={leaving ? 'leaving' : puzzle.id}
      className={`h-full ${leaving ? 'board-leave' : 'board-enter'}`}
    >
      <PhraseBoard
        // Keyed by difficulty too: changing level must rebuild the board, since
        // which vowels are pre-filled changes with it. Keyed by round as well,
        // so a day that repeats a phrase still resets between rounds.
        key={`${difficulty}-${roundIndex}-${puzzle.id}`}
        puzzle={puzzle}
        values={values}
        difficulty={difficulty}
        round={{ index: roundIndex, total: rounds.length || ROUND_COUNT }}
        nextLabel={isFinal ? 'Finish' : 'Next Round'}
        onNext={next}
      />
    </main>
  );
}
