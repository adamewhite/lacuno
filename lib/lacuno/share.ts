/**
 * Share text for a finished day.
 *
 * Deliberately terse: the date, how it went, and a link to that exact puzzle.
 * The link carries the date, so whoever reads the post plays what the poster
 * played rather than whatever today happens to be.
 *
 * Hint penalties are already inside the time, so the text does not itemise
 * them — but it never calls a game "solved" that was not, since a time earned
 * by giving up is not a result.
 */

import { formatClock } from './clock';

/** Where shared links point. Also used for metadataBase in app/layout. */
export const SITE_URL = 'https://lacuno.vercel.app';

export interface ShareResult {
  readonly dateKey: string;
  readonly solved: number;
  readonly rounds: number;
  readonly timeMs: number;
}

/** The path that replays this exact day. */
export const sharePath = (dateKey: string): string => `/archive/${dateKey}`;

export const shareUrl = (dateKey: string): string => `${SITE_URL}${sharePath(dateKey)}`;

/**
 * The message as it will post, without the link — callers append that so the
 * clipboard copy and the social intents can differ in how they carry it.
 *
 * A fully solved game boasts a time. Anything less reports what actually
 * happened: "1/3 rounds in 4:12" is honest where "Solved in 4:12" would not
 * be.
 */
export function shareMessage(result: ShareResult): string {
  const time = formatClock(result.timeMs);
  const headline =
    result.rounds > 0 && result.solved >= result.rounds
      ? `Solved in ${time}`
      : `${result.solved}/${result.rounds} rounds in ${time}`;
  return `LACUNO ${result.dateKey}\n${headline}`;
}

/** The full share text: the message, a blank line, then the link. */
export const shareText = (result: ShareResult): string =>
  `${shareMessage(result)}\n\n${shareUrl(result.dateKey)}`;

/**
 * Share through the system sheet where the Web Share API exists — phones,
 * mostly — reporting whether it took the request. Cancelling the sheet still
 * counts as shared: the player saw it and chose not to.
 */
export function systemShare(text: string): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  navigator.share({ text }).catch(() => {});
  return true;
}

/** Copy to the clipboard, reporting success rather than throwing. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Denied permission or an insecure context: the button says so instead of
    // the page breaking.
    return false;
  }
}
