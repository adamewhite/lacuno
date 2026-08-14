'use client';

import { useEffect, useRef, useState } from 'react';

import { useDrag } from './useDrag';
import { usePhrase, type PhrasePuzzleData } from './usePhrase';

/**
 * Phrase board, styled from the VWL DRP design handoff.
 *
 * Visual system is the handoff's: oxblood frame, cream tiles on a slate field,
 * score superscript above each rack's right edge, tray below holding the vowel
 * piles and the consonant rack. Racks wrap in sequence so a phrase reads left
 * to right and down, Wheel-of-Fortune style, rather than stacking one per line.
 *
 * The GAMEPLAY is ours and differs from that prototype: whole words rather than
 * pre-set patterns, consonants supplied exactly, vowels unlimited but limited
 * to those the phrase uses, and custom letter values (SPEC §4) rather than
 * Scrabble's.
 */

/** Vowel drag ids sit past any tile id so one channel carries both. */
const VOWEL_DRAG_BASE = 10_000;

export default function PhraseBoard({
  puzzle,
  values,
  onNext,
  index,
  count,
}: {
  puzzle: PhrasePuzzleData;
  values: readonly number[];
  onNext: () => void;
  index: number;
  count: number;
}) {
  const [state, actions] = usePhrase(puzzle, values);
  const [showAnswer, setShowAnswer] = useState(false);
  const [focusedRack, setFocusedRack] = useState<number | null>(null);
  const [caret, setCaret] = useState(0);
  const [rejected, setRejected] = useState<number | null>(null);

  useEffect(() => {
    setShowAnswer(false);
    setFocusedRack(null);
    setCaret(0);
  }, [puzzle]);

  useEffect(() => {
    if (rejected === null) return;
    const timer = setTimeout(() => setRejected(null), 350);
    return () => clearTimeout(timer);
  }, [rejected]);

  const [drag, dragHandlers, dragging] = useDrag((tileId, target) => {
    if (!target) return;
    const parts = target.split(':');
    if (parts.length !== 2 || parts.some((p) => p === '')) return;
    const [rack, slot] = parts.map(Number);
    if (!Number.isInteger(rack) || !Number.isInteger(slot)) return;
    if (tileId >= VOWEL_DRAG_BASE) {
      actions.placeVowel(state.vowels[tileId - VOWEL_DRAG_BASE], rack, slot);
    } else {
      actions.placeConsonant(tileId, rack, slot);
    }
  });

  const justDragged = useRef(false);
  useEffect(() => {
    if (dragging) {
      justDragged.current = true;
    } else if (justDragged.current) {
      const timer = setTimeout(() => {
        justDragged.current = false;
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [dragging]);

  const stepCaret = (rackIndex: number, from: number, direction: 1 | -1): number => {
    const rack = state.racks[rackIndex];
    if (!rack || rack.length === 0) return 0;
    let slot = from;
    for (let step = 0; step < rack.length; step++) {
      slot = (slot + direction + rack.length) % rack.length;
      if (!rack.locked[slot]) return slot;
    }
    return from;
  };

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
        case 'Delete':
          event.preventDefault();
          actions.backspace(focusedRack, caret);
          setCaret(stepCaret(focusedRack, caret, -1));
          break;
        case 'ArrowLeft':
          event.preventDefault();
          setCaret((c) => stepCaret(focusedRack, c, -1));
          break;
        case 'ArrowRight':
          event.preventDefault();
          setCaret((c) => stepCaret(focusedRack, c, 1));
          break;
        case ' ':
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
        case 'Escape':
          setFocusedRack(null);
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusedRack, caret, actions, state.racks]);

  const solvedCount = state.racks.filter(
    (r) => r.full && r.total === r.target,
  ).length;

  /**
   * Tile size, shrunk so the longest word still fits the shell.
   *
   * The design's 44px tile supports about 6 letters at 430px, but phrases like
   * BUTTERFLIES IN YOUR STOMACH have an 11-letter word — at full size that rack
   * is 543px and overflows. Scaling down keeps a long word on one line, which
   * matters more than tile size: a word broken across rows stops reading as a
   * word.
   */
  const longestWord = Math.max(...state.racks.map((r) => r.length));
  const BOARD_WIDTH = 392; // 430 shell - 5px border x2 - 14px padding x2
  const GAP = 5;
  const tileWidth = Math.min(
    44,
    Math.floor((BOARD_WIDTH - (longestWord - 1) * GAP - 8) / longestWord),
  );
  const tileHeight = Math.round(tileWidth * (52 / 44));
  const letterSize = Math.max(13, Math.round(tileWidth * (25 / 44)));
  const valueSize = Math.max(8, Math.round(tileWidth * (11 / 44)));

  return (
    <div
      className={[
        'mx-auto flex min-h-[100svh] w-full max-w-[430px] flex-col border-[5px] border-frame bg-shell',
        dragging ? 'select-none' : '',
      ].join(' ')}
      style={{ boxSizing: 'border-box' }}
    >
      {/* Header band */}
      <div className="mx-1.5 mt-1.5 flex items-center justify-between gap-3 bg-frame px-5 pb-3 pt-3.5 text-frame-text">
        <div>
          <div
            className="font-tile text-[23px] font-medium leading-[1.1]"
            style={{ letterSpacing: '0.14em' }}
          >
            VWL DRP
          </div>
          <div
            className="mt-[3px] text-[10px] uppercase opacity-70"
            style={{ letterSpacing: '0.14em' }}
          >
            No. {index + 1} · Fill the racks
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="text-right">
            <div
              className="text-[9px] font-semibold uppercase opacity-70"
              style={{ letterSpacing: '0.12em' }}
            >
              Solved
            </div>
            <div className="text-[18px] font-bold leading-[1.2] tabular-nums">
              {solvedCount}
              <span className="text-[11px] opacity-70">/{state.racks.length}</span>
            </div>
          </div>
          <button
            onClick={actions.clearAll}
            aria-label="Reset puzzle"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-md border-[1.5px] border-frame-text bg-transparent text-[16px] leading-none text-frame-text transition-colors hover:bg-[rgba(244,232,210,0.16)]"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Board field — racks wrap in sequence so the phrase reads in order,
          each row centred. */}
      <div className="flex flex-1 items-center justify-center px-3.5 pb-7 pt-6">
        <div className="flex flex-wrap content-center justify-center gap-x-3 gap-y-5">
        {state.racks.map((rack, rackIndex) => {
          const solved = rack.full && rack.total === rack.target;

          return (
            <div
              key={rackIndex}
              onClick={() => {
                if (focusedRack !== rackIndex) {
                  setFocusedRack(rackIndex);
                  const first = rack.locked.findIndex((l) => !l);
                  setCaret(first >= 0 ? first : 0);
                }
              }}
              className={[
                'flex flex-col gap-[3px]',
                rejected === rackIndex ? 'animate-pulse' : '',
              ].join(' ')}
            >
              {/* Score superscript, right-aligned above the rack */}
              <div className="flex items-baseline justify-end gap-px pr-1.5 font-tile font-medium">
                <span
                  className="text-[14px]"
                  style={{ color: solved ? 'var(--solved)' : 'var(--text)' }}
                >
                  {rack.total}
                </span>
                <span className="self-start text-[9px] opacity-50">/{rack.target}</span>
              </div>

              {/* Rack body with its ledge */}
              <div className="relative flex gap-[5px] px-1 pb-[11px]">
                <span className="absolute bottom-0 left-0 right-0 h-[5px] rounded-[3px] bg-ledge" />
                {rack.slots.map((content, slot) => {
                  const locked = rack.locked[slot];
                  const focused = focusedRack === rackIndex && caret === slot;

                  // The wrapper is sized to the tile exactly. Left implicit it
                  // would size to an inline-block button, which sits on the
                  // text baseline and leaves descender space beneath it — and
                  // since the rings are inset from the wrapper, that phantom
                  // space made them hang low and sit loose around the tile.
                  return (
                    <div
                      key={slot}
                      className="relative block"
                      style={{ width: tileWidth, height: tileHeight }}
                    >
                      <button
                        data-drop={locked ? undefined : `${rackIndex}:${slot}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (justDragged.current) return;
                          setFocusedRack(rackIndex);
                          setCaret(slot);
                          if (state.selected) actions.placeSelected(rackIndex, slot);
                          else if (content) actions.clearSlot(rackIndex, slot);
                        }}
                        disabled={locked}
                        {...(content?.kind === 'consonant' && !locked
                          ? dragHandlers(content.tileId)
                          : {})}
                        style={{
                          touchAction:
                            content?.kind === 'consonant' && !locked ? 'none' : undefined,
                          background: content ? 'var(--tile-face)' : 'var(--slot-fill)',
                          color: content ? 'var(--tile-text)' : undefined,
                          border: content ? 'none' : '1.5px solid var(--slot-border)',
                        }}
                        aria-label={`Word ${rackIndex + 1}, letter ${slot + 1}${
                          content ? `, ${content.letter}` : ', empty'
                        }`}
                        className="absolute inset-0 block rounded"
                      >
                        {content && (
                          <>
                            <span
                              className="absolute inset-0 flex items-center justify-center font-tile font-medium"
                              style={{ fontSize: letterSize }}
                            >
                              {content.letter}
                            </span>
                            {content.kind === 'consonant' && (
                              <span
                                className="absolute bottom-0.5 right-1 font-tile opacity-70"
                                style={{ fontSize: valueSize }}
                              >
                                {content.value}
                              </span>
                            )}
                          </>
                        )}
                      </button>

                      {/* Placement ring on player-placed tiles, and the caret. */}
                      {content && !locked && (
                        <span
                          className="pointer-events-none absolute rounded-[5px]"
                          style={{
                            inset: '-2px',
                            border: '2px solid var(--accent)',
                          }}
                        />
                      )}
                      {focused && !content && (
                        <span
                          className="pointer-events-none absolute rounded-[5px]"
                          style={{ inset: '-2px', border: '2px solid var(--accent)' }}
                        />
                      )}
                      {locked && (
                        <span
                          className="pointer-events-none absolute rounded-[5px]"
                          style={{ inset: '-2px', border: '2px solid var(--solved)' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Tray */}
      <div className="mx-1.5 mb-1.5 flex flex-col gap-[11px] bg-tray px-4 pb-5 pt-3.5">
        <div>
          <span
            className="text-[10px] font-semibold uppercase opacity-60"
            style={{ letterSpacing: '0.14em' }}
          >
            Vowel piles
          </span>
          <div className="mt-2 flex justify-between gap-2">
            {state.vowels.map((letter, i) => {
              const selected =
                state.selected?.kind === 'vowel' && state.selected.letter === letter;
              return (
                <div key={letter} className="relative h-[52px] w-[52px]">
                  {/* Stacked layers read as an unlimited pile. */}
                  <span className="absolute left-1 top-[5px] h-12 w-12 rounded-[3px] bg-pile-back" />
                  <span className="absolute left-0.5 top-0.5 h-12 w-12 rounded-[3px] bg-pile-mid" />
                  <button
                    onClick={() => {
                      if (justDragged.current) return;
                      actions.selectVowel(letter);
                    }}
                    {...dragHandlers(VOWEL_DRAG_BASE + i)}
                    style={{ touchAction: 'none' }}
                    aria-pressed={selected}
                    aria-label={`Vowel ${letter}`}
                    className="absolute left-0 top-0 h-12 w-12 rounded-[3px] bg-tile-face-hand text-tile-text"
                  >
                    {/* No point value: vowels score nothing, so a "0" is noise
                        on every tile rather than information. */}
                    <span className="absolute inset-0 flex items-center justify-center font-tile text-[25px] font-medium">
                      {letter}
                    </span>
                    {selected && (
                      <span
                        className="pointer-events-none absolute rounded-md"
                        style={{ inset: '-3px', border: '2.5px solid var(--accent)' }}
                      />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] font-semibold uppercase opacity-60"
              style={{ letterSpacing: '0.14em' }}
            >
              Your rack ({state.pool.length})
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={actions.revealHint}
                disabled={state.hintsUsed >= state.hintsAvailable}
                className="rounded-md border-[1.5px] border-accent bg-transparent px-2.5 py-1 text-[12px] font-semibold text-accent-text transition-colors hover:bg-[rgba(217,74,61,0.16)] disabled:opacity-40"
              >
                Hint
              </button>
              <button
                onClick={() => setShowAnswer((s) => !s)}
                className="rounded-md border-[1.5px] border-accent bg-transparent px-2.5 py-1 text-[12px] font-semibold text-accent-text transition-colors hover:bg-[rgba(217,74,61,0.16)]"
              >
                {showAnswer ? 'Hide' : 'Give up'}
              </button>
            </div>
          </div>

          {/* min-height holds the rack's footprint as tiles leave it, so the
              tray does not creep upward on every placement. */}
          <div
            data-drop="pool"
            className="relative mt-2 flex min-h-[64px] flex-wrap content-start justify-center gap-1.5 px-1 pb-2.5"
          >
            <span className="absolute bottom-0 left-0 right-0 h-1 rounded-sm bg-ledge" />
            {state.pool.map((tile) => {
              const selected =
                state.selected?.kind === 'consonant' && state.selected.id === tile.id;
              return (
                <button
                  key={tile.id}
                  onClick={() => {
                    if (justDragged.current) return;
                    actions.selectConsonant(tile.id);
                  }}
                  {...dragHandlers(tile.id)}
                  style={{ touchAction: 'none' }}
                  aria-pressed={selected}
                  aria-label={`Tile ${tile.letter}, ${tile.value} points`}
                  className="relative h-[54px] w-12 rounded-[3px] bg-tile-face-hand text-tile-text"
                >
                  <span className="absolute inset-0 flex items-center justify-center font-tile text-[27px] font-medium">
                    {tile.letter}
                  </span>
                  <span className="absolute bottom-0.5 right-1 font-tile text-[10px] opacity-70">
                    {tile.value}
                  </span>
                  {selected && (
                    <span
                      className="pointer-events-none absolute rounded-md"
                      style={{ inset: '-3px', border: '2.5px solid var(--accent)' }}
                    />
                  )}
                </button>
              );
            })}
            {state.pool.length === 0 && (
              <span className="self-center font-tile text-[11px] opacity-50">
                all consonants placed
              </span>
            )}
          </div>

          {/* One fixed-height row carries both the solved banner and the
              revealed answer, so neither appearing nor disappearing shifts the
              tray. Solving a puzzle should not make the board jump. */}
          <div className="mt-1 flex h-[26px] items-center justify-center">
            {state.won ? (
              <p
                className="font-tile text-[13px] font-medium uppercase"
                style={{ color: 'var(--solved)', letterSpacing: '0.1em' }}
              >
                Solved · {state.moves} moves
              </p>
            ) : showAnswer ? (
              <p className="font-tile text-[13px] opacity-80">{puzzle.phrase}</p>
            ) : null}
          </div>

          <button
            onClick={onNext}
            className="mt-1 w-full rounded-md border-[1.5px] border-frame bg-frame px-3 py-2 text-[12px] font-bold uppercase text-frame-text transition-opacity hover:opacity-90"
            style={{ letterSpacing: '0.12em' }}
          >
            Next puzzle · {index + 1}/{count}
          </button>
        </div>
      </div>

      {dragging && drag.tileId !== null && (
        <div
          className="pointer-events-none fixed z-50 flex h-[54px] w-12 items-center justify-center rounded-[3px] bg-tile-face-hand opacity-90 shadow-xl"
          style={{ left: drag.x - 24, top: drag.y - 27 }}
        >
          <span className="font-tile text-[27px] font-medium text-tile-text">
            {drag.tileId >= VOWEL_DRAG_BASE
              ? state.vowels[drag.tileId - VOWEL_DRAG_BASE]
              : puzzle.consonants[drag.tileId]}
          </span>
        </div>
      )}
    </div>
  );
}
