'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface PuzzleData {
  readonly id: string;
  readonly tiles: readonly string[];
  /** Present on zero-vowels puzzles: the pool split for display. */
  readonly vowels?: readonly string[];
  readonly consonants?: readonly string[];
  readonly racks: readonly { readonly length: number; readonly target: number }[];
  readonly pins: readonly { readonly rackIndex: number; readonly slot: number; readonly letter: string }[];
  readonly solution: readonly string[];
  readonly searchSpace: readonly number[];
}

/** A tile in the pool. `id` is stable so duplicate letters stay distinguishable. */
export interface Tile {
  readonly id: number;
  readonly letter: string;
  readonly value: number;
}

/** Where a tile currently sits: the pool, or a specific rack slot. */
type Placement = { readonly rack: number; readonly slot: number } | null;

export interface RackState {
  readonly target: number;
  readonly length: number;
  /** Tile in each slot, or null for empty. */
  readonly slots: readonly (Tile | null)[];
  /** Slots locked by a revealed hint — the tile cannot be removed. */
  readonly pinned: readonly boolean[];
  readonly total: number;
  readonly full: boolean;
  /** Exact total AND a valid dictionary word: the glow condition (SPEC §3). */
  readonly solved: boolean;
  readonly word: string;
}

export interface PuzzleState {
  readonly tiles: readonly Tile[];
  /** Tiles not yet placed, in pool order. */
  readonly pool: readonly Tile[];
  /** Zero-value tiles, shown as their own stack above the scoring ones. */
  readonly vowelPool: readonly Tile[];
  /** Scoring tiles. Equals `pool` when the puzzle has no vowel split. */
  readonly consonantPool: readonly Tile[];
  /** True when this puzzle displays vowels separately. */
  readonly splitPool: boolean;
  readonly racks: readonly RackState[];
  readonly selectedTileId: number | null;
  readonly won: boolean;
  readonly hintsUsed: number;
  readonly hintsAvailable: number;
  readonly moves: number;
  /** True when the player has shuffled out of the default sorted order. */
  readonly shuffled: boolean;
}

export interface PuzzleActions {
  selectTile: (id: number) => void;
  placeSelected: (rack: number, slot: number) => void;
  /** Place a specific tile — the drag-and-drop path, where there is no selection. */
  placeTile: (tileId: number, rack: number, slot: number) => void;
  /**
   * Type a letter into `rack` at slot `at` (the caret), or the first free slot
   * when no caret is given. Returns false when no matching tile is available,
   * so the caller can signal the rejection.
   */
  typeLetter: (rack: number, letter: string, at?: number) => boolean;
  /** Delete backwards from the caret, or the last placed tile if none. */
  backspace: (rack: number, at?: number) => void;
  /** First writable slot at or after `from`, or -1. Used to advance the caret. */
  nextWritableSlot: (rack: number, from: number) => number;
  /** Send a tile back to the pool — the drag-out-of-a-rack path. */
  returnTile: (tileId: number) => void;
  clearSlot: (rack: number, slot: number) => void;
  returnAll: () => void;
  revealHint: () => void;
  shufflePool: () => void;
  sortPool: () => void;
}

/**
 * All the game logic for one puzzle.
 *
 * The win condition is CONSTRAINT SATISFACTION, never comparison against the
 * stored answer (SPEC §2): a rack is solved when it holds a dictionary word at
 * the exact target. Any anagram of the intended word is equally correct, and
 * the hook never looks at `puzzle.solution`.
 */
