import { describe, expect, it } from 'vitest';

import { classifyInflection, isInflection } from './inflection';

/**
 * A dictionary small enough to reason about. Includes both the stems and their
 * inflections, since the classifier's whole method is asking whether a stem is
 * itself a word.
 */
const DICT = new Set([
  // stems
  'CAT', 'DOG', 'BAG', 'BAN', 'RUN', 'BAKE', 'HOPE', 'BABY', 'TRY', 'BOX',
  'DISH', 'WALK', 'SEE', 'CARRY',
  // inflections of the above
  'CATS', 'DOGS', 'BAGGED', 'BANNED', 'RUNNING', 'BAKED', 'BAKING', 'HOPES',
  'BABIED', 'TRIES', 'BOXES', 'DISHES', 'WALKED', 'WALKS', 'WALKING',
  'SEEING', 'CARRIED',
  // words that merely END in S/ED/ING without being inflections
  'CHESS', 'ACCESS', 'AEGIS', 'ATLAS', 'ALIAS', 'SACRED', 'NAKED', 'THING',
  'STRING', 'BED', 'RED',
]);

describe('classifyInflection', () => {
  it('detects a bare -S plural', () => {
    expect(classifyInflection('CATS', DICT)).toEqual({ kind: 'plural-s', stem: 'CAT' });
  });

  it('detects an -ES plural via the shorter stem', () => {
    // BOXE is not a word, so the -ES rule must fire rather than bare -S.
    expect(classifyInflection('BOXES', DICT)).toEqual({ kind: 'plural-es', stem: 'BOX' });
    expect(classifyInflection('DISHES', DICT)).toEqual({ kind: 'plural-es', stem: 'DISH' });
  });

  it('detects -ED and -ING with a silent E restored', () => {
    expect(classifyInflection('BAKED', DICT)).toEqual({ kind: 'past-ed', stem: 'BAKE' });
    expect(classifyInflection('BAKING', DICT)).toEqual({ kind: 'gerund-ing', stem: 'BAKE' });
  });

  it('detects a doubled final consonant', () => {
    // The case a naive stem test misses: neither BAGGE nor BAGG is a word.
    expect(classifyInflection('BAGGED', DICT)).toEqual({ kind: 'past-ed', stem: 'BAG' });
    expect(classifyInflection('BANNED', DICT)).toEqual({ kind: 'past-ed', stem: 'BAN' });
    expect(classifyInflection('RUNNING', DICT)).toEqual({ kind: 'gerund-ing', stem: 'RUN' });
  });

  it('detects a Y -> I spelling change', () => {
    expect(classifyInflection('BABIED', DICT)).toEqual({ kind: 'past-ed', stem: 'BABY' });
    expect(classifyInflection('CARRIED', DICT)).toEqual({ kind: 'past-ed', stem: 'CARRY' });
    expect(classifyInflection('TRIES', DICT)).toEqual({ kind: 'plural-es', stem: 'TRY' });
  });

  it('keeps words that merely end in S', () => {
    // The false-positive class: 17,168 such words in enable2k. Discarding
    // AEGIS as a "plural" would be a visible quality bug.
    for (const word of ['CHESS', 'ACCESS', 'AEGIS', 'ATLAS', 'ALIAS']) {
      expect(classifyInflection(word, DICT), word).toBeNull();
    }
  });

  it('keeps words that merely end in ED or ING', () => {
    for (const word of ['SACRED', 'NAKED', 'THING', 'STRING', 'BED', 'RED']) {
      expect(classifyInflection(word, DICT), word).toBeNull();
    }
  });

  it('keeps an inflection whose stem is absent from the dictionary', () => {
    // The dictionary is the arbiter: no stem, no ban.
    expect(classifyInflection('ZORPS', DICT)).toBeNull();
  });

  it('does not treat a word as its own stem', () => {
    expect(classifyInflection('SEE', DICT)).toBeNull();
    expect(classifyInflection('BED', DICT)).toBeNull();
  });

  it('prefers the longer suffix rule when both could match', () => {
    // WALKS could read as bare -S (WALK). WALKING must read as -ING, not -S.
    expect(classifyInflection('WALKS', DICT)).toEqual({ kind: 'plural-s', stem: 'WALK' });
    expect(classifyInflection('WALKING', DICT)).toEqual({ kind: 'gerund-ing', stem: 'WALK' });
  });

  it('ignores words too short to have a stem', () => {
    expect(classifyInflection('AS', DICT)).toBeNull();
    expect(classifyInflection('IS', DICT)).toBeNull();
  });

  it('does not accept a stem shorter than three letters', () => {
    // Regression: found against real data, where the spelling-change rules
    // mined a Scrabble dictionary's obscure short entries for junk stems —
    // GAS -> GAE, WAS -> WAE, THIS -> THY, THING -> THE. Real inflections all
    // have 3+ letter stems, so the floor costs nothing.
    const noisy = new Set(['GAS', 'GAE', 'WAS', 'WAE', 'THIS', 'THY', 'THE', 'HAS', 'HA']);
    for (const word of ['GAS', 'WAS', 'THIS', 'HAS']) {
      expect(classifyInflection(word, noisy), word).toBeNull();
    }
  });

  it('keeps lexicalized forms that merely look derived', () => {
    // WICK, RUG, MORN and CEIL are all real words and the derivations are
    // historically true, but these are their own lexical items now. Rules
    // cannot see this, so an exception list carries them.
    const dict = new Set([
      'WICK', 'WICKED', 'RUG', 'RUGGED', 'MORN', 'MORNING', 'CEIL', 'CEILING',
      'NEW', 'NEWS', 'BLESS', 'BLESSED',
    ]);
    for (const word of ['WICKED', 'RUGGED', 'MORNING', 'CEILING', 'NEWS', 'BLESSED']) {
      expect(classifyInflection(word, dict), word).toBeNull();
    }
  });

  it('isInflection agrees with classifyInflection', () => {
    expect(isInflection('CATS', DICT)).toBe(true);
    expect(isInflection('AEGIS', DICT)).toBe(false);
  });
});
