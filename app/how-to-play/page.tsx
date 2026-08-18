import Link from 'next/link';

import { TILE_VALUES } from '../../lib/lacuno/letter-values';

/**
 * How to play.
 *
 * Built from the same tokens and tile shapes as the board rather than from
 * screenshots, so it cannot drift out of sync with the real thing. Deliberately
 * short: four steps, mostly pictures.
 */

const value = (letter: string) => TILE_VALUES[letter.charCodeAt(0) - 65];

/** A filled tile, matching the board's. */
function Tile({ letter, muted = false }: { letter: string; muted?: boolean }) {
  const points = value(letter);
  return (
    <span
      className="relative inline-block h-[46px] w-[40px] rounded align-middle"
      style={{
        background: muted ? 'var(--tile-face-hand)' : 'var(--tile-face)',
        color: 'var(--tile-text)',
      }}
    >
      <span className="absolute inset-0 flex items-center justify-center text-[22px] font-medium">
        {letter}
      </span>
      {points > 0 && (
        <span className="absolute bottom-0.5 right-1 text-[10px] opacity-70">{points}</span>
      )}
    </span>
  );
}

/** An empty slot, matching the board's. */
function Slot() {
  return (
    <span
      className="inline-block h-[46px] w-[40px] rounded align-middle"
      style={{ background: 'var(--slot-fill)', border: '1.5px solid var(--slot-border)' }}
    />
  );
}

/** A rack of tiles and slots with its ledge and score, as the board draws it. */
function Rack({
  cells,
  score,
  target,
}: {
  cells: (string | null)[];
  score: number;
  target: number;
}) {
  return (
    <span className="inline-flex flex-col gap-[3px]">
      <span className="flex items-baseline justify-end gap-px pr-1.5">
        <span
          className="text-[14px]"
          style={{ color: score === target ? 'var(--exact)' : 'var(--text)' }}
        >
          {score === target && <span aria-hidden>✓</span>}
          {score}
        </span>
        <span className="self-start text-[12px] opacity-85">/{target}</span>
      </span>
      <span className="relative flex gap-[5px] px-1 pb-[9px]">
        <span className="absolute bottom-0 left-0 right-0 h-[5px] rounded-[3px] bg-ledge" />
        {cells.map((c, i) => (c ? <Tile key={i} letter={c} /> : <Slot key={i} />))}
      </span>
    </span>
  );
}

function Step({
  n,
  title,
  children,
  figure,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  figure: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2">
      <p className="text-[15px] font-semibold">
        <span className="opacity-50">{n}.</span> {title}
      </p>
      <div className="flex flex-wrap items-end gap-2 rounded-md p-3" style={{ background: 'var(--slot-fill)' }}>
        {figure}
      </div>
      <p className="text-[13px] leading-snug opacity-75">{children}</p>
    </li>
  );
}

export default function HowToPlay() {
  return (
    <main
      // The body is fixed to the viewport, so this scrolls itself rather than
      // scrolling the page.
      className="mx-auto flex h-full w-full min-w-[320px] max-w-[430px] flex-col overflow-y-auto border-[5px] border-frame"
      style={{ background: 'var(--shell)', boxSizing: 'border-box' }}
    >
      <header className="mx-1.5 mt-1.5 flex items-center justify-between gap-3 bg-frame px-5 pb-2.5 pt-2.5 text-frame-text">
        <span className="text-[22px] font-normal" style={{ letterSpacing: '0.14em' }}>
          HOW TO PLAY
        </span>
        <Link
          href="/"
          aria-label="Back to the game"
          className="rounded-md border-[1.5px] border-frame-text px-2.5 py-1 text-[12px] font-semibold"
        >
          Play
        </Link>
      </header>

      <ol className="flex flex-col gap-5 px-4 py-5">
        <Step
          n={1}
          title="Fill the racks to spell a phrase"
          figure={
            <>
              <Rack cells={[null, null, null, null]} score={0} target={7} />
              <Rack cells={[null, null, null, null]} score={0} target={6} />
            </>
          }
        >
          One rack per word. The category above the board tells you what kind of
          answer to expect.
        </Step>

        <Step
          n={2}
          title="Consonants are limited"
          figure={
            <span className="flex gap-1.5">
              {['C', 'D', 'F', 'L', 'T'].map((l) => (
                <Tile key={l} letter={l} muted />
              ))}
            </span>
          }
        >
          You get exactly the consonants the phrase needs — no spares. Each is
          worth the points on its face.
        </Step>

        <Step
          n={3}
          title="Vowels are free and unlimited"
          figure={
            <span className="flex gap-1.5">
              {['A', 'E', 'I', 'O', 'U'].map((l) => (
                <Tile key={l} letter={l} muted />
              ))}
            </span>
          }
        >
          Use as many as you like. Vowels are worth nothing, so only the
          consonants count toward a rack&rsquo;s total.
        </Step>

        <Step
          n={4}
          title="Match the target to solve it"
          figure={
            <>
              <Rack cells={['C', 'O', 'L', 'D']} score={7} target={7} />
              <Rack cells={['F', 'E', 'E', 'T']} score={6} target={6} />
            </>
          }
        >
          The number above each rack is its consonant total. Hit it exactly with
          a real word and the rack is done — the tiles light up when the whole
          phrase is right.
        </Step>
      </ol>

      <div className="mt-auto px-4 pb-5">
        <p className="mb-3 text-[13px] leading-snug opacity-75">
          Stuck? <strong>Hint</strong> reveals a letter. <strong>Give Up</strong>{' '}
          fills in the answer.
        </p>
        <Link
          href="/"
          className="block w-full rounded-md border-[1.5px] border-frame bg-frame px-3 py-2.5 text-center text-[12px] font-bold uppercase text-frame-text"
          style={{ letterSpacing: '0.12em' }}
        >
          Start playing
        </Link>
      </div>
    </main>
  );
}
