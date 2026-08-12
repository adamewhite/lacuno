import { describe, expect, it } from 'vitest';

import {
  anagramFamily,
  anagramKey,
  applyPins,
  bestPinForRack,
  buildAnagramIndex,
  choosePins,
  countPinnableRacks,
  groupByAnagram,
  hasSingleSolutionGroup,
  isPinnable,
  meetsPinnableFloor,
  pinsAreConsistent,
  requiredPinnableRacks,
} from './pins';
import type { Rack } from './types';

/** MONTH has no anagram; the STARE family has six. */
const DICT = [
  'MONTH', 'GLOW', 'MUD',
  'STARE', 'RATES', 'TEARS', 'ASTER', 'TARES', 'TASER',
  'STONE', 'ONSET', 'TONES',
  'CHAIR', 'CHAIRS',
];
const INDEX = buildAnagramIndex(DICT);

describe('anagramKey', () => {
  it('is shared by anagrams and only by anagrams', () => {
    expect(anagramKey('STARE')).toBe(anagramKey('RATES'));
    expect(anagramKey('STARE')).not.toBe(anagramKey('MONTH'));
  });
});

describe('isPinnable', () => {
  it('is true for a word with no anagram', () => {
    expect(isPinnable('MONTH', INDEX)).toBe(true);
    expect(isPinnable('GLOW', INDEX)).toBe(true);
  });

  it('is false for a word in an anagram family', () => {
    // Pinning STARE would imply RATES is wrong. It is not.
    expect(isPinnable('STARE', INDEX)).toBe(false);
    expect(isPinnable('STONE', INDEX)).toBe(false);
  });

  it('finds the whole family', () => {
    expect(anagramFamily('STARE', INDEX).sort()).toEqual(
      ['ASTER', 'RATES', 'STARE', 'TARES', 'TASER', 'TEARS'],
    );
  });
});

