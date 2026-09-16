'use client';

import Link from 'next/link';

import { DIFFICULTY_META, DIFFICULTIES, type Difficulty } from '../lib/lacuno/difficulty';

/**
 * The opening screen.
 *
 * Framed like the board — the same bordered shell and clay header band — so
 * the landing page reads as the game's own front door rather than a separate
 * site that happens to link to it. Inside the frame the structure follows
 * OROBORO's welcome screen: one centred card, and a hierarchy that steps down
 * as the eye travels (what the game is, what today holds, the one choice worth
 * making, then the actions).
 *
 * The header assembles in stages the way ZUMMA's does: wordmark, then nav,
 * then the rule wiping in beneath. Timings live in globals.css.
 *
 * The board stays concealed until Begin because the clock starts there — the
 * racks are readable the moment they are on screen.
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
    // The same shell the board wears: full-bleed frame, centred contents.
    <div
      className="mx-auto flex h-full w-full min-w-[320px] flex-col overflow-hidden border-[5px] border-frame bg-shell sm:border-[8px]"
      style={{ boxSizing: 'border-box' }}
    >
      {/* Header band, matching the board's — wordmark left, nav right. */}
      <div className="shrink-0">
        <div className="relative mx-1.5 mt-1.5 flex shrink-0 items-center justify-between gap-3 bg-frame px-5 pb-2.5 pt-2.5 text-frame-text sm:mx-2 sm:mt-2 sm:px-7 sm:pb-4 sm:pt-4">
          <div
            className="wordmark-in font-tile text-[28px] font-normal leading-[1.1] sm:text-[38px]"
            style={{ letterSpacing: '0.05em' }}
          >
            LACUNO
          </div>

          {/* On the landing page the nav is the two destinations themselves,
              rather than a hamburger hiding them — there is no board here for
              a menu to avoid covering. */}
          <div className="nav-slide-in flex gap-1.5">
            <Link
              href="/how-to-play"
              className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase transition-colors hover:bg-[rgba(242,211,192,0.18)] sm:text-[12px]"
              style={{ letterSpacing: '0.12em' }}
            >
              Rules
            </Link>
            <Link
              href="/archive"
              className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase transition-colors hover:bg-[rgba(242,211,192,0.18)] sm:text-[12px]"
              style={{ letterSpacing: '0.12em' }}
            >
              Archive
            </Link>
          </div>
        </div>

        {/* The rule under the header, wiping in from the left. In the accent
            rather than the frame clay, which would be invisible against the
            band directly above it. */}
        <div
          className="rule-wipe-in mx-1.5 h-[2px] sm:mx-2"
          style={{ background: 'var(--accent)' }}
        />
      </div>

      {/* Scrollable, so a short viewport can reach Begin rather than clipping
          it — the body is fixed and cannot scroll, but this can. */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-7">
        <div className="panel-rise w-full text-center" style={{ maxWidth: 400 }}>
          <p
            className="text-[17px] leading-snug sm:text-[20px]"
            style={{ color: 'var(--tile-face)' }}
          >
            Fill the gaps in the phrase.
          </p>

          {/* What today holds. */}
          <div className="mt-6">
            {dateLabel && (
              <p
                className="text-[11px] font-semibold uppercase sm:text-[12px]"
                style={{
                  letterSpacing: '0.16em',
                  opacity: 0.6,
                  color: 'var(--frame-text)',
                }}
              >
                {dateLabel}
              </p>
            )}
            <p
              className="mt-1 text-[20px] font-semibold sm:text-[24px]"
              style={{ color: 'var(--frame-text)' }}
            >
              {rounds} rounds, each one longer
            </p>
          </div>

          {/* The one choice worth making before the clock starts. A labelled
              group rather than loose chips, so it reads as a control. */}
          <div className="mt-7">
            <p
              className="text-[10px] font-semibold uppercase sm:text-[11px]"
              style={{
                letterSpacing: '0.16em',
                opacity: 0.55,
                color: 'var(--frame-text)',
              }}
            >
              Difficulty
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              {DIFFICULTIES.map((slug) => {
                const meta = DIFFICULTY_META[slug];
                const current = slug === difficulty;
                return (
                  <Link
                    key={slug}
                    href={`/${slug}`}
                    aria-current={current ? 'true' : undefined}
                    className={[
                      'rounded-md border-[1.5px] px-2 py-2 text-[11px] font-semibold uppercase transition-colors sm:text-[12px]',
                      current ? '' : 'hover:bg-[rgba(217,155,127,0.14)]',
                    ].join(' ')}
                    style={{
                      letterSpacing: '0.1em',
                      borderColor: current ? 'var(--frame)' : 'rgba(217, 155, 127, 0.3)',
                      background: current ? 'var(--frame)' : 'transparent',
                      // Light on the clay fill rather than the yellow: yellow
                      // on clay is muddy, and the yellow is spoken for by
                      // Begin, which should be the only thing wearing it.
                      color: current ? 'var(--tile-face-hand)' : 'var(--accent-text)',
                    }}
                  >
                    {meta.label}
                  </Link>
                );
              })}
            </div>
            <p
              className="mt-2.5 text-[11px] leading-snug sm:text-[12px]"
              style={{ opacity: 0.6, color: 'var(--tile-face)' }}
            >
              {DIFFICULTY_META[difficulty].blurb}.
            </p>
          </div>

          {/* One obvious thing to press. */}
          <button
            onClick={onBegin}
            className="mt-8 w-full rounded-md px-6 py-3.5 text-[15px] font-bold uppercase transition-opacity hover:opacity-90 sm:text-[17px]"
            style={{
              letterSpacing: '0.12em',
              background: 'var(--frame-text)',
              color: 'var(--page)',
            }}
          >
            Begin
          </button>
        </div>
      </div>
    </div>
  );
}
