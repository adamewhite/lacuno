'use client';

import { useEffect, useState } from 'react';

import Board from './Board';
import classicData from './puzzles.json';
import vowelData from './puzzles-vowels.json';
import type { PuzzleData } from './usePuzzle';

/**
 * Two variants side by side for playtesting:
 *
 *   classic     — every letter scores; the pool is one undifferentiated set
 *   zero-vowels — A E I O U are worth 0 and sit in their own stack, but the
 *                 counts are still exact and every tile must be used
 *
 * Same rules otherwise. The zero-vowels variant exists to cut arithmetic: a
 * five-letter word may have only two or three numbers to add.
 */
const VARIANTS = [
  {
    key: 'classic' as const,
    label: 'classic',
    puzzles: classicData.puzzles as unknown as PuzzleData[],
    values: classicData.values as number[],
    blurb: 'every tile scores',
  },
  {
    key: 'zero-vowels' as const,
    label: 'vwldrp',
    puzzles: vowelData.puzzles as unknown as PuzzleData[],
    values: vowelData.values as number[],
    blurb: 'vowels are free — only consonants count',
  },
];

export default function Home() {
  const [variantIndex, setVariantIndex] = useState(0);
  const [index, setIndex] = useState(0);
  const [dictionary, setDictionary] = useState<ReadonlySet<string> | null>(null);

  // The dictionary ships as a static asset and is fetched once. It is the same
  // list the generator verified against, so a rack glowing here means the same
  // thing it meant at generation time (SPEC §5).
  useEffect(() => {
    let cancelled = false;
    fetch('/dictionary.txt')
      .then((res) => res.text())
      .then((text) => {
        if (cancelled) return;
        setDictionary(new Set(text.split('\n').filter(Boolean)));
      })
      .catch(() => {
        if (!cancelled) setDictionary(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const variant = VARIANTS[variantIndex];
  const puzzles = variant.puzzles;

  if (puzzles.length === 0) {
    return (
      <main className="p-8 font-mono text-sm">
        No puzzles. Run <code>npx tsx scripts/make-puzzles.ts</code> and{' '}
        <code>npx tsx scripts/make-variant-puzzles.ts</code>.
      </main>
    );
  }

  const safeIndex = index % puzzles.length;

  return (
    <main>
      <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 pt-6">
        {VARIANTS.map((v, i) => (
          <button
            key={v.key}
            onClick={() => {
              setVariantIndex(i);
              setIndex(0);
            }}
            className={[
              'rounded-full border px-3 py-1 font-mono text-xs transition-colors',
              i === variantIndex
                ? 'border-stone-900 bg-stone-900 text-stone-50 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900'
                : 'border-stone-300 text-stone-500 hover:border-stone-500 dark:border-stone-700',
            ].join(' ')}
          >
            {v.label}
          </button>
        ))}
        <span className="ml-1 font-mono text-[11px] text-stone-400">{variant.blurb}</span>
      </div>

      <Board
        key={`${variant.key}-${puzzles[safeIndex].id}`}
        puzzle={puzzles[safeIndex]}
        values={variant.values}
        dictionary={dictionary}
        index={safeIndex}
        count={puzzles.length}
        onNext={() => setIndex((i) => (i + 1) % puzzles.length)}
      />

      <footer className="pb-10 text-center font-mono text-[10px] text-stone-400">
        from Vitura Studio · word list based on 12dicts by Alan Beale
      </footer>
    </main>
  );
}
