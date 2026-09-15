'use client';

import { useCallback, useEffect, useState } from 'react';

import PhraseBoard from './PhraseBoard';
import phraseData from './puzzles-phrases.json';
import type { PhrasePuzzleData } from './usePhrase';
import { DEFAULT_DIFFICULTY, type Difficulty } from '../lib/lacuno/difficulty';
import { pickRounds, ROUND_COUNT } from '../lib/lacuno/rounds';

/**
 * Phrase puzzles: one rack per word of a phrase, consonants scarce, vowels
 * supplied according to the difficulty. Content comes from data/phrases.txt via
 * `npm run build:puzzles`.
 */
const puzzles = phraseData.puzzles as unknown as PhrasePuzzleData[];
const values = phraseData.values as number[];

export default function Game({
  difficulty = DEFAULT_DIFFICULTY,
}: {
  difficulty?: Difficulty;
}) {
  /**
   * A game is three rounds of increasing length (see lib/lacuno/rounds).
   *
   * The round puzzles are drawn from a shuffled deck, so the length ramp is the
   * same every game while the phrases are not. The first render must match the
   * server's, so the deck starts unshuffled and is shuffled in an effect —
   * picking randomly during render would produce a hydration mismatch.
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
    pickRounds(puzzles, puzzles.map((_, i) => i)),
  );
  const [roundIndex, setRoundIndex] = useState(0);
  /** Set once the last round is finished, replacing the board. */
  const [complete, setComplete] = useState(false);

  const newGame = useCallback(() => {
    setRounds(pickRounds(puzzles, shuffle(puzzles.length)));
    setRoundIndex(0);
    setComplete(false);
  }, [shuffle]);

  useEffect(() => {
    if (puzzles.length > 0) setRounds(pickRounds(puzzles, shuffle(puzzles.length)));
  }, [shuffle]);

  /**
   * Advance with a fade. The next board is a different shape — different
   * racks, tiles and often tile size — so it fades out before swapping and
   * fades back in, rather than cutting between two unrelated layouts.
   */
  const [leaving, setLeaving] = useState(false);

  const next = useCallback(() => {
    setLeaving(true);
    setTimeout(() => {
      // Past the last round the game is over; the summary offers a fresh one.
      if (roundIndex + 1 >= rounds.length) setComplete(true);
      else setRoundIndex(roundIndex + 1);
      setLeaving(false);
    }, 160); // matches .board-leave
  }, [roundIndex, rounds.length]);

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
    return (
      <main className={`h-full ${leaving ? 'board-leave' : 'board-enter'}`}>
        <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
          <p
            className="text-[13px] font-semibold uppercase sm:text-[16px]"
            style={{ letterSpacing: '0.18em', color: 'var(--frame-text)' }}
          >
            All {rounds.length} rounds complete
          </p>
          <button
            onClick={startAgain}
            className="rounded-md border-[1.5px] border-frame bg-frame px-6 py-2.5 text-[12px] font-bold uppercase text-frame-text transition-opacity hover:opacity-90 sm:py-3.5 sm:text-[15px]"
            style={{ letterSpacing: '0.12em' }}
          >
            Play Again
          </button>
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
        // which vowels are pre-filled changes with it.
        key={`${difficulty}-${puzzle.id}`}
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
