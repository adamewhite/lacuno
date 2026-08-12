/**
 * Re-measure tile valuation schemes under the CURRENT rules. SPEC §4, §11.3.
 *
 *   npx tsx scripts/remeasure-values.ts [trials]
 *
 * Everything measured before this used positional multipliers, which have since
 * been cut. Without them a word's score depends only on its letters, so tile
 * values now carry the entire discriminating burden — and anagrams cannot be
 * separated at all. The publish gate is correspondingly "one solution UP TO
 * ANAGRAMS" plus the pinnable floor.
 *
 * Two metrics per scheme:
 *   publish%   — boards passing every gate (the number that matters)
 *   arithmetic — median 5-letter rack total, and how many tiles a player must
 *                actually add (zero-valued tiles are free)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { scoreWord } from '../lib/procro/letters';
import {
  buildAnagramIndex,
  groupByAnagram,
  meetsPinnableFloor,
} from '../lib/procro/pins';
import { solve } from '../lib/procro/solve';
import type { LetterValues, Rack } from '../lib/procro/types';
import { CANDIDATES } from '../lib/valuation/schemes';

const ROOT = join(import.meta.dirname, '..');
const GENERATED = join(ROOT, 'data', 'generated');
const TRIALS = Number.parseInt(process.argv[2] ?? '400', 10);

const dictionary = readFileSync(join(GENERATED, 'dictionary.txt'), 'utf8')
  .split('\n')
  .filter((w) => w.length >= 3 && w.length <= 8);

const solutionsFile = JSON.parse(readFileSync(join(GENERATED, 'solutions.json'), 'utf8'));
const vocabulary: string[] = solutionsFile.words
  .filter((w: { tier: string }) => w.tier === 'common' || w.tier === 'familiar')
  .map((w: { word: string }) => w.word);

const anagramIndex = buildAnagramIndex(dictionary);

const byLength = new Map<number, string[]>();
for (const word of vocabulary) {
  const list = byLength.get(word.length);
  if (list) list.push(word);
  else byLength.set(word.length, [word]);
}

function makeRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const SHAPES = [[5, 4], [5, 4, 3], [6, 5], [6, 4, 3], [4, 4, 3]];

interface Result {
  readonly publish: number;
  readonly failedFloor: number;
  readonly failedUnique: number;
  readonly medianTotal: number;
  readonly maxTotal: number;
  readonly tilesToAdd: number;
}

function measure(values: LetterValues): Result {
  const random = makeRandom(20260812);
  let publish = 0;
  let failedFloor = 0;
  let failedUnique = 0;

  for (let t = 0; t < TRIALS; t++) {
    const shape = SHAPES[t % SHAPES.length];
    const words = shape.map((len) => {
      const pool = byLength.get(len)!;
      return pool[Math.floor(random() * pool.length)];
    });

    if (!meetsPinnableFloor(words, anagramIndex)) {
      failedFloor++;
      continue;
    }

    const racks: Rack[] = words.map((w) => ({
      length: w.length,
      target: scoreWord(w, values),
    }));
    const solutions = solve(words.join('').split(''), racks, dictionary, values);

    if (solutions.length === 0 || groupByAnagram(solutions).length !== 1) {
      failedUnique++;
      continue;
    }
    publish++;
  }

  // Arithmetic load, over five-letter words.
  const five = vocabulary.filter((w) => w.length === 5);
  const totals = five.map((w) => scoreWord(w, values)).sort((a, b) => a - b);
  const nonZero = five.map((w) => [...w].filter((c) => values[c.charCodeAt(0) - 65] !== 0).length);

  return {
    publish: (publish / TRIALS) * 100,
    failedFloor: (failedFloor / TRIALS) * 100,
    failedUnique: (failedUnique / TRIALS) * 100,
    medianTotal: totals[Math.floor(totals.length / 2)],
    maxTotal: totals[totals.length - 1],
    tilesToAdd: nonZero.reduce((a, b) => a + b, 0) / nonZero.length,
  };
}

console.log('Re-measured WITHOUT multipliers — pins are the only positional constraint.');
console.log(`dictionary ${dictionary.length.toLocaleString()} | vocabulary ${vocabulary.length.toLocaleString()} | ${TRIALS} boards per scheme\n`);

console.log(
  'scheme'.padEnd(22) + 'publish%'.padStart(10) + 'med5'.padStart(7) +
  'max5'.padStart(7) + 'add/5'.padStart(8) + '   failed: floor / not-unique',
);
console.log('-'.repeat(84));

const rows = CANDIDATES.map(({ name, values }) => ({ name, ...measure(values) }));
for (const r of rows) {
  console.log(
    r.name.padEnd(22) +
      r.publish.toFixed(1).padStart(10) +
      String(r.medianTotal).padStart(7) +
      String(r.maxTotal).padStart(7) +
      r.tilesToAdd.toFixed(1).padStart(8) +
      `   ${r.failedFloor.toFixed(0)}% / ${r.failedUnique.toFixed(0)}%`,
  );
}

console.log('\npublish% = passes the pinnable floor AND has one solution up to anagrams');
console.log('med5/max5 = median and maximum 5-letter rack total');
console.log('add/5    = tiles a player must actually add per 5-letter rack (0-value tiles are free)');
console.log('\nThe pinnable floor is scheme-independent, so that failure column should be');
console.log('identical across rows — a useful sanity check on the harness.');
