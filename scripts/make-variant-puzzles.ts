/**
 * Generate ZERO_VOWELS puzzles for playtesting.
 *
 *   npx tsx scripts/make-variant-puzzles.ts [count] [--seed N]
 *
 * Writes app/puzzles-vowels.json. Vowels score 0 but are still a finite pool
 * with exact counts, shown as a separate stack above the consonants.
 *
 * Because the counts are exact this is structurally the classic game with a
 * different valuation and a split display — so it reuses the same solver and
 * the same publish gate.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { scoreWord } from '../lib/procro/letters';
import { seededRandom } from '../lib/procro/generate';
import {
  bestPinForRack,
  buildAnagramIndex,
  groupByAnagram,
  meetsPinnableFloor,
  type PinChoice,
} from '../lib/procro/pins';
import { solve } from '../lib/procro/solve';
import type { Rack } from '../lib/procro/types';
import { consonantsOf, vowelsOf } from '../lib/procro/variant';
import { FLAT_3 } from '../lib/valuation/consonant-schemes';

const ROOT = join(import.meta.dirname, '..');
const GENERATED = join(ROOT, 'data', 'generated');

const args = process.argv.slice(2);
const count = Number.parseInt(args[0] ?? '10', 10);
const seedArg = args.indexOf('--seed');
const seed = seedArg >= 0 ? Number.parseInt(args[seedArg + 1], 10) : 20260812;

const VALUES = FLAT_3;

const dictionary = readFileSync(join(GENERATED, 'dictionary.txt'), 'utf8')
  .split('\n')
  .filter((w) => w.length >= 3 && w.length <= 8);

const solutionsFile = JSON.parse(readFileSync(join(GENERATED, 'solutions.json'), 'utf8'));
/**
 * Short words need a stricter bar than the tier alone provides.
 *
 * The `common` tier is web-corpus frequency, which floats up plenty of
 * 3-letter noise — REM, MUS, BIS, RAD, HEP, DEB — that reads as obscure in a
 * puzzle even though it ranks well. A 3-letter answer is also the most visible
 * word on the board, so it carries the most risk. Requiring a much better rank
 * for the shortest words trims the tail without touching longer vocabulary.
 */
const MAX_RANK_BY_LENGTH: Record<number, number> = { 3: 1500, 4: 4000 };

const vocabulary: string[] = solutionsFile.words
  .filter((w: { tier: string; word: string; rank: number }) => {
    if (w.tier !== 'common') return false;
    const cap = MAX_RANK_BY_LENGTH[w.word.length];
    return cap === undefined || w.rank <= cap;
  })
  .map((w: { word: string }) => w.word);

const byLength = new Map<number, string[]>();
for (const word of vocabulary) {
  const list = byLength.get(word.length);
  if (list) list.push(word);
  else byLength.set(word.length, [word]);
}

const SHAPES = [[5, 4, 3], [6, 4, 3], [4, 4, 3], [5, 5, 3], [6, 5, 4], [5, 4, 4]];

/**
 * A rack with no consonants would have a target of 0 and carry no information,
 * so require at least two scoring letters per word.
 */
const MIN_CONSONANTS = 2;

const anagramIndex = buildAnagramIndex(dictionary);

const random = seededRandom(seed);
const puzzles: unknown[] = [];

for (let attempt = 0; puzzles.length < count && attempt < 200_000; attempt++) {
  const shape = SHAPES[attempt % SHAPES.length];
  const words = shape.map((len) => {
    const pool = byLength.get(len)!;
    return pool[Math.floor(random() * pool.length)];
  });

  const racks: Rack[] = words.map((w) => ({
    length: w.length,
    target: scoreWord(w, VALUES),
  }));
  // Every letter is a tile; the split is for display only.
  const tiles = words.join('').split('');


  // No repeated words, and no word contained in a sibling: YOURS/RIGID/YOU is
  // legal but reads as a generator bug rather than a puzzle.
  const unique = new Set(words);
  if (unique.size !== words.length) continue;
  if (words.some((a) => words.some((b) => a !== b && b.includes(a)))) continue;
  if (words.some((w) => consonantsOf(w).length < MIN_CONSONANTS)) continue;
  if (!meetsPinnableFloor(words, anagramIndex)) continue;

  const solutions = solve(tiles, racks, dictionary, VALUES);
  if (solutions.length === 0) continue;
  if (groupByAnagram(solutions).length !== 1) continue;

  // Hints: the most discriminating slot per rack, measured against the words
  // that actually satisfy that rack.
  const candidatesByRack = racks.map((rack) =>
    dictionary.filter(
      (w) => w.length === rack.length && scoreWord(w, VALUES) === rack.target,
    ),
  );
  const pins: PinChoice[] = [];
  words.forEach((word, rackIndex) => {
    const pin = bestPinForRack(word, candidatesByRack[rackIndex] ?? [word], rackIndex);
    if (pin) pins.push(pin);
  });
  pins.sort((a, b) => a.remaining - b.remaining || b.before - a.before);

  puzzles.push({
    id: `v${puzzles.length + 1}`,
    variant: 'zero-vowels',
    tiles: [...tiles].sort(),
    // Split for display: vowels sit in their own stack above the consonants.
    vowels: words.flatMap((w) => vowelsOf(w)).sort(),
    consonants: words.flatMap((w) => consonantsOf(w)).sort(),
    racks: racks.map((r) => ({ length: r.length, target: r.target })),
    pins: pins.map((p) => ({ rackIndex: p.rackIndex, slot: p.slot, letter: p.letter })),
    solution: words,
    acceptedCount: solutions.length,
    searchSpace: candidatesByRack.map((c) => c.length),
  });
}

writeFileSync(
  join(ROOT, 'app', 'puzzles-vowels.json'),
  JSON.stringify(
    {
      dictVersion: solutionsFile.dictVersion,
      variant: 'zero-vowels',
      values: [...VALUES],
      generatedWith: { seed, tier: 'common', scheme: 'FLAT_3' },
      puzzles,
    },
    null,
    2,
  ) + '\n',
);

console.log(`Wrote ${puzzles.length} zero-vowels puzzles to app/puzzles-vowels.json`);
for (const p of puzzles as { id: string; solution: string[]; acceptedCount: number; vowels: string[] }[]) {
  console.log(
    `  ${p.id}: ${p.solution.join(' ')}  vowels[${p.vowels.join('')}]  (${p.acceptedCount} accepted)`,
  );
}
