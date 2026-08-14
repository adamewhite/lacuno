'use client';

import { useState } from 'react';

import PhraseBoard from './PhraseBoard';
import phraseData from './puzzles-phrases.json';
import type { PhrasePuzzleData } from './usePhrase';

/**
 * Phrase puzzles: one rack per word of a common idiom, consonants scarce,
 * vowels unlimited.
 *
 * The earlier word-based variants (classic, and zero-vowels over single words)
 * are still generated and tested — see scripts/make-puzzles.ts and
 * scripts/make-variant-puzzles.ts — but the phrase form is what is on the
 * board now.
 */
const puzzles = phraseData.puzzles as unknown as PhrasePuzzleData[];
const values = phraseData.values as number[];

export default function Home() {
  const [index, setIndex] = useState(0);

  if (puzzles.length === 0) {
    return (
      <main className="p-8 font-mono text-sm">
        No puzzles. Run <code>npx tsx scripts/make-phrase-puzzles.ts</code>.
      </main>
    );
  }

  const safeIndex = index % puzzles.length;

  return (
    <main>
      <PhraseBoard
        key={puzzles[safeIndex].id}
        puzzle={puzzles[safeIndex]}
        values={values}
        index={safeIndex}
        count={puzzles.length}
        onNext={() => setIndex((i) => (i + 1) % puzzles.length)}
      />
      {/* <footer className="pb-4 pt-2 text-center text-[9px] uppercase tracking-[0.14em] opacity-40">
        from Vitura Studio · word list based on 12dicts by Alan Beale
      </footer> */}
    </main>
  );
}
