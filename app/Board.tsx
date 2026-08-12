'use client';

import { useEffect, useState } from 'react';

import { usePuzzle, type PuzzleData } from './usePuzzle';

/**
 * Playable board. MVP for playtesting (SPEC §11.5) — the arithmetic is the
 * point of the app, so this exists to let a human try the deduction without
 * summing tiles by hand.
 *
 * Input model is tap-tile-then-tap-slot (SPEC §8 leans this way for mobile
 * forgiveness). Drag is the untested alternative.
 */
export default function Board({
  puzzle,
  values,
  dictionary,
  onNext,
  index,
  count,
}: {
  puzzle: PuzzleData;
  values: readonly number[];
  dictionary: ReadonlySet<string> | null;
  onNext: () => void;
  index: number;
  count: number;
}) {
  const [state, actions] = usePuzzle(puzzle, values, dictionary);
  const [showAnswer, setShowAnswer] = useState(false);

  /** Rack currently receiving typed letters, or null. */
  const [focusedRack, setFocusedRack] = useState<number | null>(null);
  /** Insertion point within the focused rack — set by clicking a slot. */
  const [caret, setCaret] = useState(0);
  /** Rack to flash when a keystroke is rejected — the tile is not available. */
  const [rejected, setRejected] = useState<number | null>(null);
  /** Slot being dragged over, as "rack:slot", for the drop highlight. */
  const [dragOver, setDragOver] = useState<string | null>(null);

  useEffect(() => setShowAnswer(false), [puzzle]);

  // Clear the rejection flash shortly after it fires.
  useEffect(() => {
    if (rejected === null) return;
    const timer = setTimeout(() => setRejected(null), 350);
    return () => clearTimeout(timer);
  }, [rejected]);

  /**
   * Move the caret one step in `direction`, wrapping around the rack and
   * skipping pinned slots.
   *
   * Wrapping matters at both ends: backspacing at slot 0 continues from the
   * end, and arrowing right off the last slot returns to the first, so a rack
   * can be traversed or cleared without the caret sticking. Bounded by rack
   * length so an all-pinned rack cannot loop forever.
   */
  const stepCaret = (rackIndex: number, from: number, direction: 1 | -1): number => {
    const rack = state.racks[rackIndex];
    if (!rack || rack.length === 0) return 0;

    let slot = from;
    for (let step = 0; step < rack.length; step++) {
      slot = (slot + direction + rack.length) % rack.length;
      if (!rack.pinned[slot]) return slot;
    }
    return from;
  };

  // Keyboard entry. A focused rack takes letters directly; backspace removes
  // the last one; Tab and arrows move between racks, Escape defocuses.
  useEffect(() => {
    if (focusedRack === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        if (actions.typeLetter(focusedRack, event.key, caret)) {
          setCaret(stepCaret(focusedRack, caret, 1));
        } else {
          setRejected(focusedRack);
        }
        return;
      }

      switch (event.key) {
        case 'Backspace':
        case 'Delete': {
          event.preventDefault();
          actions.backspace(focusedRack, caret);
          // Deleting at the start wraps to the end, so a rack can be cleared
          // by holding backspace without the caret getting stuck at slot 0.
          setCaret(stepCaret(focusedRack, caret, -1));
          break;
        }
        case 'ArrowLeft':
          event.preventDefault();
          setCaret((c) => stepCaret(focusedRack, c, -1));
          break;
        case 'ArrowRight':
          event.preventDefault();
          setCaret((c) => stepCaret(focusedRack, c, 1));
          break;
        case 'Escape':
          setFocusedRack(null);
          break;
        case 'Tab':
        case 'ArrowDown':
          event.preventDefault();
          setFocusedRack((r) => ((r ?? 0) + 1) % state.racks.length);
          setCaret(0);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedRack((r) => ((r ?? 0) - 1 + state.racks.length) % state.racks.length);
          setCaret(0);
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusedRack, caret, actions, state.racks]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-baseline justify-between border-b border-stone-300 pb-3 dark:border-stone-700">
        <h1 className="font-mono text-2xl lowercase tracking-[0.2em] text-stone-900 dark:text-stone-100">
          vwldrp
        </h1>
        <span className="font-mono text-xs text-stone-500">
          {index + 1} / {count}
        </span>
      </header>

      {/* Racks */}
      <section className="space-y-4">
        {state.racks.map((rack, rackIndex) => {
          const over = rack.total > rack.target;
          const exact = rack.total === rack.target;

          return (
            <div
              key={rackIndex}
              onClick={() => {
                if (focusedRack !== rackIndex) {
                  setFocusedRack(rackIndex);
                  // Land on the first writable slot rather than always slot 0.
                  const first = actions.nextWritableSlot(rackIndex, 0);
                  setCaret(first >= 0 ? first : 0);
                }
              }}
              className={[
                'rounded-lg border p-3 transition-all duration-300',
                rejected === rackIndex ? 'animate-pulse border-red-500 bg-red-50 dark:bg-red-950/30' : '',
                rack.solved
                  ? 'border-amber-500 bg-amber-50 shadow-[0_0_20px_-4px] shadow-amber-400 dark:bg-amber-950/30'
                  : focusedRack === rackIndex
                    ? 'border-stone-900 ring-1 ring-stone-900 dark:border-stone-100 dark:ring-stone-100'
                    : 'border-stone-300 dark:border-stone-700',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {rack.slots.map((tile, slot) => {
                    const locked = rack.pinned[slot];
                    return (
                      <button
                        key={slot}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Clicking a slot puts the typing caret there, so the
                          // next keystroke fills THIS slot rather than the
                          // start of the rack.
                          setFocusedRack(rackIndex);
                          setCaret(slot);
                          if (state.selectedTileId !== null) {
                            actions.placeSelected(rackIndex, slot);
                          } else if (tile) {
                            actions.clearSlot(rackIndex, slot);
                          }
                        }}
                        disabled={locked}
                        // A placed tile can be dragged straight to another slot.
                        draggable={Boolean(tile) && !locked}
                        onDragStart={(e) => {
                          if (!tile || locked) return;
                          e.dataTransfer.setData('text/plain', String(tile.id));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          if (locked) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          setDragOver(`${rackIndex}:${slot}`);
                        }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOver(null);
                          if (locked) return;
                          const id = Number(e.dataTransfer.getData('text/plain'));
                          if (Number.isFinite(id)) actions.placeTile(id, rackIndex, slot);
                        }}
                        aria-label={
                          tile
                            ? `Rack ${rackIndex + 1} slot ${slot + 1}, ${tile.letter}${locked ? ', locked hint' : ''}`
                            : `Rack ${rackIndex + 1} slot ${slot + 1}, empty`
                        }
                        className={[
                          'relative h-16 w-14 rounded-md border-2 transition-colors sm:h-[4.5rem] sm:w-16',
                          dragOver === `${rackIndex}:${slot}` && !locked
                            ? 'border-sky-500 bg-sky-100 dark:bg-sky-900/40'
                            : focusedRack === rackIndex && caret === slot && !locked
                              ? 'border-stone-900 ring-2 ring-stone-900/40 dark:border-stone-100 dark:ring-stone-100/40'
                              : locked
                                ? 'cursor-not-allowed border-sky-500 bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200'
                                : tile
                                  ? 'cursor-grab border-stone-700 bg-stone-100 text-stone-900 hover:border-red-500 active:cursor-grabbing dark:border-stone-400 dark:bg-stone-800 dark:text-stone-100'
                                  : 'border-dashed border-stone-400 bg-transparent hover:border-stone-900 hover:bg-stone-100 dark:hover:border-stone-200 dark:hover:bg-stone-800',
                        ].join(' ')}
                      >
                        {tile ? (
                          <>
                            <span className="block font-mono text-2xl font-semibold leading-none sm:text-3xl">
                              {tile.letter}
                            </span>
                            {/* The point value is the whole game — SPEC §4 makes
                                totals the information channel — so it is set at
                                a readable size, not a decorative subscript. */}
                            <span className="mt-1 block font-mono text-sm font-bold leading-none tabular-nums opacity-70 sm:text-base">
                              {tile.value}
                            </span>
                          </>
                        ) : (
                          <span className="font-mono text-2xl text-stone-300 dark:text-stone-700">
                            ·
                          </span>
                        )}
                        {locked && (
                          <span className="absolute left-1 top-0.5 text-[10px]" aria-hidden>
                            📌
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Live total. Three states, each with non-color redundancy
                    (icon + weight) for colour-blind safety — SPEC §3. */}
                <div className="ml-auto pl-2 text-right font-mono">
                  <div
                    className={[
                      'text-2xl tabular-nums sm:text-3xl',
                      exact
                        ? 'font-bold text-emerald-700 dark:text-emerald-400'
                        : over
                          ? 'font-bold text-red-700 dark:text-red-400'
                          : 'font-semibold text-stone-600 dark:text-stone-300',
                    ].join(' ')}
                  >
                    {exact && <span aria-hidden>✓ </span>}
                    {over && <span aria-hidden>▲ </span>}
                    {rack.total}
                    <span className="text-lg font-normal text-stone-400 sm:text-xl">
                      {' / '}
                      {rack.target}
                    </span>
                  </div>
                  {over && (
                    <div className="text-[11px] font-semibold text-red-700 dark:text-red-400">
                      over by {rack.total - rack.target}
                    </div>
                  )}
                  {rack.solved && (
                    <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                      {rack.word}
                    </div>
                  )}
                  {rack.full && exact && !rack.solved && (
                    <div className="text-[11px] text-stone-500">not a word</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Vowel stack — zero-value tiles, shown separately so the arithmetic
          reads as "only the consonants count". The counts are still exact and
          every vowel must be used. */}
      {state.splitPool && (
        <section className="mt-8">
          <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-stone-500">
            Vowels — 0 points ({state.vowelPool.length} left)
          </h2>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              // Dropping onto the pool returns the tile to it.
              e.preventDefault();
              const id = Number(e.dataTransfer.getData('text/plain'));
              if (Number.isFinite(id)) actions.returnTile(id);
            }}
            className="flex min-h-[3.5rem] flex-wrap gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2 dark:border-emerald-900 dark:bg-emerald-950/30"
          >
            {state.vowelPool.map((tile) => (
              <button
                key={tile.id}
                onClick={() => actions.selectTile(tile.id)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(tile.id));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                aria-pressed={state.selectedTileId === tile.id}
                aria-label={`Vowel ${tile.letter}, 0 points`}
                className={[
                  'h-14 w-12 cursor-grab rounded-md border-2 font-mono text-2xl font-semibold transition-all active:cursor-grabbing sm:h-16 sm:w-14 sm:text-3xl',
                  state.selectedTileId === tile.id
                    ? '-translate-y-1 border-emerald-800 bg-emerald-800 text-emerald-50 shadow-lg'
                    : 'border-emerald-400 bg-white text-emerald-900 hover:border-emerald-700 dark:border-emerald-700 dark:bg-stone-800 dark:text-emerald-200',
                ].join(' ')}
              >
                {tile.letter}
              </button>
            ))}
            {state.vowelPool.length === 0 && (
              <span className="px-2 py-4 font-mono text-xs text-stone-400">
                all vowels placed
              </span>
            )}
          </div>
        </section>
      )}

      {/* Tile pool */}
      <section className={state.splitPool ? 'mt-4' : 'mt-8'}>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-mono text-xs uppercase tracking-widest text-stone-500">
            {state.splitPool ? 'Consonants' : 'Tiles'} ({state.consonantPool.length} left)
          </h2>
          <button
            onClick={state.shuffled ? actions.sortPool : actions.shufflePool}
            className="font-mono text-xs text-stone-500 underline-offset-4 hover:underline"
          >
            {state.shuffled ? 'sort by value' : 'shuffle'}
          </button>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const id = Number(e.dataTransfer.getData('text/plain'));
            if (Number.isFinite(id)) actions.returnTile(id);
          }}
          className="flex min-h-[3.5rem] flex-wrap gap-1.5 rounded-lg border border-stone-200 bg-stone-50 p-2 dark:border-stone-800 dark:bg-stone-900/50"
        >
          {state.consonantPool.map((tile) => (
            <button
              key={tile.id}
              onClick={() => actions.selectTile(tile.id)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', String(tile.id));
                e.dataTransfer.effectAllowed = 'move';
              }}
              aria-pressed={state.selectedTileId === tile.id}
              aria-label={`Tile ${tile.letter}, ${tile.value} points`}
              className={[
                'relative h-16 w-14 cursor-grab rounded-md border-2 transition-all active:cursor-grabbing sm:h-[4.5rem] sm:w-16',
                state.selectedTileId === tile.id
                  ? '-translate-y-1 border-stone-900 bg-stone-900 text-stone-50 shadow-lg dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900'
                  : 'border-stone-400 bg-white text-stone-900 hover:border-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100',
              ].join(' ')}
            >
              <span className="block font-mono text-2xl font-semibold leading-none sm:text-3xl">
                {tile.letter}
              </span>
              <span className="mt-1 block font-mono text-sm font-bold leading-none tabular-nums opacity-70 sm:text-base">
                {tile.value}
              </span>
            </button>
          ))}
          {state.consonantPool.length === 0 && (
            <span className="px-2 py-4 font-mono text-xs text-stone-400">
              all {state.splitPool ? 'consonants' : 'tiles'} placed
            </span>
          )}
        </div>

        <p className="mt-2 font-mono text-[11px] leading-relaxed text-stone-500">
          Drag a tile to a slot, or tap a tile then tap a slot. Tap a placed tile
          to take it back.
          <br />
          <span className="hidden sm:inline">
            Or click a rack and type. Backspace deletes, Tab moves to the next
            rack, Esc exits.
          </span>
        </p>
      </section>

      {/* Controls */}
      <section className="mt-6 flex flex-wrap items-center gap-2">
        <button
          onClick={actions.revealHint}
          disabled={state.hintsUsed >= state.hintsAvailable}
          className="rounded border border-sky-600 px-3 py-1.5 font-mono text-xs text-sky-700 transition-colors hover:bg-sky-50 disabled:opacity-40 dark:text-sky-400 dark:hover:bg-sky-950"
        >
          📌 hint ({state.hintsAvailable - state.hintsUsed} left)
        </button>
        <button
          onClick={actions.returnAll}
          className="rounded border border-stone-400 px-3 py-1.5 font-mono text-xs text-stone-600 transition-colors hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
        >
          clear
        </button>
        <button
          onClick={() => setShowAnswer((s) => !s)}
          className="rounded border border-stone-400 px-3 py-1.5 font-mono text-xs text-stone-600 transition-colors hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
        >
          {showAnswer ? 'hide' : 'give up'}
        </button>
        <button
          onClick={onNext}
          className="ml-auto rounded border border-stone-900 bg-stone-900 px-3 py-1.5 font-mono text-xs text-stone-50 transition-colors hover:bg-stone-700 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
        >
          next puzzle →
        </button>
      </section>

      {/* Win state — visually distinct from and bigger than rack glow (SPEC §3) */}
      {state.won && (
        <div className="mt-6 rounded-lg border-2 border-amber-500 bg-amber-50 p-5 text-center dark:bg-amber-950/40">
          <p className="font-mono text-lg font-bold tracking-wide text-amber-900 dark:text-amber-200">
            PROCRUSTES IS SATISFIED
          </p>
          <p className="mt-1 font-mono text-xs text-amber-800 dark:text-amber-300">
            {state.moves} moves
            {state.hintsUsed > 0 && ` · ${state.hintsUsed} hint${state.hintsUsed > 1 ? 's' : ''}`}
          </p>
        </div>
      )}

      {showAnswer && (
        <div className="mt-4 rounded border border-stone-300 bg-stone-50 p-3 font-mono text-xs dark:border-stone-700 dark:bg-stone-900">
          <span className="text-stone-500">one answer: </span>
          <span className="font-semibold">{puzzle.solution.join(' · ')}</span>
          <p className="mt-1 text-[11px] text-stone-500">
            Any anagram of these words is equally correct.
          </p>
        </div>
      )}

      {!dictionary && (
        <p className="mt-4 font-mono text-[11px] text-amber-700">
          loading dictionary — racks will not glow until it arrives
        </p>
      )}
    </div>
  );
}
