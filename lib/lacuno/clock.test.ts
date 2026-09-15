import { describe, expect, it } from 'vitest';

import {
  chargeHint,
  elapsedMs,
  formatClock,
  formatTileClock,
  HINT_PENALTY_MS,
  idleClock,
  pause,
  resume,
  startedClock,
} from './clock';

const T0 = 1_000_000;

describe('elapsedMs', () => {
  it('counts from the start while running', () => {
    expect(elapsedMs(startedClock(T0), T0 + 5_000)).toBe(5_000);
  });

  it('is zero at the moment of starting', () => {
    expect(elapsedMs(startedClock(T0), T0)).toBe(0);
  });

  it('counts nothing on an idle clock', () => {
    expect(elapsedMs(idleClock(), T0 + 10_000)).toBe(0);
  });

  it('never goes backwards if the clock jumps', () => {
    // A system clock correction must not produce a negative time.
    expect(elapsedMs(startedClock(T0), T0 - 5_000)).toBe(0);
  });
});

describe('pause / resume', () => {
  it('banks the running time on pause', () => {
    const paused = pause(startedClock(T0), T0 + 7_000);
    expect(paused.startedAt).toBeNull();
    expect(paused.bankedMs).toBe(7_000);
  });

  it('accumulates nothing while paused', () => {
    const paused = pause(startedClock(T0), T0 + 7_000);
    expect(elapsedMs(paused, T0 + 60_000)).toBe(7_000);
  });

  it('keeps counting from the banked total on resume', () => {
    const paused = pause(startedClock(T0), T0 + 7_000);
    const running = resume(paused, T0 + 60_000);
    expect(elapsedMs(running, T0 + 63_000)).toBe(10_000);
  });

  it('is a no-op to pause a stopped clock', () => {
    const paused = pause(startedClock(T0), T0 + 1_000);
    expect(pause(paused, T0 + 99_000)).toEqual(paused);
  });

  it('is a no-op to resume a running clock', () => {
    const running = startedClock(T0);
    expect(resume(running, T0 + 5_000)).toEqual(running);
  });

  it('survives several pause/resume cycles', () => {
    let c = startedClock(0);
    c = pause(c, 1_000); // banked 1s
    c = resume(c, 10_000);
    c = pause(c, 12_000); // banked 3s
    c = resume(c, 20_000);
    expect(elapsedMs(c, 24_000)).toBe(7_000);
  });
});

describe('chargeHint', () => {
  it('adds the penalty straight to the bank', () => {
    expect(chargeHint(idleClock()).bankedMs).toBe(HINT_PENALTY_MS);
  });

  it('charges 30 seconds by default', () => {
    expect(HINT_PENALTY_MS).toBe(30_000);
  });

  it('shows up immediately in the running total', () => {
    const c = chargeHint(startedClock(T0));
    expect(elapsedMs(c, T0 + 1_000)).toBe(HINT_PENALTY_MS + 1_000);
  });

  it('keeps the clock running', () => {
    expect(chargeHint(startedClock(T0)).startedAt).toBe(T0);
  });

  it('stacks across hints', () => {
    let c = idleClock();
    c = chargeHint(c);
    c = chargeHint(c);
    c = chargeHint(c);
    expect(c.bankedMs).toBe(3 * HINT_PENALTY_MS);
  });
});

describe('formatClock', () => {
  it('formats under a minute', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(5_000)).toBe('0:05');
    expect(formatClock(59_000)).toBe('0:59');
  });

  it('formats minutes and seconds', () => {
    expect(formatClock(60_000)).toBe('1:00');
    expect(formatClock(125_000)).toBe('2:05');
  });

  it('grows to hours rather than lying about minutes', () => {
    // 3_905_000ms is 1h 5m 5s — "65:05" would be ambiguous at a glance.
    expect(formatClock(3_905_000)).toBe('1:05:05');
  });

  it('floors partial seconds', () => {
    expect(formatClock(1_999)).toBe('0:01');
  });

  it('clamps a negative time', () => {
    expect(formatClock(-5_000)).toBe('0:00');
  });
});

describe('formatTileClock', () => {
  it('shows seconds under a minute', () => {
    expect(formatTileClock(45_000)).toBe('45s');
  });

  it('shows whole minutes above one', () => {
    expect(formatTileClock(60_000)).toBe('1m');
    expect(formatTileClock(599_000)).toBe('9m');
  });

  it('caps at 99m+ so the tile always fits', () => {
    expect(formatTileClock(100 * 60_000)).toBe('99m+');
  });
});
