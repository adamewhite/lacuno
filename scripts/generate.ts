/**
 * Generate candidate puzzles and print them. SPEC §11.5 — print candidates to
 * the terminal and PLAY ONE ON PAPER before building any UI.
 *
 *   npx tsx scripts/generate.ts [count] [--seed N] [--shape 5,4,3]
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { generatePuzzle, seededRandom, type Puzzle } from '../lib/procro/generate';
import { anagramFamily, buildAnagramIndex } from '../lib/procro/pins';
import { TILE_VALUES } from '../lib/procro/values';

const ROOT = join(import.meta.dirname, '..');
const GENERATED = join(ROOT, 'data', 'generated');

const args = process.argv.slice(2);
const count = Number.parseInt(args[0] ?? '5', 10);
const seedArg = args.indexOf('--seed');
const seed = seedArg >= 0 ? Number.parseInt(args[seedArg + 1], 10) : 20260812;
const shapeArg = args.indexOf('--shape');
const shapes: number[][] = shapeArg >= 0
  ? [args[shapeArg + 1].split(',').map(Number)]
  : [[5, 4], [5, 4, 3], [6, 4, 3], [6, 5], [4, 4, 3]];

const dictionary = readFileSync(join(GENERATED, 'dictionary.txt'), 'utf8')
  .split('\n')
  .filter((w) => w.length >= 3 && w.length <= 8);

const solutionsFile = JSON.parse(readFileSync(join(GENERATED, 'solutions.json'), 'utf8'));
// Restrict to the two most common tiers: a daily puzzle should use words people
// actually know. Rarer tiers are for later difficulty ramping (SPEC §5).
const vocabulary: string[] = solutionsFile.words
  .filter((w: { tier: string }) => w.tier === 'common' || w.tier === 'familiar')
  .map((w: { word: string }) => w.word);

console.log(`dictionary: ${dictionary.length.toLocaleString()} words`);
console.log(`vocabulary: ${vocabulary.length.toLocaleString()} words (common + familiar tiers)`);
console.log(`dictVersion: ${solutionsFile.dictVersion}`);
console.log(`seed: ${seed}\n`);

const anagramIndex = buildAnagramIndex(dictionary);
const random = seededRandom(seed);
const values = TILE_VALUES;

const letterLine = (word: string) =>
  [...word].map((c) => `${c}${TILE_VALUES[c.charCodeAt(0) - 65]}`).join(' ');

function show(puzzle: Puzzle, index: number): void {
  console.log('='.repeat(58));
  console.log(`PUZZLE ${index + 1}   ${puzzle.racks.map((r) => r.length).join('+')} tiles=${puzzle.tiles.length}`);
  console.log('='.repeat(58));

  console.log('\n  TILES');
  console.log('    ' + puzzle.tiles.map((t) => `${t}${values[t.charCodeAt(0) - 65]}`).join('  '));

  console.log('\n  RACKS');
  puzzle.racks.forEach((rack, i) => {
    const slots = Array.from({ length: rack.length }, () => '__').join(' ');
    console.log(`    ${i + 1}.  ${slots}   = ${rack.target}`);
  });

  console.log('\n  HINTS (optional — the board is solvable without them)');
  if (puzzle.pins.length === 0) {
    console.log('    none available');
  } else {
    puzzle.pins.forEach((pin, i) => {
      console.log(
        `    ${i + 1}. rack ${pin.rackIndex + 1}, slot ${pin.slot + 1} = ${pin.letter}` +
          `   (narrows ${pin.before} -> ${pin.remaining})`,
      );
    });
  }

  console.log('\n  --- answer ---');
  puzzle.solution.forEach((word, i) => {
    const family = anagramFamily(word, anagramIndex);
    const alts = family.filter((w) => w !== word);
    console.log(
      `    rack ${i + 1}: ${word}  [${letterLine(word)}]` +
        (alts.length ? `   also accepts: ${alts.join(', ')}` : ''),
    );
  });
  console.log(
    `    ${puzzle.allSolutions.length} accepted arrangement(s), ` +
      `${puzzle.pinnableRacks}/${puzzle.racks.length} racks pinnable, ` +
      `search space ${puzzle.searchSpace.join('/')}`,
  );
  console.log();
}

let made = 0;
let tried = 0;
const started = Date.now();

for (let i = 0; made < count && i < count * 6; i++) {
  const shape = shapes[i % shapes.length];
  tried++;
  const puzzle = generatePuzzle({
    shape,
    vocabulary,
    dictionary,
    values,
    random,
    attempts: 400,
    enough: 30,
  });
  if (puzzle) {
    show(puzzle, made);
    made++;
  }
}

console.log(`Generated ${made} puzzle(s) from ${tried} shape attempt(s) in ${Date.now() - started}ms`);
