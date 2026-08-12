/**
 * Dictionary ingest. See SPEC §5.
 *
 * ONE dictionary, used identically by the client validator and the generator's
 * uniqueness check:
 *
 *   base (2of12inf) + delta -> merged list -> hash
 *
 * A word outside this dictionary cannot form an alternate solution, because the
 * game itself will not accept it. The dictionary defines what a solution IS.
 *
 * Also ingests a frequency list, used only to rank the merged dictionary into
 * the tiered solution vocabulary — never to decide what counts as a word.
 */

import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

/** A solution-vocabulary candidate with its corpus frequency data. */
export interface RankedWord {
  readonly word: string;
  /** Raw occurrence count in the Google Web Trillion Word Corpus. */
  readonly count: number;
  /** 1-based position in the frequency list; 1 is the most common word. */
  readonly rank: number;
}

/** Read a file that may or may not be gzipped, by magic number. */
function readMaybeGzip(path: string): string {
  const raw = readFileSync(path);
  const isGzip = raw.length > 1 && raw[0] === 0x1f && raw[1] === 0x8b;
  return (isGzip ? gunzipSync(raw) : raw).toString('utf8');
}

/**
 * Normalize a raw list entry: strip whitespace and 12dicts markup, uppercase.
 *
 * 2of12inf annotates some entries:
 *   `word%`  plural of an "uncountable" noun (ABANDONMENTS)
 *   `word!`  entry the compiler considers dubious (ABDUCTEE)
 * Both are real words a player may reasonably try, so the markers are stripped
 * and the words kept. Removing any of them is the delta file's job, not the
 * parser's.
 *
 * Returns null for anything not purely alphabetic once cleaned.
 */
export function normalizeWord(raw: string): string | null {
  const word = raw.trim().replace(/[%!]+$/, '').trim().toUpperCase();
  if (word.length === 0) return null;
  for (let i = 0; i < word.length; i++) {
    const code = word.charCodeAt(i);
    if (code < 65 || code > 90) return null;
  }
  return word;
}

/** Parse a plain word list — one word per line, comments and blanks skipped. */
export function loadWordList(path: string): Set<string> {
  const words = new Set<string>();
  for (const line of readMaybeGzip(path).split('\n')) {
    if (line.startsWith('#')) continue;
    const word = normalizeWord(line);
    if (word) words.add(word);
  }
  return words;
}

export interface Delta {
  readonly additions: ReadonlySet<string>;
  readonly removals: ReadonlySet<string>;
}

/**
 * Parse the curated delta file: `+word` adds, `-word` removes, `#` comments.
 *
 * Throws if a word appears as both an addition and a removal — that is a
 * contradiction in curation, and silently resolving it would hide the mistake.
 */
export function loadDelta(path: string): Delta {
  const additions = new Set<string>();
  const removals = new Set<string>();

  for (const rawLine of readMaybeGzip(path).split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) continue;

    const sign = line[0];
    if (sign !== '+' && sign !== '-') {
      throw new Error(`Delta entries must start with + or -, got: ${JSON.stringify(line)}`);
    }

    const word = normalizeWord(line.slice(1));
    if (!word) {
      throw new Error(`Delta entry is not a valid word: ${JSON.stringify(line)}`);
    }

    (sign === '+' ? additions : removals).add(word);
  }

  for (const word of additions) {
    if (removals.has(word)) {
      throw new Error(`Delta both adds and removes ${word}`);
    }
  }

  return { additions, removals };
}

/**
 * Apply the delta to the base list, producing the single dictionary that both
 * the client validator and the generator use.
 */
export function applyDelta(base: ReadonlySet<string>, delta: Delta): Set<string> {
  const merged = new Set(base);
  for (const word of delta.additions) merged.add(word);
  for (const word of delta.removals) merged.delete(word);
  return merged;
}

/**
 * Load the complete dictionary: base list plus curated delta.
 */
export function loadDictionary(basePath: string, deltaPath?: string): Set<string> {
  const base = loadWordList(basePath);
  if (!deltaPath) return base;
  return applyDelta(base, loadDelta(deltaPath));
}

/**
 * Parse the frequency list — `word<space>count` lines, already ordered
 * most-frequent-first.
 *
 * Used ONLY to rank words for difficulty tiering. It never decides whether
 * something is a word; the dictionary does that.
 */
export function loadFrequencyList(path: string): RankedWord[] {
  const ranked: RankedWord[] = [];
  const seen = new Set<string>();

  for (const line of readMaybeGzip(path).split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    const space = trimmed.indexOf(' ');
    const word = normalizeWord(space === -1 ? trimmed : trimmed.slice(0, space));
    if (!word || seen.has(word)) continue;

    const count = space === -1 ? 0 : Number.parseInt(trimmed.slice(space + 1), 10);
    seen.add(word);
    ranked.push({ word, count: Number.isFinite(count) ? count : 0, rank: ranked.length + 1 });
  }

  return ranked;
}
