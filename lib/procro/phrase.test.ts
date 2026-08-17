import { describe, expect, it } from 'vitest';

import {
  buildPhrasePuzzle,
  DEFAULT_CATEGORY,
  isPhraseSolved,
  normalizePhrase,
  parsePhraseLine,
  phraseHints,
} from './phrase';
import { FLAT_3 } from '../valuation/consonant-schemes';

const V = FLAT_3;

describe('normalizePhrase', () => {
  it('uppercases and collapses whitespace', () => {
    expect(normalizePhrase('  cold   feet  ')).toBe('COLD FEET');
  });

  it('strips punctuation', () => {
    expect(normalizePhrase("don't count your chickens")).toBe('DONT COUNT YOUR CHICKENS');
    expect(normalizePhrase('cut to the chase!')).toBe('CUT TO THE CHASE');
  });

  it('skips blanks and comments', () => {
    expect(normalizePhrase('')).toBeNull();
    expect(normalizePhrase('   ')).toBeNull();
    expect(normalizePhrase('# a comment')).toBeNull();
  });

  it('rejects a line with no letters', () => {
    expect(normalizePhrase('123 !!!')).toBeNull();
  });
});

describe('parsePhraseLine', () => {
  it('reads a category prefix', () => {
    expect(parsePhraseLine('Idiom | Cold feet')).toEqual({
      phrase: 'COLD FEET',
      category: 'Idiom',
    });
  });

  it('defaults to Phrase when no category is given', () => {
    // A bare list of phrases still works.
    expect(parsePhraseLine('Cold feet')).toEqual({
      phrase: 'COLD FEET',
      category: DEFAULT_CATEGORY,
    });
  });

  it('title-cases whatever the curator typed', () => {
    expect(parsePhraseLine('IDIOM | cold feet')?.category).toBe('Idiom');
    expect(parsePhraseLine('idiom | cold feet')?.category).toBe('Idiom');
    expect(parsePhraseLine('famous people | marie curie')?.category).toBe('Famous People');
  });

  it('tolerates spacing around the bar', () => {
    expect(parsePhraseLine('Idiom|Cold feet')?.phrase).toBe('COLD FEET');
    expect(parsePhraseLine('  Idiom   |   Cold feet  ')?.phrase).toBe('COLD FEET');
  });

  it('falls back to Phrase when the category is empty', () => {
    expect(parsePhraseLine('| Cold feet')?.category).toBe(DEFAULT_CATEGORY);
  });

  it('skips comments and blanks', () => {
    expect(parsePhraseLine('# Idiom | Cold feet')).toBeNull();
    expect(parsePhraseLine('   ')).toBeNull();
  });

  it('rejects a line whose phrase is empty', () => {
    expect(parsePhraseLine('Idiom |')).toBeNull();
    expect(parsePhraseLine('Idiom | 123')).toBeNull();
  });
});

