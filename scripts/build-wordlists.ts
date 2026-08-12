/**
 * Build the shipped dictionary and solution vocabulary. SPEC §5, §11.2.
 *
 *   npx tsx scripts/build-wordlists.ts [--ban-inflections] [--max-words N]
 *                                      [--min-length N] [--max-length N]
 *
 * Reads data/raw/2of12inf.txt + data/delta.txt, writes data/generated/.
 * Offline tooling — runs at generation time, never at runtime (SPEC §7).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildWordLists, TIER_NAMES, type BuildOptions } from '../lib/wordlist/build';
import { loadDelta, loadDictionary, loadFrequencyList, loadWordList } from '../lib/wordlist/ingest';

const ROOT = join(import.meta.dirname, '..');
const RAW = join(ROOT, 'data', 'raw');
const OUT = join(ROOT, 'data', 'generated');
const BASE_FILE = join(RAW, '2of12inf.txt');
const DELTA_FILE = join(ROOT, 'data', 'delta.txt');
const BLOCKLIST_FILE = join(ROOT, 'data', 'blocklist.txt');

function parseArgs(argv: string[]): BuildOptions {
  const options: Record<string, unknown> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const numeric = (): number => {
      const value = Number.parseInt(argv[++i], 10);
      if (!Number.isFinite(value)) throw new Error(`${arg} needs a number`);
      return value;
    };

    switch (arg) {
      case '--ban-inflections': options.banInflections = true; break;
      case '--max-words': options.maxWords = numeric(); break;
      case '--min-length': options.minLength = numeric(); break;
      case '--max-length': options.maxLength = numeric(); break;
      default: throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options as BuildOptions;
}

const options = parseArgs(process.argv.slice(2));

console.log('Reading sources...');
const base = loadWordList(BASE_FILE);
const delta = loadDelta(DELTA_FILE);
const dictionary = loadDictionary(BASE_FILE, DELTA_FILE);
const blocklist = loadWordList(BLOCKLIST_FILE);
const frequency = loadFrequencyList(join(RAW, 'freq.txt.gz'));

console.log(`  2of12inf base: ${base.size.toLocaleString()} words`);
console.log(`  delta:         +${delta.additions.size} / -${delta.removals.size}`);
console.log(`  dictionary:    ${dictionary.size.toLocaleString()} words`);
console.log(`  blocklist:     ${blocklist.size} words (barred as ANSWERS, still valid to spell)`);
console.log(`  freq (ranking only): ${frequency.length.toLocaleString()} words`);

const { dictionary: words, solutions, dictVersion, stats } = buildWordLists(
  dictionary,
  frequency,
  { ...options, blocklist },
);

mkdirSync(OUT, { recursive: true });

// The dictionary ships client-side for real-time glow checks and is the same
// list the generator verifies against. Newline-delimited rather than JSON —
// smaller, and compresses better.
writeFileSync(join(OUT, 'dictionary.txt'), words.join('\n') + '\n');

writeFileSync(
  join(OUT, 'solutions.json'),
  JSON.stringify(
    {
      dictVersion,
      builtWith: {
        banInflections: options.banInflections ?? false,
        minLength: options.minLength ?? 3,
        maxLength: options.maxLength ?? 8,
        maxWords: options.maxWords ?? null,
      },
      words: solutions,
    },
    null,
    2,
  ) + '\n',
);

const pct = (n: number) => `${((n / frequency.length) * 100).toFixed(1)}%`;

console.log(`\nDictionary: ${stats.dictionaryCount.toLocaleString()} words`);
console.log(`  dictVersion: ${dictVersion}`);

console.log(`\nSolution vocabulary: ${stats.solutionCount.toLocaleString()} words`);
console.log('  dropped:');
console.log(`    not in dictionary: ${stats.dropped.notInDictionary.toLocaleString()} (${pct(stats.dropped.notInDictionary)})`);
console.log(`    length:            ${stats.dropped.length.toLocaleString()} (${pct(stats.dropped.length)})`);
console.log(`    blocklisted:       ${stats.dropped.blocked.toLocaleString()} (${pct(stats.dropped.blocked)})`);
console.log(`    inflection:        ${stats.dropped.inflection.toLocaleString()} (${pct(stats.dropped.inflection)})`);
console.log(`    over cap:          ${stats.dropped.overCap.toLocaleString()} (${pct(stats.dropped.overCap)})`);

console.log(`\n  inflections found: ${stats.inflectionsFound.toLocaleString()}` +
  (options.banInflections ? ' (banned)' : ' (kept — ban is off)'));

console.log('\n  by tier:');
for (const tier of TIER_NAMES) {
  console.log(`    ${tier.padEnd(9)} ${stats.byTier[tier].toLocaleString()}`);
}

console.log('\n  by length:');
for (const length of Object.keys(stats.byLength).map(Number).sort((a, b) => a - b)) {
  console.log(`    ${String(length).padStart(2)}  ${stats.byLength[length].toLocaleString()}`);
}

console.log(`\nWrote ${join('data', 'generated')}/{dictionary.txt, solutions.json}`);
