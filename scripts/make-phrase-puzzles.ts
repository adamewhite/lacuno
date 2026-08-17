/**
 * Build phrase puzzles from data/phrases.txt.
 *
 *   npx tsx scripts/make-phrase-puzzles.ts
 *
 * Writes app/puzzles-phrases.json. There is no search and no uniqueness gate —
 * every curated phrase becomes a puzzle. Quality comes from the phrase list,
 * not from the generator.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildPhrasePuzzle,
  parsePhraseLine,
  phraseHints,
} from '../lib/procro/phrase';
import { FLAT_3 } from '../lib/valuation/consonant-schemes';

const ROOT = join(import.meta.dirname, '..');
const VALUES = FLAT_3;

const lines = readFileSync(join(ROOT, 'data', 'phrases.txt'), 'utf8').split('\n');
const phrases = lines
  .map(parsePhraseLine)
  .filter((p): p is NonNullable<typeof p> => p !== null);

if (phrases.length === 0) {
  console.error('No phrases found in data/phrases.txt');
  process.exit(1);
}

const seen = new Set<string>();
const puzzles = [];

/**
 * Longest word a rack may hold.
 *
 * Rack tiles shrink to keep a word on one line, and past ten letters they get
 * too small to read on a phone. A word broken across rows stops reading as a
 * word, so the limit is on the content rather than the layout.
 */
const MAX_WORD_LENGTH = 10;

for (const { phrase, category } of phrases) {
  if (seen.has(phrase)) {
    console.warn(`  skipping duplicate: ${phrase}`);
    continue;
  }
  seen.add(phrase);

  const tooLong = phrase.split(' ').find((w) => w.length > MAX_WORD_LENGTH);
  if (tooLong) {
    console.warn(
      `  skipping "${phrase}": ${tooLong} is ${tooLong.length} letters, over the ${MAX_WORD_LENGTH} limit`,
    );
    continue;
  }

  const puzzle = buildPhrasePuzzle(phrase, VALUES, `f${puzzles.length + 1}`, category);

  puzzles.push({
    id: puzzle.id,
    category: puzzle.category,
    racks: puzzle.racks.map((r) => ({ length: r.length, target: r.target })),
    consonants: puzzle.consonants,
    vowels: puzzle.vowels,
    letterCount: puzzle.letterCount,
    // Hints are precomputed so the client never needs the phrase to serve one.
    hints: phraseHints(puzzle),
    // Playtesting only. A shipped puzzle must not carry its answer in the
    // client payload (SPEC §7).
    phrase: puzzle.phrase,
  });
}

writeFileSync(
  join(ROOT, 'app', 'puzzles-phrases.json'),
  JSON.stringify({ variant: 'phrase', values: [...VALUES], puzzles }, null, 2) + '\n',
);

console.log(`Wrote ${puzzles.length} phrase puzzles to app/puzzles-phrases.json\n`);
console.log('category'.padEnd(10) + 'phrase'.padEnd(30) + 'racks'.padStart(6) + 'cons'.padStart(6) + '  targets');
console.log('-'.repeat(72));
for (const p of puzzles) {
  console.log(
    p.category.padEnd(10) +
      p.phrase.padEnd(30) +
      String(p.racks.length).padStart(6) +
      String(p.consonants.length).padStart(6) +
      '  ' + p.racks.map((r) => r.target).join(' '),
  );
}
