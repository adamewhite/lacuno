import { describe, expect, it } from 'vitest';

/**
 * The pointer-drag rules, extracted so they can be tested without a DOM.
 *
 * Bug this guards: the board used HTML5 drag-and-drop (`draggable`,
 * `onDragStart`, `onDrop`), which mobile browsers do not implement. On a phone
 * those handlers never fired, so the browser scrolled the page or selected text
 * instead. Pointer events work for touch and mouse alike.
 */

const DRAG_THRESHOLD = 8;

/** Whether movement from the origin counts as a drag rather than a tap. */
function isDrag(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_THRESHOLD;
}

/** Parse a `data-drop` key into an action. */
function parseTarget(target: string | null):
  | { kind: 'none' }
  | { kind: 'pool' }
  | { kind: 'slot'; rack: number; slot: number } {
  if (!target) return { kind: 'none' };
  if (target === 'pool') return { kind: 'pool' };
  // Number('') is 0, not NaN, so an empty part must be rejected before
  // converting — otherwise "1:" would silently resolve to slot 0.
  const parts = target.split(':');
  if (parts.length !== 2 || parts.some((p) => p === '')) return { kind: 'none' };
  const [rack, slot] = parts.map(Number);
  if (!Number.isInteger(rack) || !Number.isInteger(slot)) return { kind: 'none' };
  return { kind: 'slot', rack, slot };
}

describe('drag threshold', () => {
  it('treats a still pointer as a tap', () => {
    // Without this, every tap would register as a zero-distance drag and the
    // click handlers would never run.
    expect(isDrag(0, 0)).toBe(false);
  });

  it('treats small jitter as a tap', () => {
    // Fingers wobble; a few pixels must not become a drag.
    expect(isDrag(3, 2)).toBe(false);
    expect(isDrag(-4, 1)).toBe(false);
  });

  it('treats deliberate movement as a drag', () => {
    expect(isDrag(20, 0)).toBe(true);
    expect(isDrag(0, -30)).toBe(true);
  });

  it('measures diagonal distance, not per-axis', () => {
    // 6,6 is only 6px on each axis but 8.49px of actual travel.
    expect(isDrag(6, 6)).toBe(true);
    expect(isDrag(5, 5)).toBe(false);
  });
});

describe('drop target parsing', () => {
  it('reads a rack slot', () => {
    expect(parseTarget('2:3')).toEqual({ kind: 'slot', rack: 2, slot: 3 });
    expect(parseTarget('0:0')).toEqual({ kind: 'slot', rack: 0, slot: 0 });
  });

  it('reads the pool', () => {
    expect(parseTarget('pool')).toEqual({ kind: 'pool' });
  });

  it('treats a drop on nothing as a no-op', () => {
    // Dropping outside any target must leave the tile where it was, not
    // silently return it to the pool.
    expect(parseTarget(null)).toEqual({ kind: 'none' });
  });

  it('rejects a malformed key rather than guessing', () => {
    expect(parseTarget('rack-two')).toEqual({ kind: 'none' });
    expect(parseTarget('1:')).toEqual({ kind: 'none' });
  });
});
