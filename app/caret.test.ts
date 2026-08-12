import { describe, expect, it } from 'vitest';

/**
 * The caret rules, extracted so they can be tested without React.
 *
 * Bug this guards: typing used to always fill a rack's FIRST free slot, so
 * clicking slot 3 and typing put the letter in slot 1. The caret is now an
 * explicit insertion point, exactly like a text field.
 */

/** Where a typed letter lands, given a caret. Mirrors usePuzzle.typeLetter. */
function targetSlot(
  caret: number,
  rackLength: number,
  pinned: readonly boolean[],
  filled: readonly boolean[],
): number {
  const caretUsable = caret >= 0 && caret < rackLength && !pinned[caret];
  if (caretUsable) return caret;
  // Fall forward to the first writable slot.
  for (let slot = 0; slot < rackLength; slot++) {
    if (!pinned[slot] && !filled[slot]) return slot;
  }
  return -1;
}

/**
 * Move the caret one step, wrapping and skipping pinned slots. Mirrors
 * Board.stepCaret — used for typing, backspace, and the arrow keys alike.
 */
function stepCaret(
  from: number,
  rackLength: number,
  pinned: readonly boolean[],
  direction: 1 | -1,
): number {
  let slot = from;
  for (let step = 0; step < rackLength; step++) {
    slot = (slot + direction + rackLength) % rackLength;
    if (!pinned[slot]) return slot;
  }
  return from;
}

const advance = (caret: number, rackLength: number, pinned: readonly boolean[]) =>
  stepCaret(caret, rackLength, pinned, 1);

const none = (n: number) => new Array(n).fill(false);

describe('typing caret', () => {
  it('fills the slot the player clicked, not the first one', () => {
    // The reported bug: caret at 3 must write to 3.
    expect(targetSlot(3, 5, none(5), none(5))).toBe(3);
    expect(targetSlot(0, 5, none(5), none(5))).toBe(0);
    expect(targetSlot(4, 5, none(5), none(5))).toBe(4);
  });

  it('overwrites a filled slot the caret points at', () => {
    // Clicking into the middle of a word and typing replaces that letter,
    // matching how a text field behaves.
    const filled = [true, true, true, false, false];
    expect(targetSlot(1, 5, none(5), filled)).toBe(1);
  });

  it('falls forward when the caret sits on a pinned slot', () => {
    const pinned = [false, true, false, false, false];
    const filled = [false, true, false, false, false];
    expect(targetSlot(1, 5, pinned, filled)).toBe(0);
  });

  it('falls forward when the caret is out of range', () => {
    expect(targetSlot(9, 5, none(5), none(5))).toBe(0);
    expect(targetSlot(-1, 5, none(5), none(5))).toBe(0);
  });

  it('returns -1 when the rack has nowhere to write', () => {
    const filled = [true, true, true];
    const pinned = [true, true, true];
    expect(targetSlot(-1, 3, pinned, filled)).toBe(-1);
  });

  it('advances one slot after typing', () => {
    expect(advance(0, 5, none(5))).toBe(1);
    expect(advance(2, 5, none(5))).toBe(3);
  });

  it('skips pinned slots when advancing', () => {
    // Typing into slot 0 with slot 1 pinned should land the caret on slot 2.
    const pinned = [false, true, false, false, false];
    expect(advance(0, 5, pinned)).toBe(2);
  });

  it('skips a run of pinned slots', () => {
    const pinned = [false, true, true, false, false];
    expect(advance(0, 5, pinned)).toBe(3);
  });

  it('wraps to the start after the last slot', () => {
    expect(advance(4, 5, none(5))).toBe(0);
    expect(advance(3, 4, none(4))).toBe(0);
  });
});

describe('caret wraparound', () => {
  it('wraps backwards from the first slot to the last', () => {
    // Backspacing at slot 0 continues from the end, so holding backspace
    // clears a rack instead of sticking at the start.
    expect(stepCaret(0, 5, none(5), -1)).toBe(4);
    expect(stepCaret(0, 3, none(3), -1)).toBe(2);
  });

  it('wraps forwards from the last slot to the first', () => {
    expect(stepCaret(4, 5, none(5), 1)).toBe(0);
  });

  it('steps normally away from the edges', () => {
    expect(stepCaret(2, 5, none(5), 1)).toBe(3);
    expect(stepCaret(2, 5, none(5), -1)).toBe(1);
  });

  it('skips pinned slots while wrapping', () => {
    // Slot 4 pinned: wrapping backwards from 0 lands on 3, not 4.
    const pinned = [false, false, false, false, true];
    expect(stepCaret(0, 5, pinned, -1)).toBe(3);
  });

  it('skips a pinned slot 0 when wrapping forwards', () => {
    const pinned = [true, false, false];
    expect(stepCaret(2, 3, pinned, 1)).toBe(1);
  });

  it('stays put when every slot is pinned', () => {
    // Guards against an infinite loop on a fully pinned rack.
    const pinned = [true, true, true];
    expect(stepCaret(1, 3, pinned, 1)).toBe(1);
    expect(stepCaret(1, 3, pinned, -1)).toBe(1);
  });
});
