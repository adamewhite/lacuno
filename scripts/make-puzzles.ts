/**
 * Generate puzzles and write them to a JSON file the app can load.
 *
 *   npx tsx scripts/make-puzzles.ts [count] [--seed N]
 *
 * Writes app/puzzles.json. Offline tooling — the app only ever reads the
 * output, never runs the generator (SPEC §7).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generatePuzzle, seededRandom } from '../lib/procro/generate';
import { TILE_VALUES } from '../lib/procro/values';

const ROOT = join(import.meta.dirname, '..');
const GENERATED = join(ROOT, 'data', 'generated');

const args = process.argv.slice(2);
const count = Number.parseInt(args[0] ?? '10', 10);
const seedArg = args.indexOf('--seed');
const seed = seedArg >= 0 ? Number.parseInt(args[seedArg + 1], 10) : 20260812;

const dictionary = readFileSync(join(GENERATED, 'dictionary.txt'), 'utf8')
  .split('\n')
  .filter((w) => w.length >= 3 && w.length <= 8);

const solutionsFile = JSON.parse(readFileSync(join(GENERATED, 'solutions.json'), 'utf8'));

// Restrict to the most common tier for playtesting: the answers should be words
// nobody has to look up. `familiar` produced CIAO and BAH, which are real but
// read oddly as a daily answer.
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

const SHAPES = [[5, 4, 3], [6, 4, 3], [4, 4, 3], [5, 5, 3], [6, 5, 4], [5, 4, 4]];

const random = seededRandom(seed);
const puzzles = [];

for (let i = 0; puzzles.length < count && i < count * 8; i++) {
  const puzzle = generatePuzzle({
    shape: SHAPES[i % SHAPES.length],
    vocabulary,
    dictionary,
    values: TILE_VALUES,
    random,
    attempts: 500,
    enough: 40,
  });

  if (!puzzle) continue;

  puzzles.push({
    id: `p${puzzles.length + 1}`,
    tiles: puzzle.tiles,
    racks: puzzle.racks.map((r) => ({ length: r.length, target: r.target })),
    // Hints, most useful first. The board is solvable without them.
    pins: puzzle.pins.map((p) => ({
      rackIndex: p.rackIndex,
      slot: p.slot,
      letter: p.letter,
    })),
    // Included for playtesting only — a shipped puzzle must NOT carry its
    // answer in the client payload (SPEC §7, anti-cheat).
    solution: puzzle.solution,
    searchSpace: puzzle.searchSpace,
  });
}

const payload = {
  dictVersion: solutionsFile.dictVersion,
  values: [...TILE_VALUES],
  generatedWith: { seed, tier: 'common' },
  puzzles,
};

writeFileSync(join(ROOT, 'app', 'puzzles.json'), JSON.stringify(payload, null, 2) + '\n');

console.log(`Wrote ${puzzles.length} puzzles to app/puzzles.json`);
for (const p of puzzles) {
  console.log(
    `  ${p.id}: ${p.racks.map((r) => r.length).join('+')} -> ${p.solution.join(' ')}`,
  );
}