describe('groupByAnagram', () => {
  it('treats within-rack rearrangements as one solution', () => {
    // The player made the same deduction about how tiles split across racks.
    const groups = groupByAnagram([
      ['STARE', 'GLOW'],
      ['RATES', 'GLOW'],
      ['TEARS', 'GLOW'],
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('separates genuinely different tile partitions', () => {
    const groups = groupByAnagram([
      ['STONE', 'CHAIR', 'MUD'],
      ['ADORE', 'CHITS', 'MUN'],
    ]);

    expect(groups).toHaveLength(2);
  });

  it('distinguishes the same words placed in different racks', () => {
    // Same words, swapped between racks: a different assignment, so different.
    const groups = groupByAnagram([
      ['GLOW', 'MONTH'],
      ['MONTH', 'GLOW'],
    ]);

    expect(groups).toHaveLength(2);
  });

  it('returns nothing for no solutions', () => {
    expect(groupByAnagram([])).toEqual([]);
  });
});

describe('hasSingleSolutionGroup', () => {
  it('publishes a board whose only ambiguity is an anagram', () => {
    expect(hasSingleSolutionGroup([['STARE', 'GLOW'], ['RATES', 'GLOW']])).toBe(true);
  });

  it('rejects a board with two ways to split the tiles', () => {
    // Different letters per rack, not a rearrangement — a real second answer.
    expect(hasSingleSolutionGroup([['STONE', 'MUD'], ['MOUND', 'SET']])).toBe(false);
  });

  it('accepts anagram rearrangement in more than one rack at once', () => {
    // Both racks rearranged, but the tile split is identical — still one group.
    expect(hasSingleSolutionGroup([['STARE', 'STONE'], ['RATES', 'ONSET']])).toBe(true);
  });

  it('rejects an unsolvable board', () => {
    expect(hasSingleSolutionGroup([])).toBe(false);
  });
});

describe('requiredPinnableRacks', () => {
  it('needs half for even counts and more than half for odd', () => {
    expect(requiredPinnableRacks(2)).toBe(1);
    expect(requiredPinnableRacks(3)).toBe(2);
    expect(requiredPinnableRacks(4)).toBe(2);
    expect(requiredPinnableRacks(5)).toBe(3);
  });
});

describe('meetsPinnableFloor', () => {
  it('accepts a two-rack board with one clean rack', () => {
    expect(countPinnableRacks(['STARE', 'MONTH'], INDEX)).toBe(1);
    expect(meetsPinnableFloor(['STARE', 'MONTH'], INDEX)).toBe(true);
  });

  it('rejects a three-rack board with only one clean rack', () => {
    // ceil(3/2) = 2 required, only MONTH qualifies.
    expect(meetsPinnableFloor(['STARE', 'STONE', 'MONTH'], INDEX)).toBe(false);
  });

  it('accepts a three-rack board with two clean racks', () => {
    expect(meetsPinnableFloor(['STARE', 'GLOW', 'MONTH'], INDEX)).toBe(true);
  });

  it('rejects a board with no clean rack at all', () => {
    expect(meetsPinnableFloor(['STARE', 'STONE'], INDEX)).toBe(false);
  });
});

describe('bestPinForRack', () => {
  // IMPORTANT: `candidates` is the set of words that ALREADY satisfy the rack's
  // length AND target. The target does most of the discriminating work — under
  // the real valuation CARD=10 and WARD=14, so they never compete for the same
  // rack and no pin is needed to separate them. A pin only has to split the
  // words that survive the target, which are necessarily same-total words.
  it('picks the slot that eliminates the most candidates', () => {
    // Four same-total candidates; slot 3 isolates CARD, slot 0 leaves three.
    const candidates = ['CARD', 'CARL', 'CARP', 'HARD'];
    const pin = bestPinForRack('CARD', candidates, 0);

    // Slot 3 (D) leaves CARD and HARD; slot 0 (C) would leave three.
    expect(pin).toEqual({
      rackIndex: 0,
      slot: 3,
      letter: 'D',
      remaining: 2,
      before: 4,
    });
  });

  it('prefers the slot that narrows furthest', () => {
    // Slot 3 leaves only CARD; slot 0 would leave three.
    const pin = bestPinForRack('CARD', ['CARD', 'CARL', 'CARP'], 0);

    expect(pin?.slot).toBe(3);
    expect(pin?.remaining).toBe(1);
  });

  it('ignores slots shared by every candidate', () => {
    // C, A and R are common to all three, so only slot 3 can narrow.
    const pin = bestPinForRack('CARD', ['CARD', 'CARL', 'CARP'], 0);

    expect(pin?.slot).toBe(3);
  });

  it('returns null when a pin cannot help', () => {
    expect(bestPinForRack('MONTH', ['MONTH'], 0)).toBeNull();
    expect(bestPinForRack('MONTH', [], 0)).toBeNull();
  });

  it('returns null when every slot is common to all candidates', () => {
    // Identical candidates cannot be told apart by any pin.
    expect(bestPinForRack('CARD', ['CARD', 'CARD'], 0)).toBeNull();
  });

  it('breaks ties toward the earlier slot', () => {
    // Slots 0 and 3 both isolate one candidate; the earlier reads better.
    const pin = bestPinForRack('BAT', ['BAT', 'CAT', 'BAG'], 0);
    expect(pin?.slot).toBe(0);
  });
});

describe('choosePins', () => {
  it('only pins racks with no anagram', () => {
    // STARE is ambiguous by design, so it never carries a pin.
    const pins = choosePins(
      ['STARE', 'MONTH'],
      [['STARE', 'RATES'], ['MONTH', 'MOUTH']],
      INDEX,
    );

    expect(pins).toHaveLength(1);
    expect(pins[0].rackIndex).toBe(1);
    expect(pins[0].letter).toBe('N');
  });

  it('ranks the most discriminating pin first', () => {
    const pins = choosePins(
      ['MONTH', 'GLOW'],
      [
        ['MONTH', 'MOUTH', 'MIRTH'],
        ['GLOW', 'GLOB'],
      ],
      INDEX,
    );

    expect(pins.length).toBeGreaterThan(1);
    expect(pins[0].remaining).toBeLessThanOrEqual(pins[1].remaining);
  });

  it('returns nothing when no rack is pinnable', () => {
    expect(choosePins(['STARE', 'STONE'], [['STARE'], ['STONE']], INDEX)).toEqual([]);
  });
});

describe('applyPins', () => {
  const racks: Rack[] = [
    { length: 5, target: 10 },
    { length: 5, target: 12 },
  ];

  it('attaches pins to the right rack and leaves others alone', () => {
    const pinned = applyPins(racks, [
      { rackIndex: 1, slot: 0, letter: 'M', remaining: 1, before: 3 },
    ]);

    expect(pinned[0].pins).toBeUndefined();
    expect(pinned[1].pins).toEqual({ 0: 'M' });
  });

  it('does not mutate the original racks', () => {
    applyPins(racks, [{ rackIndex: 0, slot: 0, letter: 'S', remaining: 1, before: 2 }]);
    expect(racks[0].pins).toBeUndefined();
  });
});

describe('pinsAreConsistent', () => {
  const tiles = [...'MONTHGLOW'];

  it('accepts pins whose letters are in the pool', () => {
    const racks: Rack[] = [
      { length: 5, target: 10, pins: { 0: 'M' } },
      { length: 4, target: 8, pins: { 0: 'G' } },
    ];

    expect(pinsAreConsistent(tiles, racks)).toBe(true);
  });

  it('rejects a pin naming a letter the pool lacks', () => {
    const racks: Rack[] = [{ length: 5, target: 10, pins: { 0: 'Z' } }];
    expect(pinsAreConsistent(tiles, racks)).toBe(false);
  });

  it('rejects a slot outside the rack', () => {
    const racks: Rack[] = [{ length: 5, target: 10, pins: { 9: 'M' } }];
    expect(pinsAreConsistent(tiles, racks)).toBe(false);
  });

  it('accounts for tiles consumed by earlier pins', () => {
    // Only one M in the pool, but two racks pin one each.
    const racks: Rack[] = [
      { length: 5, target: 10, pins: { 0: 'M' } },
      { length: 4, target: 8, pins: { 0: 'M' } },
    ];

    expect(pinsAreConsistent(tiles, racks)).toBe(false);
  });
});
