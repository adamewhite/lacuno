'use client';

import Link from 'next/link';

import { DIFFICULTY_META, type Difficulty } from '../lib/lacuno/difficulty';

/**
 * The opening screen: the wordmark, what the day holds, and Begin.
 *
 * The board is concealed until Begin because the clock starts there — nobody
 * should be reading the racks while their time runs. It sits over the board
 * rather than being a route of its own, so beginning does not navigate.
 */
export default function Opening({
  onBegin,
  difficulty,
  rounds,
  dateLabel,
}: {
  onBegin: () => void;
  difficulty: Difficulty;
  /** How many rounds the game holds, named on the screen. */
  rounds: number;
  /** The day being played, when it is a dated game. */
  dateLabel?: string | null;
}) {
  return (
    <div className="board-enter flex h-full flex-col items-center justify-center gap-7 px-7 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1
          className="text-[34px] font-bold uppercase leading-none sm:text-[44px]"
          style={{ letterSpacing: '0.06em', color: 'var(--frame-text)' }}
        >
          Lacuno
        </h1>
        <p
          className="text-[11px] font-semibold uppercase sm:text-[13px]"
          style={{ letterSpacing: '0.18em', opacity: 0.65, color: 'var(--frame-text)' }}
        >
          Fill the gaps in the phrase
        </p>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        {dateLabel && (
          <p
            className="text-[12px] font-semibold uppercase sm:text-[14px]"
            style={{ letterSpacing: '0.16em', color: 'var(--frame-text)' }}
          >
            {dateLabel}
          </p>
        )}
        <p
          className="text-[11px] font-semibold uppercase sm:text-[13px]"
          style={{ letterSpacing: '0.14em', opacity: 0.65, color: 'var(--frame-text)' }}
        >
          {rounds} rounds · {DIFFICULTY_META[difficulty].label}
        </p>
      </div>

      <button
        onClick={onBegin}
        className="w-full max-w-[280px] rounded-md border-[1.5px] border-frame bg-frame px-6 py-3 text-[13px] font-bold uppercase text-frame-text transition-opacity hover:opacity-90 sm:py-4 sm:text-[16px]"
        style={{ letterSpacing: '0.12em' }}
      >
        Begin
      </button>

      <div className="flex flex-col items-center gap-2.5">
        <div className="flex gap-2">
          <Link
            href="/archive"
            className="rounded-md border-[1.5px] border-accent px-4 py-1.5 text-[11px] font-semibold uppercase text-accent-text transition-colors hover:bg-[rgba(217,155,127,0.16)] sm:text-[13px]"
            style={{ letterSpacing: '0.12em' }}
          >
            Archive
          </Link>
          <Link
            href="/how-to-play"
            className="rounded-md border-[1.5px] border-accent px-4 py-1.5 text-[11px] font-semibold uppercase text-accent-text transition-colors hover:bg-[rgba(217,155,127,0.16)] sm:text-[13px]"
            style={{ letterSpacing: '0.12em' }}
          >
            How to Play
          </Link>
        </div>

        {/* The level changes what the board gives away, so it is chosen before
            the clock starts rather than mid-game. */}
        <div className="flex flex-wrap justify-center gap-1.5">
          {Object.values(DIFFICULTY_META).map((meta) => {
            const current = meta.slug === difficulty;
            return (
              <Link
                key={meta.slug}
                href={`/${meta.slug}`}
                title={meta.blurb}
                className={[
                  'rounded px-2.5 py-1 text-[10px] font-semibold uppercase transition-colors sm:text-[11px]',
                  current
                    ? 'bg-frame text-frame-text'
                    : 'text-accent-text hover:bg-[rgba(217,155,127,0.16)]',
                ].join(' ')}
                style={{ letterSpacing: '0.1em' }}
              >
                {meta.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