export function usePuzzle(
  puzzle: PuzzleData,
  values: readonly number[],
  dictionary: ReadonlySet<string> | null,
): [PuzzleState, PuzzleActions] {
  const tiles = useMemo<Tile[]>(
    () =>
      puzzle.tiles.map((letter, id) => ({
        id,
        letter,
        value: values[letter.charCodeAt(0) - 65] ?? 0,
      })),
    [puzzle, values],
  );

  // placements[tileId] = where that tile sits. The single source of truth;
  // pool and racks are both derived from it.
  const [placements, setPlacements] = useState<Placement[]>(() => tiles.map(() => null));
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [moves, setMoves] = useState(0);
  const [poolOrder, setPoolOrder] = useState<number[]>(() => tiles.map((t) => t.id));
  // While false the pool stays sorted by value; shuffling opts out of that.
  const [shuffled, setShuffled] = useState(false);

  // Reset when the puzzle changes.
  useEffect(() => {
    setPlacements(tiles.map(() => null));
    setSelectedTileId(null);
    setHintsUsed(0);
    setMoves(0);
    setPoolOrder(tiles.map((t) => t.id));
    setShuffled(false);
  }, [tiles]);

  /** Slots locked by revealed hints, as "rack:slot" keys. */
  const pinnedSlots = useMemo(() => {
    const set = new Set<string>();
    for (const pin of puzzle.pins.slice(0, hintsUsed)) {
      set.add(`${pin.rackIndex}:${pin.slot}`);
    }
    return set;
  }, [puzzle, hintsUsed]);

  const racks = useMemo<RackState[]>(() => {
    return puzzle.racks.map((rack, rackIndex) => {
      const slots: (Tile | null)[] = new Array(rack.length).fill(null);
      placements.forEach((placement, tileId) => {
        if (placement && placement.rack === rackIndex) {
          slots[placement.slot] = tiles[tileId];
        }
      });

      const total = slots.reduce((sum, tile) => sum + (tile?.value ?? 0), 0);
      const full = slots.every((s) => s !== null);
      const word = slots.map((s) => s?.letter ?? '').join('');
      const solved =
        full && total === rack.target && (dictionary ? dictionary.has(word) : false);

      return {
        target: rack.target,
        length: rack.length,
        slots,
        pinned: slots.map((_, slot) => pinnedSlots.has(`${rackIndex}:${slot}`)),
        total,
        full,
        solved,
        word,
      };
    });
  }, [puzzle, placements, tiles, dictionary, pinnedSlots]);

  const pool = useMemo(() => {
    const available = poolOrder
      .map((id) => tiles[id])
      .filter((tile) => tile && placements[tile.id] === null);

    // Default order: cheapest first, alphabetical within a value. Grouping by
    // value puts the arithmetic front and centre — a player scanning for "what
    // adds up to 4" sees the 0s and 1s together rather than hunting.
    if (!shuffled) {
      available.sort(
        (a, b) => a.value - b.value || a.letter.localeCompare(b.letter),
      );
    }
    return available;
  }, [poolOrder, tiles, placements, shuffled]);

  // Zero-vowels puzzles show the free letters in their own stack. The counts
  // are exact either way — this is a display split, not a rules change.
  const splitPool = Boolean(puzzle.vowels);
  const VOWEL_LETTERS = new Set(['A', 'E', 'I', 'O', 'U']);
  const vowelPool = useMemo(
    () => (splitPool ? pool.filter((t) => VOWEL_LETTERS.has(t.letter)) : []),
    [pool, splitPool],
  );
  const consonantPool = useMemo(
    () => (splitPool ? pool.filter((t) => !VOWEL_LETTERS.has(t.letter)) : pool),
    [pool, splitPool],
  );

  const won = racks.length > 0 && racks.every((r) => r.solved) && pool.length === 0;

  const selectTile = useCallback((id: number) => {
    setSelectedTileId((current) => (current === id ? null : id));
  }, []);

  /** Shared by every placement path: tap, drag, and typing. */
  const placeTile = useCallback(
    (tileId: number, rack: number, slot: number) => {
      if (pinnedSlots.has(`${rack}:${slot}`)) return;

      setPlacements((current) => {
        const next = [...current];

        // Whatever was in the target slot goes back to the pool.
        const occupantId = next.findIndex(
          (p) => p !== null && p.rack === rack && p.slot === slot,
        );
        if (occupantId >= 0) next[occupantId] = null;

        next[tileId] = { rack, slot };
        return next;
      });
      setMoves((m) => m + 1);
      setSelectedTileId(null);
    },
    [pinnedSlots],
  );

  const placeSelected = useCallback(
    (rack: number, slot: number) => {
      if (selectedTileId === null) return;
      placeTile(selectedTileId, rack, slot);
    },
    [selectedTileId, placeTile],
  );

  /** First slot at or after `from` that is free and not pinned, else -1. */
  const nextWritableSlot = useCallback(
    (rack: number, from: number): number => {
      const rackLength = puzzle.racks[rack]?.length ?? 0;
      for (let slot = Math.max(0, from); slot < rackLength; slot++) {
        if (pinnedSlots.has(`${rack}:${slot}`)) continue;
        const occupied = placements.some((p) => p && p.rack === rack && p.slot === slot);
        if (!occupied) return slot;
      }
      return -1;
    },
    [puzzle, placements, pinnedSlots],
  );

  /**
   * Type a letter at the caret, drawing a matching tile from the pool.
   *
   * The caret is where the player last clicked, so typing fills THAT slot
   * rather than always restarting at the beginning of the rack. It then
   * advances past any pinned or filled slots, so a run of letters lands where
   * you would expect. Overwrites whatever is in the slot, matching how a text
   * field behaves when you click into the middle of it.
   *
   * Returns false when no matching tile is free, so the UI can reject the
   * keystroke visibly rather than swallowing it.
   */
  const typeLetter = useCallback(
    (rack: number, letter: string, at?: number): boolean => {
      const upper = letter.toUpperCase();
      const rackLength = puzzle.racks[rack]?.length ?? 0;

      // Start at the caret if it points somewhere writable; otherwise fall
      // forward to the next free slot.
      let target = at ?? -1;
      const caretUsable =
        target >= 0 && target < rackLength && !pinnedSlots.has(`${rack}:${target}`);
      if (!caretUsable) target = nextWritableSlot(rack, 0);
      if (target < 0) return false;

      const tile = tiles.find((t) => t.letter === upper && placements[t.id] === null);
      if (!tile) return false;

      placeTile(tile.id, rack, target);
      return true;
    },
    [puzzle, placements, pinnedSlots, tiles, placeTile, nextWritableSlot],
  );

  /**
   * Delete backwards from the caret, like a text field: clear the slot before
   * the caret, or the caret's own slot when it is the last position.
   */
  const backspace = useCallback(
    (rack: number, at?: number) => {
      const rackLength = puzzle.racks[rack]?.length ?? 0;

      const clear = (slot: number): boolean => {
        if (slot < 0 || slot >= rackLength) return false;
        if (pinnedSlots.has(`${rack}:${slot}`)) return false;
        const tileId = placements.findIndex(
          (p) => p !== null && p.rack === rack && p.slot === slot,
        );
        if (tileId < 0) return false;
        setPlacements((current) => {
          const next = [...current];
          next[tileId] = null;
          return next;
        });
        setMoves((m) => m + 1);
        return true;
      };

      if (at !== undefined) {
        // The slot before the caret, then the caret itself.
        if (clear(at - 1)) return;
        if (clear(at)) return;
        return;
      }

      // No caret: clear the last filled slot.
      for (let slot = rackLength - 1; slot >= 0; slot--) {
        if (clear(slot)) return;
      }
    },
    [puzzle, placements, pinnedSlots],
  );

  const clearSlot = useCallback(
    (rack: number, slot: number) => {
      // Glowing racks never lock (SPEC §3) — only revealed hints do.
      if (pinnedSlots.has(`${rack}:${slot}`)) return;

      setPlacements((current) => {
        const tileId = current.findIndex(
          (p) => p !== null && p.rack === rack && p.slot === slot,
        );
        if (tileId < 0) return current;
        const next = [...current];
        next[tileId] = null;
        return next;
      });
      setMoves((m) => m + 1);
    },
    [pinnedSlots],
  );

  const returnTile = useCallback(
    (tileId: number) => {
      setPlacements((current) => {
        const placement = current[tileId];
        if (!placement) return current;
        // A hinted tile stays where it is.
        if (pinnedSlots.has(`${placement.rack}:${placement.slot}`)) return current;
        const next = [...current];
        next[tileId] = null;
        return next;
      });
      setSelectedTileId(null);
    },
    [pinnedSlots],
  );

  const returnAll = useCallback(() => {
    setPlacements((current) =>
      current.map((placement, tileId) => {
        if (!placement) return null;
        // Hinted tiles stay put.
        return pinnedSlots.has(`${placement.rack}:${placement.slot}`) ? placement : null;
      }),
    );
    setSelectedTileId(null);
  }, [pinnedSlots]);

  const revealHint = useCallback(() => {
    const pin = puzzle.pins[hintsUsed];
    if (!pin) return;

    setPlacements((current) => {
      const next = [...current];

      // Free the target slot.
      const occupantId = next.findIndex(
        (p) => p !== null && p.rack === pin.rackIndex && p.slot === pin.slot,
      );
      if (occupantId >= 0) next[occupantId] = null;

      // Prefer a matching tile already in the pool; otherwise take one from
      // wherever it sits, so a hint always lands.
      let tileId = tiles.findIndex((t) => t.letter === pin.letter && next[t.id] === null);
      if (tileId < 0) {
        tileId = tiles.findIndex((t) => t.letter === pin.letter);
      }
      if (tileId >= 0) next[tileId] = { rack: pin.rackIndex, slot: pin.slot };

      return next;
    });

    setHintsUsed((n) => n + 1);
    setSelectedTileId(null);
  }, [puzzle, hintsUsed, tiles]);

  const shufflePool = useCallback(() => {
    setShuffled(true);
    setPoolOrder((order) => {
      const next = [...order];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
  }, []);

  /** Restore the default value-ascending, then-alphabetical order. */
  const sortPool = useCallback(() => setShuffled(false), []);

  return [
    {
      tiles,
      pool,
      vowelPool,
      consonantPool,
      splitPool,
      racks,
      selectedTileId,
      won,
      hintsUsed,
      hintsAvailable: puzzle.pins.length,
      moves,
      shuffled,
    },
    {
      selectTile,
      placeSelected,
      placeTile,
      typeLetter,
      backspace,
      nextWritableSlot,
      returnTile,
      clearSlot,
      returnAll,
      revealHint,
      shufflePool,
      sortPool,
    },
  ];
}
