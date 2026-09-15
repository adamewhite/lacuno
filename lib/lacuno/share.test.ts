import { describe, expect, it, vi } from 'vitest';

import {
  copyToClipboard,
  shareMessage,
  sharePath,
  shareText,
  shareUrl,
  SITE_URL,
  systemShare,
} from './share';

const solved = { dateKey: '2026-09-15', solved: 3, rounds: 3, timeMs: 252_000 };

describe('shareMessage', () => {
  it('boasts a time for a fully solved game', () => {
    expect(shareMessage(solved)).toBe('LACUNO 2026-09-15\nSolved in 4:12');
  });

  it('reports the count when rounds were given up on', () => {
    // "Solved in 4:12" would be a lie here.
    expect(shareMessage({ ...solved, solved: 1 })).toBe(
      'LACUNO 2026-09-15\n1/3 rounds in 4:12',
    );
  });

  it('does not claim a solve when nothing was solved', () => {
    const text = shareMessage({ ...solved, solved: 0 });
    expect(text).toContain('0/3 rounds');
    expect(text).not.toContain('Solved');
  });

  it('formats a sub-minute time', () => {
    expect(shareMessage({ ...solved, timeMs: 45_000 })).toContain('Solved in 0:45');
  });

  it('formats a time past an hour', () => {
    expect(shareMessage({ ...solved, timeMs: 3_905_000 })).toContain('Solved in 1:05:05');
  });

  it('never claims a solve on a zero-round record', () => {
    expect(shareMessage({ ...solved, solved: 0, rounds: 0 })).toContain('0/0');
  });
});

describe('sharePath / shareUrl', () => {
  it('links to the day that was played', () => {
    expect(sharePath('2026-09-15')).toBe('/archive/2026-09-15');
    expect(shareUrl('2026-09-15')).toBe(`${SITE_URL}/archive/2026-09-15`);
  });

  it('points at the deployed site', () => {
    expect(SITE_URL).toBe('https://lacuno.vercel.app');
  });

  it('has no trailing slash to double up on the path', () => {
    expect(SITE_URL.endsWith('/')).toBe(false);
  });
});

describe('shareText', () => {
  it('puts the link after the message', () => {
    expect(shareText(solved)).toBe(
      `LACUNO 2026-09-15\nSolved in 4:12\n\n${SITE_URL}/archive/2026-09-15`,
    );
  });
});

describe('systemShare', () => {
  it('reports false when the API is missing', () => {
    vi.stubGlobal('navigator', {});
    expect(systemShare('x')).toBe(false);
  });

  it('reports true and calls share when available', () => {
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { share });
    expect(systemShare('hello')).toBe(true);
    expect(share).toHaveBeenCalledWith({ text: 'hello' });
  });

  it('does not throw when the sheet rejects', () => {
    // Cancelling the sheet rejects; that must not surface as an error.
    vi.stubGlobal('navigator', { share: () => Promise.reject(new Error('cancelled')) });
    expect(() => systemShare('x')).not.toThrow();
  });
});

describe('copyToClipboard', () => {
  it('reports true on success', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyToClipboard('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('reports false when the clipboard is missing', async () => {
    vi.stubGlobal('navigator', {});
    expect(await copyToClipboard('x')).toBe(false);
  });

  it('reports false when writing is denied', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: () => Promise.reject(new Error('denied')) },
    });
    expect(await copyToClipboard('x')).toBe(false);
  });
});
