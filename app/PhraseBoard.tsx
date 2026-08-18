'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import Link from 'next/link';

import { useDrag } from './useDrag';
import { usePhrase, type PhrasePuzzleData } from './usePhrase';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  DIFFICULTY_META,
  type Difficulty,
} from '../lib/lacuno/difficulty';

/**
 * Phrase board, styled from the design handoff.
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

/**
 * Ceiling on the measured overflow correction — roughly one tile step.
 *
 * Each shrink triggers a resize, which re-measures; without a cap the
 * correction compounds until the board is small enough that its rows collapse
 * into each other, which is what turned four-row puzzles into three.
 */
const MAX_OVERFLOW = 24;

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
  /**
   * Kept mounted while the menu animates out. Unmounting on close would skip
   * the exit entirely — the panel would simply vanish.
   */
  const [menuClosing, setMenuClosing] = useState(false);

  const toggleMenu = useCallback(() => {
    setMenuOpen((open) => {
      if (open) {
        setMenuClosing(true);
        setTimeout(() => setMenuClosing(false), 150); // matches .menu-leave
      }
      return !open;
    });
  }, []);
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
    setOverflow(0);
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
   * Height available to the board: the shell minus the header and the tray.
   *
   * The header is measured, since it does not change with the tile size. The
   * TRAY IS NOT: its height depends on the tile size, which is what we are
   * computing, so measuring it creates a feedback loop — shrinking the tile
   * shrinks the tray, which frees height, which lets the tile grow, which
   * grows the tray again. The board visibly shudders between two sizes. The
   * tray's height is therefore derived from a candidate tile size instead
   * (see trayHeightAt), which is a pure function and cannot oscillate.
   */
  const shellRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [shellHeight, setShellHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  /**
   * Height the board is over its container, measured after layout.
   *
   * trayHeightAt models the tray from the tile size, but a model drifts from
   * the real thing — margins, flex gaps and borders are easy to miss, and a
   * few pixels is the difference between a four-row board fitting and spilling
   * past both ends. This measures the actual overflow and feeds it back as a
   * correction, so the sizing self-corrects instead of relying on the model
   * being exactly right.
   *
   * It cannot oscillate: overflow only ever shrinks the tile, and a tile that
   * fits reports zero overflow, which leaves it where it is. It is capped so a
   * correction that keeps firing cannot compound into a board so small its
   * rows collapse together.
   */
  const [overflow, setOverflow] = useState(0);
  /**
   * The shell's real width. It is capped at 430px but a narrower phone gets
   * less — an iPhone SE is 375 — and assuming the cap overflowed the board off
   * both edges. Starts at the reference for the server render.
   */
  const [shellWidth, setShellWidth] = useState(430);

  useEffect(() => {
    const measure = () => {
      const shell = shellRef.current?.clientHeight ?? 0;
      if (shell > 0) setShellHeight(shell);

      const header = headerRef.current?.offsetHeight ?? 0;
      if (header > 0) setHeaderHeight(header);

      const width = shellRef.current?.clientWidth ?? 0;
      if (width > 0) setShellWidth(width);

      const board = boardRef.current;
      if (board) {
        const spill = board.scrollHeight - board.clientHeight;
        if (spill > 0) {
          // Accumulate, but only up to one tile step. Each shrink triggers a
          // resize, which re-measures — adding the full spill every time
          // compounds the correction until the board over-shrinks and its rows
          // collapse into each other. One step is enough to clear a model that
          // is a few pixels out, and the loop re-runs if it is not.
          setOverflow((current) => Math.min(current + spill, MAX_OVERFLOW));
        }
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    for (const el of [shellRef.current, headerRef.current, boardRef.current]) {
      if (el) observer.observe(el);
    }
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  /**
   * Largest tile the screen allows. A phone keeps the design's 40px; wider
   * screens grow the tiles somewhat rather than spreading the same small ones
   * apart.
   *
   * The ceiling is deliberately modest. A tile is a letter, not a card — past
   * about 60px the board reads as a wall of squares and the phrase stops
   * scanning as a phrase.
   */
  const TILE_CAP =
    shellWidth >= 900 ? 66 : shellWidth >= 600 ? 60 : shellWidth >= 480 ? 52 : 40;

  /** Distance the outer hamburger bars sit from the centre, by breakpoint. */
  const barOffset = shellWidth >= 640 ? 9 : 7;

  const longestWord = Math.max(...state.racks.map((r) => r.length));
  // clientWidth already excludes the 5px border; subtract the field's own
  // 14px horizontal padding.
  // Capped to match the racks' own max-width: sizing tiles against the full
  // shell would overflow the narrower box they actually sit in.
  const BOARD_WIDTH = Math.min(750, Math.max(160, shellWidth - 28));
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

  // Tray margin (6px each side) and padding (16px each side).
  // Matches the tray's capped inner column, not the full shell.
  const HAND_WIDTH = Math.min(620, Math.max(160, shellWidth - 44));
  const HAND_GAP = 6;

  /**
   * How many rows the player's rack takes, given a BOARD tile size — the rack
   * tile is derived from it, so the two move together.
   */
  const handRowsAt = (boardTile: number): number => {
    const tile = Math.min(TILE_CAP + 4, Math.round(boardTile * 1.15));
    const per = Math.max(1, Math.floor((HAND_WIDTH + HAND_GAP) / (tile + HAND_GAP)));
    return Math.ceil(Math.max(puzzle.consonants.length, 1) / per);
  };

  /**
   * Height the racks need at a given tile size, inside the board region.
   *
   * Per row: the score superscript (14px), its 3px gap, the tile, and the 9px
   * ledge padding beneath it. Rows are separated by ROW_GAP.
   */
  const ROW_GAP = 8;
  const RACK_OVERHEAD = 14 + 3 + 9;
  /** The field's own vertical padding, which comes out of the same budget. */
  const BOARD_PADDING = 18;

  /**
   * Height the tray takes at a given board tile size, derived rather than
   * measured so the sizing cannot feed back on itself.
   *
   * Bands, top to bottom: the tray's own padding, the vowel pile row, a gap,
   * the player's rack (one or two rows plus its ledge), a gap, the Hint/Give Up
   * row, and the Next Puzzle bar.
   */
  const trayHeightAt = (tile: number): number => {
    const handTile = Math.min(TILE_CAP + 4, Math.round(tile * 1.15));
    const handHeight = Math.round(handTile * (52 / 44));
    const rows = handRowsAt(tile);

    const margin = 6;             // mb-1.5 below the tray
    const padding = 8 + 8;        // pt-2 pb-2
    const piles = handHeight + 4; // pile stage, including its stack offset
    const columnGap = 6;          // gap-1.5 between the tray's children
    const rackMargin = 6;         // mt-1.5 above the rack
    const rack = rows * handHeight + (rows - 1) * HAND_GAP + 9; // + ledge
    const buttonRow = 30;
    const nextBar = 34;
    const innerGaps = 6 * 2;      // gaps around the button rows

    return (
      margin +
      padding +
      piles +
      columnGap +
      rackMargin +
      rack +
      innerGaps +
      buttonRow +
      nextBar
    );
  };
  const boardHeightAt = (tile: number): number => {
    const h = Math.round(tile * (52 / 44));
    const rows = rowsAtWidth(tile);
    return rows * (RACK_OVERHEAD + h) + (rows - 1) * ROW_GAP;
  };

  /**
   * Step the tile down until the racks fit the measured board region.
   *
   * Two separate pressures, and width alone bounds neither: a long word
   * overflows sideways, while a phrase of many short words wraps to several
   * rows and overflows downward. Most puzzles never enter this loop — a short
   * phrase keeps the full-size tile.
   */
  let fitted = Math.min(TILE_CAP, widthLimit);
  while (
    fitted > 22 &&
    (rowsAtWidth(fitted) > MAX_BOARD_ROWS ||
      handRowsAt(fitted) > MAX_HAND_ROWS ||
      // The field's own vertical padding comes out of the same budget, so the
      // racks must fit what is left after it — otherwise a tall board spills
      // past both ends, hiding the first row's score under the header and
      // cutting the last row off against the tray.
      (shellHeight > 0 &&
        boardHeightAt(fitted) >
          shellHeight - headerHeight - trayHeightAt(fitted) - BOARD_PADDING - overflow))
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
  // Sized against the WIDEST row, since that is the one that has to fit. Using
  // the average left a 14-consonant rack (7+7) overflowing its container.
  const widestRow = handCount - Math.floor(handCount / 2) ;
  const handTileWidth = Math.max(
    22,
    Math.min(
      TILE_CAP + 4,
      Math.round(tileWidth * 1.15),
      Math.floor((HAND_WIDTH - (widestRow - 1) * HAND_GAP) / widestRow),
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
  /**
   * Tiles per row. Flooring puts the extra tile of an odd count on the BOTTOM
   * row — nearer the thumb, and a rack growing downward reads better than one
   * hanging over.
   *
   * The container is then sized to the LONGER row, not this one. Sizing it to
   * the floor left seven tiles wrapping 3+3+1, spilling a third row over the
   * buttons; the box has to be wide enough for the row that actually holds the
   * extra tile.
   */
  const handPerRow = Math.max(1, Math.floor(handCount / handRowCount));
  const handWidestRow = handCount - handPerRow * (handRowCount - 1);
  /** Width of the longest row, so the flex box wraps where we intend. */
  const handRowWidth =
    handWidestRow * handTileWidth + (handWidestRow - 1) * HAND_GAP;
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
        // min-w floors the shell at the narrowest supported phone. Below that
        // the page scrolls sideways rather than crushing the tiles past
        // legibility — a rare case, and scrolling is the lesser failure.
        // h-full, not 100svh: the body is fixed to the viewport, so the shell
        // fills its parent. svh units would still track the address bar and
        // reintroduce the shifting this is meant to stop.
        // Full bleed: the frame encases whatever screen it is on. The board
        // inside is centred, so a very wide window gets margin around the
        // racks rather than racks stretched across it.
        'mx-auto flex h-full w-full min-w-[320px] flex-col overflow-hidden border-[5px] border-frame bg-shell sm:border-[8px]',
        dragging ? 'select-none' : '',
      ].join(' ')}
      ref={shellRef}
      style={{ boxSizing: 'border-box' }}
    >
      {/* Header band and category: one fixed measurement block. */}
      <div ref={headerRef} className="shrink-0">
      <div className="relative mx-1.5 mt-1.5 flex shrink-0 items-center justify-between gap-3 bg-frame px-5 pb-2.5 pt-2.5 text-frame-text sm:mx-2 sm:mt-2 sm:px-7 sm:pb-4 sm:pt-4">
        <div>
          <div
            className="font-tile text-[28px] font-normal leading-[1.1] sm:text-[38px]"
            style={{ letterSpacing: '0.126em' }}
          >
            LACUNO
          </div>
        </div>
        {/* Menu placeholder. The solved counter and reset control lived here;
            both are reachable from a menu once one exists. */}
        <button
          onClick={toggleMenu}
          aria-label="Menu"
          aria-expanded={menuOpen}
          // Nudged outward by the button's own inset, so the BARS line up with
          // the wordmark's left edge rather than the invisible box around
          // them. The tap target keeps its full size.
          className="-mr-[9px] relative h-[34px] w-[34px] rounded-md bg-transparent transition-colors hover:bg-[rgba(242,211,192,0.18)] sm:-mr-[12px] sm:h-[44px] sm:w-[44px]"
        >
          {/* Three bars that morph into an X: the outer two converge on the
              centre and cross, the middle one fades. Absolutely positioned so
              they can travel — a flex column cannot overlap them.

              `open:` styles are applied via the data attribute so both states
              are declared in one place rather than as two class strings. */}
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              aria-hidden
              className="absolute left-1/2 block h-[2px] w-[16px] -translate-x-1/2 rounded-full bg-frame-text transition-transform duration-200 ease-out sm:h-[3px] sm:w-[21px]"
              style={{
                top: '50%',
                // Bars sit at -7 / 0 / +7 when closed (-9 / 0 / +9 at sm);
                // the outer two travel to the centre and rotate when open.
                transform: menuOpen
                  ? `translate(-50%, -50%) rotate(${i === 0 ? 45 : i === 2 ? -45 : 0}deg)`
                  : `translate(-50%, calc(-50% + ${(i - 1) * barOffset}px))`,
                opacity: menuOpen && i === 1 ? 0 : 1,
                transitionProperty: 'transform, opacity',
              }}
            />
          ))}
        </button>

        {/* Difficulty menu, dropping from the nav bar. Absolutely positioned
              so opening it costs the board no height. */}
        {(menuOpen || menuClosing) && (
          <div
            className={[
              'absolute left-0 right-0 top-full z-40 rounded-b-md border-x border-b border-frame bg-tray p-3 shadow-xl',
              menuClosing ? 'menu-leave' : 'menu-enter',
            ].join(' ')}
          >
              <p
                className="mb-2 text-[10px] font-semibold uppercase opacity-60"
                style={{ letterSpacing: '0.14em' }}
              >
                Difficulty level
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
                          : 'hover:bg-[rgba(242,211,192,0.14)]',
                      ].join(' ')}
                    >
                      <span className="text-[13px] font-semibold">{meta.label}</span>
                      <span className="text-[10px] opacity-70">{meta.blurb}</span>
                    </Link>
                  );
                })}
              </div>

              <Link
                href="/how-to-play"
                onClick={() => setMenuOpen(false)}
                className="mt-2 block rounded border-[1.5px] border-accent px-2 py-1.5 text-center text-[12px] font-semibold text-accent-text"
              >
                How to play
              </Link>
            </div>
          )}

      </div>

      {/* Category — the kind of answer, centred under the header band. */}
      <div className="shrink-0 pb-0.5 pt-1 text-center">
        <span
          className="text-[11px] font-semibold uppercase sm:text-[14px]"
          style={{ letterSpacing: '0.18em', color: 'var(--frame-text)' }}
        >
          {puzzle.category}
        </span>
      </div>

      </div>

      {/* Board field — racks wrap in sequence so the phrase reads in order,
          each row centred. */}
      {/* Padding is asymmetric and grows with the row count: a tall board wants
          air under its last rack, separating the puzzle from the tray, and the
          space comes from above rather than from the board itself. */}
      <div
        ref={boardRef}
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3.5"
        style={{ paddingTop: 4, paddingBottom: BOARD_PADDING - 4 }}
      >
        <div className="mx-auto flex w-full max-w-[750px] flex-wrap content-center justify-center gap-x-2 gap-y-2">
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
                  className="text-[14px] sm:text-[19px]"
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
                {/* The target is what the player is aiming at, so it is set
                    larger and lighter than it was — at 9px and half opacity it
                    was the least legible number on the board. */}
                <span className="self-start text-[12px] opacity-85 sm:text-[16px]">
                  /{rack.target}
                </span>
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
      {/* The tray band spans the shell, but its contents are capped and
          centred: a full-width button row reads as a toolbar on a desktop, not
          as part of the game. */}
      <div className="mx-1.5 mb-1.5 shrink-0 bg-tray px-4 pb-2 pt-2 sm:mx-2 sm:mb-2 sm:px-8 sm:pb-4 sm:pt-4">
        <div className="mx-auto flex w-full max-w-[620px] flex-col gap-1.5 sm:gap-4">
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
          <div className="flex gap-2 sm:gap-4">
            <button
              onClick={actions.revealHint}
              disabled={state.hintsUsed >= state.hintsAvailable}
              className="flex-1 rounded-md border-[1.5px] border-accent bg-transparent px-2.5 py-1.5 text-[12px] font-semibold text-accent-text transition-colors hover:bg-[rgba(217,155,127,0.16)] disabled:opacity-40 sm:py-3 sm:text-[15px]"
            >
              Hint
            </button>
            <button
              onClick={() => {
                setShowAnswer(true);
                actions.revealSolution();
              }}
              disabled={state.won || showAnswer}
              className="flex-1 rounded-md border-[1.5px] border-accent bg-transparent px-2.5 py-1.5 text-[12px] font-semibold text-accent-text transition-colors hover:bg-[rgba(217,155,127,0.16)] disabled:opacity-40 sm:py-3 sm:text-[15px]"
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
            className="w-full rounded-md border-[1.5px] border-frame bg-frame px-3 py-2 text-[12px] font-bold uppercase text-frame-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30 sm:py-3.5 sm:text-[15px]"
            style={{ letterSpacing: '0.12em' }}
          >
            Next Puzzle
          </button>
        </div>
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