describe('buildPhrasePuzzle', () => {
  it('carries the category, defaulting to Phrase', () => {
    expect(buildPhrasePuzzle('COLD FEET', V, 'p1', 'Idiom').category).toBe('Idiom');
    expect(buildPhrasePuzzle('COLD FEET', V, 'p1').category).toBe(DEFAULT_CATEGORY);
  });

  it('makes one rack per word, in reading order', () => {
    const puzzle = buildPhrasePuzzle('COLD FEET', V, 'p1');
    expect(puzzle.racks.map((r) => r.length)).toEqual([4, 4]);
  });

  it('pools only consonants — vowels are unlimited, not tiles', () => {
    const puzzle = buildPhrasePuzzle('COLD FEET', V, 'p1');
    // COLD FEET has consonants C L D F T; O and E E are free.
    expect(puzzle.consonants).toEqual(['C', 'D', 'F', 'L', 'T']);
  });

  it('targets the consonant total, since vowels score zero', () => {
    const puzzle = buildPhrasePuzzle('COLD FEET', V, 'p1');
    const [cold, feet] = puzzle.racks;
    // C3 O0 L2 D2 = 7; F5 E0 E0 T1 = 6
    expect(cold.target).toBe(7);
    expect(feet.target).toBe(6);
  });

  it('gives an all-vowel word a target of zero', () => {
    // A rack showing 0 is a strong tell that it holds no consonants.
    const puzzle = buildPhrasePuzzle('ONCE IN A BLUE MOON', V, 'p1');
    expect(puzzle.racks[2].target).toBe(0);
    expect(puzzle.racks[2].length).toBe(1);
  });

  it('records which slots hold vowels', () => {
    const puzzle = buildPhrasePuzzle('COLD FEET', V, 'p1');
    expect(puzzle.racks[0].vowelSlots).toEqual([1]); // c-O-l-d
    expect(puzzle.racks[1].vowelSlots).toEqual([1, 2]); // f-E-E-t
  });

  it('offers all five vowels regardless of the phrase', () => {
    // Narrowing the piles to the vowels in play would tell the player which
    // ones are absent — a strong hint. The piles stay uniform.
    const all = ['A', 'E', 'I', 'O', 'U'];
    expect(buildPhrasePuzzle('COLD FEET', V, 'p1').vowels).toEqual(all);
    expect(buildPhrasePuzzle('BREAK THE ICE', V, 'p1').vowels).toEqual(all);
    // Even a phrase with no vowels at all offers the full set.
    expect(buildPhrasePuzzle('MY GYM', V, 'p1').vowels).toEqual(all);
  });

  it('counts letters without the spaces', () => {
    expect(buildPhrasePuzzle('COLD FEET', V, 'p1').letterCount).toBe(8);
  });

  it('handles a repeated consonant as separate tiles', () => {
    // Scarcity is per tile: two Ts means two placements are possible.
    const puzzle = buildPhrasePuzzle('TIT FOR TAT', V, 'p1');
    expect(puzzle.consonants.filter((c) => c === 'T')).toHaveLength(4);
  });
});

describe('isPhraseSolved', () => {
  const puzzle = buildPhrasePuzzle('COLD FEET', V, 'p1');

  it('accepts the phrase', () => {
    expect(isPhraseSolved(['COLD', 'FEET'], puzzle)).toBe(true);
  });

  it('rejects a rearrangement of the same letters', () => {
    // Unlike the word game, where any anagram at the right total wins, a phrase
    // has one intended reading.
    expect(isPhraseSolved(['CLOD', 'FEET'], puzzle)).toBe(false);
  });

  it('rejects the right words in the wrong order', () => {
    expect(isPhraseSolved(['FEET', 'COLD'], puzzle)).toBe(false);
  });

  it('rejects an incomplete board', () => {
    expect(isPhraseSolved(['COLD', ''], puzzle)).toBe(false);
  });
});

describe('phraseHints', () => {
  const puzzle = buildPhrasePuzzle('BREAK THE ICE', V, 'p1');
  const hints = phraseHints(puzzle);

  it('offers a hint for every letter', () => {
    expect(hints).toHaveLength('BREAKTHEICE'.length);
  });

  it('names the letter the phrase actually has there', () => {
    const words = puzzle.phrase.split(' ');
    for (const hint of hints) {
      expect(words[hint.rackIndex][hint.slot]).toBe(hint.letter);
    }
  });

  it('reveals consonants before vowels', () => {
    // A consonant is a scarce tile the player must place anyway, so revealing
    // one both narrows the word and removes a placement decision.
    const firstVowel = hints.findIndex((h) => 'AEIOU'.includes(h.letter));
    const lastConsonant = hints.map((h) => 'AEIOU'.includes(h.letter)).lastIndexOf(false);
    expect(firstVowel).toBeGreaterThan(lastConsonant);
  });

  it('prefers longer words first', () => {
    // BREAK (5) should be mined before THE (3).
    const words = puzzle.phrase.split(' ');
    const firstLen = words[hints[0].rackIndex].length;
    expect(firstLen).toBe(5);
  });

  it('never repeats a slot', () => {
    const keys = hints.map((h) => `${h.rackIndex}:${h.slot}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
