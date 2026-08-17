'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface PhrasePuzzleData {
  readonly id: string;
  /** Shown under the header as a clue to the kind of answer. */
  readonly category: string;
  readonly racks: readonly { readonly length: number; readonly target: number }[];
  readonly consonants: readonly string[];
  /** Vowels this phrase uses. Unlimited supply, but only these are offered. */
  readonly vowels: readonly string[];
  readonly letterCount: number;
  readonly hints: readonly { readonly rackIndex: number; readonly slot: number; readonly letter: string }[];
  readonly phrase: string;
}

/** Every vowel, for classifying a typed letter. Distinct from the vowels a
 *  given puzzle OFFERS, which is only those its phrase uses. */
const ALL_VOWELS = ['A', 'E', 'I', 'O', 'U'] as const;

/** A consonant tile from the scarce pool. `id` keeps duplicates distinct. */
export interface ConsonantTile {
  readonly id: number;
  readonly letter: string;
  readonly value: number;
}

/** What sits in a slot: a pooled consonant, a free vowel, or nothing. */
export type SlotContent =
  | { readonly kind: 'consonant'; readonly tileId: number; readonly letter: string; readonly value: number }
  | { readonly kind: 'vowel'; readonly letter: string }
  | null;

export interface PhraseRackState {
  readonly length: number;
  readonly target: number;
  readonly slots: readonly SlotContent[];
  readonly locked: readonly boolean[];
  /** Consonant total. Vowels score 0, so this counts only pooled tiles. */
  readonly total: number;
  readonly full: boolean;
  readonly word: string;
}

export interface PhraseState {
  readonly racks: readonly PhraseRackState[];
  /** True once the player has given up and the answer is on the board. */
  readonly revealed: boolean;
  readonly pool: readonly ConsonantTile[];
  readonly selected: { readonly kind: 'consonant'; readonly id: number } | { readonly kind: 'vowel'; readonly letter: string } | null;
  readonly won: boolean;
  readonly hintsUsed: number;
  readonly hintsAvailable: number;
  readonly moves: number;
  readonly vowels: readonly string[];
}

export interface PhraseActions {
  selectConsonant: (id: number) => void;
  selectVowel: (letter: string) => void;
  placeSelected: (rack: number, slot: number) => void;
  placeConsonant: (tileId: number, rack: number, slot: number) => void;
  placeVowel: (letter: string, rack: number, slot: number) => void;
  typeLetter: (rack: number, letter: string, at?: number) => boolean;
  clearSlot: (rack: number, slot: number) => void;
  backspace: (rack: number, at?: number) => void;
  clearAll: () => void;
  revealHint: () => void;
  /** Fill the whole board with the answer and empty the rack. */
  revealSolution: () => void;
}

/**
 * Game logic for a phrase puzzle.
 *
 * Two supplies, deliberately different in kind:
 *   - CONSONANTS are scarce tiles drawn from a shared pool, so placing one in
 *     the wrong rack denies it to another. This is what remains of the
 *     original game's tile-competition mechanic.
 *   - VOWELS are unlimited. They score 0 and can be typed or tapped freely,
 *     because the phrase — not vowel scarcity — is what makes the answer
 *     unique.
 *
 * Unlike the word game, the win check DOES compare against the stored phrase.
 * There, any anagram at the right total was a legitimate answer, so comparing
 * to a stored word would have been wrong (SPEC §2). Here the puzzle has one
 * intended reading and a rearrangement of the same letters is not a win.
 */
