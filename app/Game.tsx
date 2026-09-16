'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import PhraseBoard from './PhraseBoard';
import Opening from './Opening';
import Dialog from './Dialog';
import phraseData from './puzzles-phrases.json';
import type { PhrasePuzzleData } from './usePhrase';
import { DEFAULT_DIFFICULTY, type Difficulty } from '../lib/lacuno/difficulty';
import { pickRounds, ROUND_COUNT } from '../lib/lacuno/rounds';
import { dateKeyOfDay, gameDayNumber, roundsForDay } from '../lib/lacuno/daily';
import { recordDay } from '../lib/lacuno/storage';
import { copyToClipboard, shareText, systemShare } from '../lib/lacuno/share';
import {
  chargeHint,
  elapsedMs,
  formatClock,
  HINT_PENALTY_MS,
  idleClock,
  pause,
  resume,
  startedClock,
  type Clock,
} from '../lib/lacuno/clock';

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
  /**
   * Whether the LAST round was solved, which is what earns Congratulations.
   * Not the same as a clean sweep: cracking the longest phrase after giving up
   * earlier is still the moment worth marking.
   */
  const [solvedFinal, setSolvedFinal] = useState(false);
  const [hintCount, setHintCount] = useState(0);

  /**
   * The game clock. Starts stopped, because Date.now() during render would
   * risk a hydration mismatch — an effect starts it once the board is up.
   * `now` is what drives the display; the clock itself is only two numbers.
   */
  const [clock, setClock] = useState<Clock>(idleClock);
  const [now, setNow] = useState(0);

  /**
   * The board waits behind an opening screen. Nothing is timed until Begin, so
   * nobody's clock runs while they are reading the intro.
   */
  const [begun, setBegun] = useState(false);

  const begin = useCallback(() => {
    setBegun(true);
    setClock(startedClock(Date.now()));
    setNow(Date.now());
  }, []);

  // Tick once a second while the clock runs. The interval only refreshes
  // `now`, so a re-render never disturbs the clock's own arithmetic.
  useEffect(() => {
    if (clock.startedAt === null || complete) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [clock.startedAt, complete]);

  const newGame = useCallback(() => {
    setRounds(pickRounds(puzzles, shuffle(puzzles.length)));
    setRoundIndex(0);
    setComplete(false);
    setSolvedCount(0);
    setSolvedFinal(false);
    setHintCount(0);
    // Straight into play: the player has already chosen to start another.
    setBegun(true);
    setClock(startedClock(Date.now()));
    setNow(Date.now());
  }, [shuffle]);

  /**
   * A hint costs time, banked the moment it is spent.
   *
   * The count comes from the round's own `hintsUsed` on advance, so this only
   * charges the clock — incrementing here as well would count every hint
   * twice.
   */
  const onHint = useCallback(() => {
    setClock((c) => chargeHint(c));
    setNow(Date.now());
  }, []);

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
      const isLast = roundIndex + 1 >= rounds.length;
      setSolvedCount(solved);
      setHintCount(hints);

      // Stop the clock at the click, not after the fade: the 160ms transition
      // and the summary screen are not the player's time. The final total is
      // read from the paused clock so it cannot drift.
      const stopped = pause(clock, Date.now());
      setClock(stopped);
      setNow(Date.now());

      // The last round does not fade: the summary opens over the finished
      // board, so fading it out would hide the phrase the player just solved.
      if (isLast) {
        setSolvedFinal(outcome.solved);
        setComplete(true);
        // Only a dated game belongs in the archive.
        if (isDaily) {
          recordDay(dateKeyOfDay(day as number), {
            solved,
            rounds: rounds.length,
            hints,
            timeMs: stopped.bankedMs,
          });
        }
        return;
      }

      setLeaving(true);
      setTimeout(() => {
        setRoundIndex(roundIndex + 1);
        // The next round resumes the same clock — it is one game's time.
        setClock(resume(stopped, Date.now()));
        setNow(Date.now());
        setLeaving(false);
      }, 160); // matches .board-leave
    },
    [roundIndex, rounds.length, isDaily, day, solvedCount, hintCount, clock],
  );

  /**
   * Sharing the finished day: the system sheet where it exists, otherwise the
   * clipboard. The time comes from the paused clock, so it matches both the
   * summary and the archive record exactly.
   */
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const onShare = useCallback(async () => {
    if (!isDaily) return;
    const text = shareText({
      dateKey: dateKeyOfDay(day as number),
      solved: solvedCount,
      rounds: rounds.length,
      timeMs: clock.bankedMs,
    });
    if (systemShare(text)) return; // the sheet took it; no confirmation needed
    setShareState((await copyToClipboard(text)) ? 'copied' : 'failed');
  }, [isDaily, day, solvedCount, rounds.length, clock.bankedMs]);

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

  const dateKey = isDaily ? dateKeyOfDay(day as number) : null;

  // The opening screen holds the board back until Begin, so nobody reads the
  // racks while their clock runs.
  if (!begun) {
    return (
      <main className="h-full">
        <Opening
          onBegin={begin}
          difficulty={difficulty}
          rounds={rounds.length || ROUND_COUNT}
          dateLabel={dateKey}
        />
      </main>
    );
  }

  const puzzle = puzzles[rounds[roundIndex] ?? 0];
  const isFinal = roundIndex + 1 >= rounds.length;
  const isToday = isDaily && day === gameDayNumber(Date.now());


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
        onHint={onHint}
        clock={formatClock(elapsedMs(clock, now))}
        // Solving the last round ends the game on its own.
        finishOnSolve={isFinal}
        // PhraseBoard shows this only once the phrase is actually solved, so
        // it lands during the beat before the summary opens.
        banner={isFinal ? 'Congratulations!' : null}
      />

      {/* The summary arrives over the finished board rather than replacing it
          with another screen, so the solved phrase stays in view. */}
      <Dialog open={complete} title="Game complete" onClose={() => setComplete(false)}>
        <div className="flex flex-col items-center gap-5">
          <p
            className="text-[15px] font-bold uppercase sm:text-[18px]"
            style={{ letterSpacing: '0.14em', color: 'var(--frame-text)' }}
          >
            {solvedFinal ? 'Congratulations!' : 'Game complete'}
          </p>

          <div className="flex flex-col items-center gap-1">
            <span
              className="tabular-nums text-[30px] font-bold leading-none sm:text-[36px]"
              style={{ color: 'var(--frame-text)' }}
            >
              {formatClock(clock.bankedMs)}
            </span>
            <span
              className="text-[10px] font-semibold uppercase sm:text-[12px]"
              style={{ letterSpacing: '0.14em', opacity: 0.65, color: 'var(--frame-text)' }}
            >
              {solvedCount} of {rounds.length} rounds solved
            </span>
            {/* A time that is partly hint penalties should say so. */}
            {hintCount > 0 && (
              <span
                className="text-[10px] font-semibold uppercase sm:text-[12px]"
                style={{ letterSpacing: '0.14em', opacity: 0.65, color: 'var(--frame-text)' }}
              >
                Includes {hintCount} hint{hintCount === 1 ? '' : 's'} (+
                {formatClock(hintCount * HINT_PENALTY_MS)})
              </span>
            )}
          </div>

          <div className="flex w-full flex-col items-center gap-2.5">
            {isDaily && (
              <button
                onClick={onShare}
                className="w-full rounded-md border-[1.5px] border-frame bg-frame px-6 py-2.5 text-[12px] font-bold uppercase text-frame-text transition-opacity hover:opacity-90 sm:py-3 sm:text-[15px]"
                style={{ letterSpacing: '0.12em' }}
              >
                {shareState === 'copied'
                  ? 'Copied ✓'
                  : shareState === 'failed'
                    ? 'Copy failed'
                    : 'Share'}
              </button>
            )}

            {/* A dated game does not reshuffle — replaying it would serve the
                same three puzzles — so it offers the calendar instead. */}
            {isDaily ? (
              <div className="flex flex-col items-center gap-2">
                <Link
                  href={`/archive${dateKey ? `?m=${dateKey.slice(0, 7)}` : ''}`}
                  className="text-[11px] font-semibold uppercase sm:text-[13px]"
                  style={{ letterSpacing: '0.16em', color: 'var(--frame-text)' }}
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
                className="w-full rounded-md border-[1.5px] border-frame bg-frame px-6 py-2.5 text-[12px] font-bold uppercase text-frame-text transition-opacity hover:opacity-90 sm:py-3 sm:text-[15px]"
                style={{ letterSpacing: '0.12em' }}
              >
                Play Again
              </button>
            )}
          </div>
        </div>
      </Dialog>
    </main>
  );
}
