'use client';

import { useCallback, useEffect, useState } from 'react';

import PhraseBoard from './PhraseBoard';
import phraseData from './puzzles-phrases.json';
import type { PhrasePuzzleData } from './usePhrase';
import { DEFAULT_DIFFICULTY, type Difficulty } from '../lib/procro/difficulty';

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
   * Puzzles are served from a shuffled deck rather than picked independently at
   * random, so a short session never repeats one. The deck reshuffles once it
   * is exhausted.
   *
   * The first render must match the server's, so the deck starts unshuffled and
   * is shuffled in an effect — picking randomly during render would produce a
   * hydration mismatch.
   */
  const [deck, setDeck] = useState<number[]>(() => puzzles.map((_, i) => i));
  const [position, setPosition] = useState(0);

  const shuffle = useCallback((count: number): number[] => {
    const order = Array.from({ length: count }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }, []);

  useEffect(() => {
    if (puzzles.length > 0) setDeck(shuffle(puzzles.length));
  }, [shuffle]);

  const next = useCallback(() => {
    setPosition((current) => {
      const upcoming = current + 1;
      if (upcoming < deck.length) return upcoming;
      setDeck(shuffle(puzzles.length));
      return 0;
    });
  }, [deck.length, shuffle]);

  if (puzzles.length === 0) {
    return (
      <main className="p-8 text-sm">
        No puzzles. Run <code>npm run build:puzzles</code>.
      </main>
    );
  }

  const puzzle = puzzles[deck[position] ?? 0];

  return (
    <main>
      <PhraseBoard
        // Keyed by difficulty too: changing level must rebuild the board, since
        // which vowels are pre-filled changes with it.
        key={`${difficulty}-${puzzle.id}`}
        puzzle={puzzle}
        values={values}
        difficulty={difficulty}
        onNext={next}
      />
    </main>
  );
}