export function usePhrase(
  puzzle: PhrasePuzzleData,
  values: readonly number[],
): [PhraseState, PhraseActions] {
  const tiles = useMemo<ConsonantTile[]>(
    () =>
      puzzle.consonants.map((letter, id) => ({
        id,
        letter,
        value: values[letter.charCodeAt(0) - 65] ?? 0,
      })),
    [puzzle, values],
  );

  /** contents[rack][slot] — the board itself. */
  const [contents, setContents] = useState<SlotContent[][]>(() =>
    puzzle.racks.map((r) => new Array<SlotContent>(r.length).fill(null)),
  );
  const [selected, setSelected] = useState<PhraseState['selected']>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [moves, setMoves] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setContents(puzzle.racks.map((r) => new Array<SlotContent>(r.length).fill(null)));
    setSelected(null);
    setHintsUsed(0);
    setMoves(0);
    setRevealed(false);
  }, [puzzle]);

  /** Slots fixed by a revealed hint — or every slot, once the answer is shown. */
  const lockedSlots = useMemo(() => {
    const set = new Set<string>();
    if (revealed) {
      puzzle.racks.forEach((rack, rackIndex) => {
        for (let slot = 0; slot < rack.length; slot++) set.add(`${rackIndex}:${slot}`);
      });
      return set;
    }
    for (const hint of puzzle.hints.slice(0, hintsUsed)) {
      set.add(`${hint.rackIndex}:${hint.slot}`);
    }
    return set;
  }, [puzzle, hintsUsed, revealed]);

  const usedTileIds = useMemo(() => {
    const set = new Set<number>();
    for (const rack of contents) {
      for (const slot of rack) {
        if (slot?.kind === 'consonant') set.add(slot.tileId);
      }
    }
    return set;
  }, [contents]);

  const pool = useMemo(
    () =>
      tiles
        .filter((t) => !usedTileIds.has(t.id))
        .sort((a, b) => a.value - b.value || a.letter.localeCompare(b.letter)),
    [tiles, usedTileIds],
  );

  const racks = useMemo<PhraseRackState[]>(
    () =>
      puzzle.racks.map((rack, rackIndex) => {
        const slots = contents[rackIndex] ?? new Array(rack.length).fill(null);
        const total = slots.reduce((sum, s) => sum + (s?.kind === 'consonant' ? s.value : 0), 0);
        return {
          length: rack.length,
          target: rack.target,
          slots,
          locked: slots.map((_, slot) => lockedSlots.has(`${rackIndex}:${slot}`)),
          total,
          full: slots.every((s) => s !== null),
          word: slots.map((s) => s?.letter ?? '').join(''),
        };
      }),
    [puzzle, contents, lockedSlots],
  );

  const won = racks.every((r) => r.full) && racks.map((r) => r.word).join(' ') === puzzle.phrase;

  /** Write to a slot, returning whatever it displaced to the pool implicitly. */
  const write = useCallback(
    (rack: number, slot: number, content: SlotContent) => {
      if (lockedSlots.has(`${rack}:${slot}`)) return;
      setContents((current) => {
        const next = current.map((r) => [...r]);
        if (!next[rack] || slot >= next[rack].length) return current;
        next[rack][slot] = content;
        return next;
      });
      setMoves((m) => m + 1);
      setSelected(null);
    },
    [lockedSlots],
  );

  const placeConsonant = useCallback(
    (tileId: number, rack: number, slot: number) => {
      const tile = tiles[tileId];
      if (!tile) return;
      setContents((current) => {
        if (lockedSlots.has(`${rack}:${slot}`)) return current;
        const next = current.map((r) => [...r]);
        // A consonant tile is scarce: remove it from wherever it already sits.
        for (const r of next) {
          for (let i = 0; i < r.length; i++) {
            const s = r[i];
            if (s?.kind === 'consonant' && s.tileId === tileId) r[i] = null;
          }
        }
        next[rack][slot] = { kind: 'consonant', tileId, letter: tile.letter, value: tile.value };
        return next;
      });
      setMoves((m) => m + 1);
      setSelected(null);
    },
    [tiles, lockedSlots],
  );

  const placeVowel = useCallback(
    (letter: string, rack: number, slot: number) => {
      // Vowels are unlimited, so this never has to reclaim one.
      write(rack, slot, { kind: 'vowel', letter });
    },
    [write],
  );

  const placeSelected = useCallback(
    (rack: number, slot: number) => {
      if (!selected) return;
      if (selected.kind === 'consonant') placeConsonant(selected.id, rack, slot);
      else placeVowel(selected.letter, rack, slot);
    },
    [selected, placeConsonant, placeVowel],
  );

  const typeLetter = useCallback(
    (rack: number, letter: string, at?: number): boolean => {
      const upper = letter.toUpperCase();
      const rackLength = puzzle.racks[rack]?.length ?? 0;

      let target = at ?? -1;
      if (target < 0 || target >= rackLength || lockedSlots.has(`${rack}:${target}`)) {
        target = -1;
        for (let slot = 0; slot < rackLength; slot++) {
          if (lockedSlots.has(`${rack}:${slot}`)) continue;
          if (!contents[rack]?.[slot]) {
            target = slot;
            break;
          }
        }
      }
      if (target < 0) return false;

      if ((ALL_VOWELS as readonly string[]).includes(upper)) {
        // Every vowel is placeable, whether or not the phrase uses it —
        // rejecting an unused vowel would reveal that it is absent. A wrong
        // vowel simply leaves the rack unsolved.
        placeVowel(upper, rack, target);
        return true;
      }

      // Consonants must come from the pool; typing one we do not have is a
      // rejection the UI should show rather than swallow.
      const free = tiles.find((t) => t.letter === upper && !usedTileIds.has(t.id));
      if (!free) return false;
      placeConsonant(free.id, rack, target);
      return true;
    },
    [puzzle, contents, lockedSlots, tiles, usedTileIds, placeVowel, placeConsonant],
  );

  const clearSlot = useCallback(
    (rack: number, slot: number) => {
      if (lockedSlots.has(`${rack}:${slot}`)) return;
      setContents((current) => {
        const next = current.map((r) => [...r]);
        if (!next[rack]?.[slot]) return current;
        next[rack][slot] = null;
        return next;
      });
      setMoves((m) => m + 1);
    },
    [lockedSlots],
  );

  const backspace = useCallback(
    (rack: number, at?: number) => {
      const rackLength = puzzle.racks[rack]?.length ?? 0;
      const tryClear = (slot: number): boolean => {
        if (slot < 0 || slot >= rackLength) return false;
        if (lockedSlots.has(`${rack}:${slot}`)) return false;
        if (!contents[rack]?.[slot]) return false;
        clearSlot(rack, slot);
        return true;
      };

      if (at !== undefined) {
        if (tryClear(at - 1)) return;
        tryClear(at);
        return;
      }
      for (let slot = rackLength - 1; slot >= 0; slot--) {
        if (tryClear(slot)) return;
      }
    },
    [puzzle, contents, lockedSlots, clearSlot],
  );

  const clearAll = useCallback(() => {
    setContents((current) =>
      current.map((rack, rackIndex) =>
        rack.map((slot, slotIndex) =>
          lockedSlots.has(`${rackIndex}:${slotIndex}`) ? slot : null,
        ),
      ),
    );
    setSelected(null);
  }, [lockedSlots]);

  const revealHint = useCallback(() => {
    const hint = puzzle.hints[hintsUsed];
    if (!hint) return;

    setContents((current) => {
      const next = current.map((r) => [...r]);
      if (isVowel(hint.letter)) {
        next[hint.rackIndex][hint.slot] = { kind: 'vowel', letter: hint.letter };
      } else {
        // Take a matching tile, preferring a free one; otherwise reclaim it.
        const used = new Set<number>();
        for (const r of next) {
          for (const s of r) if (s?.kind === 'consonant') used.add(s.tileId);
        }
        let tile = tiles.find((t) => t.letter === hint.letter && !used.has(t.id));
        if (!tile) tile = tiles.find((t) => t.letter === hint.letter);
        if (tile) {
          for (const r of next) {
            for (let i = 0; i < r.length; i++) {
              const s = r[i];
              if (s?.kind === 'consonant' && s.tileId === tile.id) r[i] = null;
            }
          }
          next[hint.rackIndex][hint.slot] = {
            kind: 'consonant',
            tileId: tile.id,
            letter: tile.letter,
            value: tile.value,
          };
        }
      }
      return next;
    });

    setHintsUsed((n) => n + 1);
    setSelected(null);
  }, [puzzle, hintsUsed, tiles]);

  /**
   * Give up: write the answer onto the board and empty the rack.
   *
   * Consonants are matched to real pool tiles so the rack drains exactly as it
   * would have if the player had placed them; vowels are free, as always. Every
   * slot then locks, since there is nothing left to change.
   */
  const revealSolution = useCallback(() => {
    const words = puzzle.phrase.split(' ');
    const taken = new Set<number>();

    setContents(
      words.map((word) =>
        [...word].map((letter): SlotContent => {
          if (isVowel(letter)) return { kind: 'vowel', letter };
          const tile = tiles.find((t) => t.letter === letter && !taken.has(t.id));
          if (!tile) return { kind: 'vowel', letter }; // unreachable for a well-formed puzzle
          taken.add(tile.id);
          return {
            kind: 'consonant',
            tileId: tile.id,
            letter: tile.letter,
            value: tile.value,
          };
        }),
      ),
    );

    setRevealed(true);
    setSelected(null);
  }, [puzzle, tiles]);

  const selectConsonant = useCallback((id: number) => {
    setSelected((c) => (c?.kind === 'consonant' && c.id === id ? null : { kind: 'consonant', id }));
  }, []);

  const selectVowel = useCallback((letter: string) => {
    setSelected((c) => (c?.kind === 'vowel' && c.letter === letter ? null : { kind: 'vowel', letter }));
  }, []);

  return [
    {
      racks,
      pool,
      selected,
      won,
      hintsUsed,
      hintsAvailable: puzzle.hints.length,
      moves,
      revealed,
      vowels: puzzle.vowels,
    },
    {
      selectConsonant,
      selectVowel,
      placeSelected,
      placeConsonant,
      placeVowel,
      typeLetter,
      clearSlot,
      backspace,
      clearAll,
      revealHint,
      revealSolution,
    },
  ];
}

function isVowel(letter: string): boolean {
  return (ALL_VOWELS as readonly string[]).includes(letter);
}
