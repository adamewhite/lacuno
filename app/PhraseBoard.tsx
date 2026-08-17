'use client';

import { useEffect, useRef, useState } from 'react';

import Link from 'next/link';

import { useDrag } from './useDrag';
import { usePhrase, type PhrasePuzzleData } from './usePhrase';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  DIFFICULTY_META,
  type Difficulty,
} from '../lib/procro/difficulty';

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
  difficulty = DEFAULT_DIFFICULTY,
}: {
  puzzle: PhrasePuzzleData;
  values: readonly number[];
  onNext: () => void;
  difficulty?: Difficulty;
}) {
  const [state, actions] = usePhrase(puzzle, values, difficulty);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [focusedRack, setFocusedRack] = useState<number | null>(null);
  const [caret, setCaret] = useState(0);
  const [rejected, setRejected] = useState<number | null>(null);
  /** Slot that just received a tile, as "rack:slot" — it plays the snap. */
  const [landed, setLanded] = useState<string | null>(null);

  useEffect(() => {
    if (!landed) return;
    const timer = setTimeout(() => setLanded(null), 200);
    return () => clearTimeout(timer);
  }, [landed]);

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
    setLanded(`${rack}:${slot}`);
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
          setLanded(`${focusedRack}:${caret}`);
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

  /** Next is available once the puzzle is finished, either way. */
  const canAdvance = state.won || showAnswer;

  /**
   * Puzzle tile size, shrunk so the longest word fits the shell on one line.
   *
   * The design's 44px tile supports about 6 letters at 430px, but BUTTERFLIES
   * is 11 — at full size that rack is 543px and overflows. A word broken across
   * rows stops reading as a word, so the tile shrinks instead. Racks themselves
   * wrap freely; a phrase may take as many rows as it needs.
   *
   * Capped at 40 rather than the design's 44 to buy vertical room, since the
   * whole game should sit in one viewport.
   */
  /**
   * Height available to the board: the shell minus the two fixed bands.
   *
   * Measuring the board element itself does not work — it is a flex child that
   * grows to fit its content, so measuring it and then checking the content
   * against that measurement is circular and always "fits". The bands around
   * it are what is actually fixed, so those are what get measured.
   */
  const shellRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const trayRef = useRef<HTMLDivElement | null>(null);
  const [available, setAvailable] = useState(0);

  useEffect(() => {
    const measure = () => {
      const shell = shellRef.current?.clientHeight ?? 0;
      const header = headerRef.current?.offsetHeight ?? 0;
      const tray = trayRef.current?.offsetHeight ?? 0;
      if (shell > 0) setAvailable(shell - header - tray);
    };

    measure();
    const observer = new ResizeObserver(measure);
    for (const el of [shellRef.current, headerRef.current, trayRef.current]) {
      if (el) observer.observe(el);
    }
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const longestWord = Math.max(...state.racks.map((r) => r.length));
  const BOARD_WIDTH = 392; // 430 shell - 5px border x2 - 14px padding x2
  const GAP = 5;

  // How many rows the racks will wrap into at full size. A phrase of many
  // short words (A BLESSING IN DISGUISE) takes four rows even though no single
  // word is long, so width alone does not bound the board's height.
  const rowsAtWidth = (tile: number): number => {
    let rows = 1;
    let used = 0;
    for (const rack of state.racks) {
      const w = rack.length * tile + (rack.length - 1) * GAP + 8;
      const add = used === 0 ? w : w + 8;
      if (used + add > BOARD_WIDTH && used > 0) {
        rows += 1;
        used = w;
      } else {
        used += add;
      }
    }
    return rows;
  };

  const widthLimit = Math.floor(
    (BOARD_WIDTH - (longestWord - 1) * GAP - 8) / longestWord,
  );

  /**
   * Row caps. The board is the flexible region between two fixed bands, so
   * both halves need a ceiling or one can squeeze the other out.
   */
  const MAX_BOARD_ROWS = 4;
  const MAX_HAND_ROWS = 2;

  const HAND_WIDTH = 376; // 430 - 5px border x2 - 6px margin x2 - 16px padding x2
  const HAND_GAP = 6;

  /**
   * How many rows the player's rack takes, given a BOARD tile size — the rack
   * tile is derived from it, so the two move together.
   */
  const handRowsAt = (boardTile: number): number => {
    const tile = Math.min(44, Math.round(boardTile * 1.15));
    const per = Math.max(1, Math.floor((HAND_WIDTH + HAND_GAP) / (tile + HAND_GAP)));
    return Math.ceil(Math.max(puzzle.consonants.length, 1) / per);
  };

  /** Height the racks need at a given tile size, inside the board region. */
  const boardHeightAt = (tile: number): number => {
    const h = Math.round(tile * (52 / 44));
    const rows = rowsAtWidth(tile);
    // Each row is its score superscript plus the tile and its ledge padding.
    return rows * (25 + h) + (rows - 1) * 12;
  };

  /**
   * Step the tile down until the racks fit the measured board region.
   *
   * Two separate pressures, and width alone bounds neither: a long word
   * overflows sideways, while a phrase of many short words wraps to several
   * rows and overflows downward. Most puzzles never enter this loop — a short
   * phrase keeps the full-size tile.
   */
  let fitted = Math.min(40, widthLimit);
  while (
    fitted > 22 &&
    (rowsAtWidth(fitted) > MAX_BOARD_ROWS ||
      handRowsAt(fitted) > MAX_HAND_ROWS ||
      (available > 0 && boardHeightAt(fitted) > available))
  ) {
    fitted -= 2;
  }

  const tileWidth = Math.max(22, fitted);
  /** Board rows at the chosen size, for spacing decisions below. */
  const boardRowCount = rowsAtWidth(tileWidth);

  /**
   * Where each rack begins within the phrase, so the solved ripple runs left
   * to right across the whole board instead of restarting on every word.
   */
  const rackOffsets = state.racks.reduce<number[]>((acc, rack, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + state.racks[i - 1].length);
    return acc;
  }, []);
  const tileHeight = Math.round(tileWidth * (52 / 44));
  const letterSize = Math.max(13, Math.round(tileWidth * (25 / 44)));
  const valueSize = Math.max(8, Math.round(tileWidth * (11 / 44)));

  /**
   * The player's rack uses the SAME tile size as the puzzle, so the two read as
   * one system — and it costs less height than the design's larger hand tile.
   *
   * It shrinks further if needed to keep the rack within two rows: the rack is
   * the one part of the tray that grows with the phrase, and a third row
   * pushes the board off the top of the screen.
   */
  const handCount = Math.max(puzzle.consonants.length, 1);
  const perRow = Math.ceil(handCount / 2);
  /**
   * The rack sits a little LARGER than the board.
   *
   * The board is a reference the player reads; the rack is what they actually
   * hit with a thumb, so it gets the bigger target. Capped at 44 (the design's
   * size) and still shrunk to keep the rack within two rows.
   */
  const handTileWidth = Math.max(
    22,
    Math.min(
      44,
      Math.round(tileWidth * 1.15),
      Math.floor((HAND_WIDTH - (perRow - 1) * HAND_GAP) / perRow),
    ),
  );
  const handTileHeight = Math.round(handTileWidth * (52 / 44));

  /**
   * Rack geometry, fixed from the FULL pool rather than what is left in it.
   *
   * Two things depend on this staying constant. The row count sets a reserved
   * height, so the tray does not shrink as tiles are placed and jerk the board
   * around. And the per-row cap balances the rows: eight tiles read 4+4 rather
   * than the 6+2 that natural wrapping produces.
   */
  const handRowCount = Math.min(
    MAX_HAND_ROWS,
    Math.max(
      1,
      Math.ceil(
        handCount /
          Math.max(1, Math.floor((HAND_WIDTH + HAND_GAP) / (handTileWidth + HAND_GAP))),
      ),
    ),
  );
  const handPerRow = Math.ceil(handCount / handRowCount);
  /** Width of one balanced row, so the flex box wraps where we intend. */
  const handRowWidth = handPerRow * handTileWidth + (handPerRow - 1) * HAND_GAP;
  const handReservedHeight =
    handRowCount * handTileHeight + (handRowCount - 1) * HAND_GAP + 9;

  const handLetterSize = Math.max(13, Math.round(handTileWidth * (25 / 44)));
  const handValueSize = Math.max(8, Math.round(handTileWidth * (11 / 44)));
  /**
   * Vowel piles are always the same size as the player's consonant tiles.
   * They are the same kind of object — a letter you pick up and place — so a
   * size difference reads as a meaning difference.
   */
  const pileTileWidth = handTileWidth;
  const pileTileHeight = handTileHeight;
  const pileLetterSize = handLetterSize;

  /** How far each pile layer peeks out behind the face. */
  const pileOffset = 2;

  return (
    <div
      className={[
        'mx-auto flex h-[100svh] w-full max-w-[430px] flex-col overflow-hidden border-[5px] border-frame bg-shell',
        dragging ? 'select-none' : '',
      ].join(' ')}
      ref={shellRef}
      style={{ boxSizing: 'border-box' }}
    >
      {/* Header band and category: one fixed measurement block. */}
      <div ref={headerRef} className="shrink-0">
      <div className="mx-1.5 mt-1.5 flex shrink-0 items-center justify-between gap-3 bg-frame px-5 pb-2.5 pt-2.5 text-frame-text">
        <div>
          <div
            className="font-tile text-[28px] font-normal leading-[1.1]"
            style={{ letterSpacing: '0.14em' }}
          >
            VWL DRP
          </div>
        </div>
        {/* Menu placeholder. The solved counter and reset control lived here;
            both are reachable from a menu once one exists. */}
        <button
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Menu"
          aria-expanded={menuOpen}
          className="flex h-[34px] w-[34px] flex-col items-center justify-center gap-[5px] rounded-md border-[1.5px] border-frame-text bg-transparent transition-colors hover:bg-[rgba(254,242,160,0.16)]"
        >
          <span className="block h-[2px] w-[16px] rounded-full bg-frame-text" />
          <span className="block h-[2px] w-[16px] rounded-full bg-frame-text" />
          <span className="block h-[2px] w-[16px] rounded-full bg-frame-text" />
        </button>
      </div>

      {/* Category — the kind of answer, centred under the header band. */}
      <div className="shrink-0 pb-0.5 pt-1 text-center">
        <span
          className="text-[10px] font-semibold uppercase opacity-60"
          style={{ letterSpacing: '0.18em' }}
        >
          {puzzle.category}
        </span>
      </div>

      </div>

      {/* Difficulty menu. Overlaid rather than inline so opening it costs the
          board no height. */}
      {menuOpen && (
        <div className="relative z-40">
          <div className="absolute left-1.5 right-1.5 top-0 rounded-b-md border-x border-b border-frame bg-tray p-3 shadow-xl">
            <p
              className="mb-2 text-[10px] font-semibold uppercase opacity-60"
              style={{ letterSpacing: '0.14em' }}
            >
              Vowel help
            </p>
            <div className="flex flex-col gap-1">
              {DIFFICULTIES.map((slug) => {
                const meta = DIFFICULTY_META[slug];
                const current = slug === difficulty;
                return (
                  <Link
                    key={slug}
                    href={`/${slug}`}
                    onClick={() => setMenuOpen(false)}
                    className={[
                      'flex items-baseline justify-between gap-3 rounded px-2 py-1.5 transition-colors',
                      current
                        ? 'bg-frame text-frame-text'
                        : 'hover:bg-[rgba(254,242,160,0.1)]',
                    ].join(' ')}
                  >
                    <span className="text-[13px] font-semibold">{meta.label}</span>
                    <span className="text-[10px] opacity-70">{meta.blurb}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Board field — racks wrap in sequence so the phrase reads in order,
          each row centred. */}
      {/* Padding is asymmetric and grows with the row count: a tall board wants
          air under its last rack, separating the puzzle from the tray, and the
          space comes from above rather than from the board itself. */}
      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3.5"
        style={{
          paddingTop: 2,
          paddingBottom: boardRowCount >= 3 ? 18 : 10,
        }}
      >
        <div className="flex flex-wrap content-center justify-center gap-x-2 gap-y-3">
        {state.racks.map((rack, rackIndex) => {
          // Three states, signalled the moment the arithmetic says so rather
          // than waiting for the rack to fill: under (neutral), exact (green),
          // over (red). The overshoot is deliberate information — it tells the
          // player which tiles cannot belong.
          const exact = rack.total === rack.target;
          const over = rack.total > rack.target;
          const solved = rack.full && exact;

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
                  style={{
                    color: over
                      ? 'var(--over)'
                      : exact
                        ? 'var(--exact)'
                        : 'var(--text)',
                    fontWeight: exact || over ? 700 : 500,
                  }}
                >
                  {/* Non-colour redundancy, so the state does not depend on
                      distinguishing green from red (SPEC §3). */}
                  {exact && <span aria-hidden>✓</span>}
                  {over && <span aria-hidden>▲</span>}
                  {rack.total}
                </span>
                <span className="self-start text-[9px] opacity-50">/{rack.target}</span>
              </div>

              {/* Rack body with its ledge */}
              <div className="relative flex gap-[5px] px-1 pb-[9px]">
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
                          if (state.selected) {
                            actions.placeSelected(rackIndex, slot);
                            setLanded(`${rackIndex}:${slot}`);
                          } else if (content) {
                            actions.clearSlot(rackIndex, slot);
                          }
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
                          animationDelay: state.won
                            ? `${(rackOffsets[rackIndex] + slot) * 45}ms`
                            : undefined,
                        }}
                        aria-label={`Word ${rackIndex + 1}, letter ${slot + 1}${
                          content ? `, ${content.letter}` : ', empty'
                        }`}
                        className={[
                          'absolute inset-0 block rounded',
                          landed === `${rackIndex}:${slot}` ? 'tile-snap' : '',
                          state.won ? 'tile-solved' : '',
                        ].join(' ')}
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
                      {focused && !content && !state.revealed && (
                        <span
                          className="pointer-events-none absolute rounded-[5px]"
                          style={{ inset: '-2px', border: '2px solid var(--accent)' }}
                        />
                      )}
                      {/* A hint's ring marks a letter the player asked for.
                          Vowels the difficulty gives away are not hints, so
                          they carry no ring — and once the whole answer is
                          revealed, ringing every slot would be noise and would
                          read as "correct" on a puzzle that was not solved. */}
                      {locked && !state.revealed && content?.kind !== 'vowel' && (
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
      <div
        ref={trayRef}
        className="mx-1.5 mb-1.5 flex shrink-0 flex-col gap-1.5 bg-tray px-4 pb-2 pt-2"
      >
        <div>
          <div className="flex justify-between gap-2">
            {state.vowels.map((letter, i) => {
              const selected =
                state.selected?.kind === 'vowel' && state.selected.letter === letter;
              return (
                <div
                  key={letter}
                  className="relative"
                  style={{
                    width: pileTileWidth + pileOffset * 2,
                    height: pileTileHeight + pileOffset * 2,
                  }}
                >
                  {/* Two offset layers behind the face read as a pile. Their
                      size and offset both scale with the tile — hardcoded, they
                      stuck out past a shrunken face and smeared. */}
                  <span
                    className="absolute rounded-[3px] bg-pile-back"
                    style={{
                      left: pileOffset * 2,
                      top: pileOffset * 2,
                      width: pileTileWidth,
                      height: pileTileHeight,
                    }}
                  />
                  <span
                    className="absolute rounded-[3px] bg-pile-mid"
                    style={{
                      left: pileOffset,
                      top: pileOffset,
                      width: pileTileWidth,
                      height: pileTileHeight,
                    }}
                  />
                  <button
                    onClick={() => {
                      if (justDragged.current) return;
                      actions.selectVowel(letter);
                    }}
                    {...dragHandlers(VOWEL_DRAG_BASE + i)}
                    aria-pressed={selected}
                    aria-label={`Vowel ${letter}`}
                    style={{
                      width: pileTileWidth,
                      height: pileTileHeight,
                      touchAction: 'none',
                    }}
                    className="absolute left-0 top-0 rounded-[3px] bg-tile-face-hand text-tile-text"
                  >
                    {/* No point value: vowels score nothing, so a "0" is noise
                        on every tile rather than information. */}
                    <span
                      className="absolute inset-0 flex items-center justify-center font-tile font-medium"
                      style={{ fontSize: pileLetterSize }}
                    >
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

        <div className="flex flex-col gap-1.5">

          {/* Height is reserved from the FULL pool, so the rack keeps its
              footprint as tiles leave it and the board above never shifts. */}
          <div
            data-drop="pool"
            style={{ height: handReservedHeight }}
            className="relative mt-1.5 flex flex-col items-center px-1 pb-[9px]"
          >
            {/* Same ledge height and gap as the puzzle racks above, so the two
                surfaces read as the same object. */}
            <span className="absolute bottom-0 left-0 right-0 h-[5px] rounded-[3px] bg-ledge" />
            {/* Fixed-width box so the rows break evenly: eight tiles read 4+4
                rather than the 6+2 natural wrapping produces. */}
            <div
              className="flex flex-wrap content-start justify-center gap-1.5"
              style={{ width: handRowWidth }}
            >
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
                  aria-pressed={selected}
                  aria-label={`Tile ${tile.letter}, ${tile.value} points`}
                  style={{
                    width: handTileWidth,
                    height: handTileHeight,
                    touchAction: 'none',
                  }}
                  className="relative rounded-[3px] bg-tile-face-hand text-tile-text"
                >
                  <span
                    className="absolute inset-0 flex items-center justify-center font-tile font-medium"
                    style={{ fontSize: handLetterSize }}
                  >
                    {tile.letter}
                  </span>
                  <span
                    className="absolute bottom-0.5 right-1 font-tile opacity-70"
                    style={{ fontSize: handValueSize }}
                  >
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
            </div>
          </div>

          {/* Hint and Give Up split the width, directly above Next Puzzle. */}
          <div className="flex gap-2">
            <button
              onClick={actions.revealHint}
              disabled={state.hintsUsed >= state.hintsAvailable}
              className="flex-1 rounded-md border-[1.5px] border-accent bg-transparent px-2.5 py-1.5 text-[12px] font-semibold text-accent-text transition-colors hover:bg-[rgba(233,139,80,0.2)] disabled:opacity-40"
            >
              Hint
            </button>
            <button
              onClick={() => {
                setShowAnswer(true);
                actions.revealSolution();
              }}
              disabled={state.won || showAnswer}
              className="flex-1 rounded-md border-[1.5px] border-accent bg-transparent px-2.5 py-1.5 text-[12px] font-semibold text-accent-text transition-colors hover:bg-[rgba(233,139,80,0.2)] disabled:opacity-40"
            >
              Give Up
            </button>
          </div>

          {/* Gated: a puzzle has to be finished — solved or given up on —
              before moving on, so Next is never an accidental skip. */}
          <button
            onClick={onNext}
            disabled={!canAdvance}
            title={canAdvance ? undefined : 'Solve it or give up first'}
            className="w-full rounded-md border-[1.5px] border-frame bg-frame px-3 py-2 text-[12px] font-bold uppercase text-frame-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            style={{ letterSpacing: '0.12em' }}
          >
            Next Puzzle
          </button>



        </div>
      </div>

      {dragging && drag.tileId !== null && (
        <div
          className="pointer-events-none fixed z-50 flex items-center justify-center rounded-[3px] bg-tile-face-hand opacity-90 shadow-xl"
          style={{
            width: handTileWidth,
            height: handTileHeight,
            left: drag.x - handTileWidth / 2,
            top: drag.y - handTileHeight / 2,
          }}
        >
          <span
            className="font-tile font-medium text-tile-text"
            style={{ fontSize: handLetterSize }}
          >
            {drag.tileId >= VOWEL_DRAG_BASE
              ? state.vowels[drag.tileId - VOWEL_DRAG_BASE]
              : puzzle.consonants[drag.tileId]}
          </span>
        </div>
      )}
    </div>
  );
}
