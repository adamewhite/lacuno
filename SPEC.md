# LACUNO — Game Specification

Word puzzle. A product of Vitura Studio, sibling to OROBORO.

A *lacuna* is a gap in a text. The player fills the gaps in a phrase.

## 1. Concept

The player is shown a phrase with every letter missing — one rack per word,
read left to right and wrapping like a line of text. Below the board sit two
supplies: five vowel piles, and the phrase's consonants as a scarce rack.

Each rack shows a target: the sum of that word's consonant values. Vowels score
nothing. The player fills the racks until every word is right.

The category above the board ("Idiom", "Place", "Person"…) is the only other
clue.

## 2. Core rules

- **One rack per word**, in reading order.
- **Consonants are scarce.** The player is given exactly the consonants the
  phrase needs — no spares, no decoys. Each carries a point value.
- **Vowels are free and unlimited.** All five piles are always available,
  whether or not the phrase uses them. Restricting the piles to the vowels in
  play would leak which ones are absent.
- **Vowels score zero.** A rack's target is therefore its consonant total, and
  a rack targeting 0 is a word with no consonants at all.
- **Win condition = the phrase.** Unlike a single-word puzzle, where any
  anagram at the right total is legitimately correct, a phrase has exactly one
  intended reading. `CLOD FEET` is not a win.

## 3. Feedback

- **Live rack totals**, updating on every placement. Three states, each with
  non-colour redundancy so the signal does not depend on distinguishing green
  from red:
  - UNDER — neutral, `11 / 18`
  - EXACT — green with a check, `✓18 / 18`
  - OVER — red with an up-arrow, `▲21 / 18`. The overshoot is deliberate
    information; players use it to deduce which tiles cannot belong.
- **Solved board** — every tile takes a glow, rippling left to right across the
  whole phrase. The delay is keyed to each letter's position in the phrase, not
  its rack, so a multi-word answer reads as one sweep rather than several
  simultaneous flashes.
- **Placement** — a tile plays a short overshoot-and-settle when it lands, so a
  drop reads as landing rather than appearing.
- All motion respects `prefers-reduced-motion`.

## 4. Letter values (decided)

Vowels are 0. Consonants:

    R1 S1 T1  D2 L2 N2  C3 G3 M3 P3  B4 H4 Y4  F5 K5 W5  V6 X6 Z6  J7 Q7

Two deliberate properties:

- **Low.** A typical rack targets under 10. The player re-sums a rack on every
  placement, so the size of that sum is a usability cost, not a cosmetic one.
- **Repeated.** Distinct values would make a total nearly identify its word,
  turning the puzzle into arithmetic bookkeeping. Repeated values mean many
  consonant sets share a total, so the player must reason about what actually
  spells a word.

Ordering is roughly by frequency, so the commonest consonants are cheapest.

## 5. Content

Phrases live in `data/phrases.txt`, one per line, with an optional category:

    Idiom | Cold feet
    Person | Marie Curie
    Cold feet              <- no category given, shown as "Phrase"

`npm run build:puzzles` compiles them to `app/puzzles-phrases.json`.

**There is no generator and no solver.** A phrase puzzle cannot be verified by
search: `BEAT AROUND THE BUSH` admits over a thousand legal rack fillings, and
only one of them is a phrase. Curation replaces verification, which means the
phrase list *is* the game's quality.

Current library: 90 phrases — 20 each of Person, Place and Movie, 10 each of
Animal, Object and Idiom. Categories are singular, since each puzzle is one
place or one person, and specific: "Animal" tells a player more than a
catch-all "Thing".

### Content limits

Enforced at build time; an over-limit phrase is skipped with a warning naming
the reason. Set by what fits legibly on the narrowest phone worth supporting
(375 × 667, the iPhone SE) without dropping tiles below about 30px:

| limit | value | why |
|---|---|---|
| consonants | ≤ 16 | the binding one — the rack caps at two rows, and past sixteen those rows only fit by going unreadable |
| letters per word | ≤ 9 | nine renders at 33px tiles; ten drops to 29px, legible but fiddly to tap |
| words | ≤ 5 | rows 1–3 are free, the fourth costs tile size, the fifth exhausts a small screen |

## 6. Difficulty

Four levels, each a route. Same puzzles and same consonant pool throughout;
what varies is how much of the vowel work is done for the player.

| level | route | vowel help |
|---|---|---|
| Standard | `/standard` | every vowel already on the board, all piles disabled |
| Challenging | `/challenging` | one whole vowel pre-filled throughout |
| Difficult | `/difficult` | only the vowels in play are offered |
| Brutal | `/brutal` | nothing given, all five piles live |

A new visitor lands on Standard. Brutal is the original behaviour. Each level
hands over at least as much as the one below it, and a test asserts that
ordering holds.

`Hint` reveals a letter — consonants before vowels, longest word first, since a
consonant is a scarce tile the player must place anyway. `Give Up` fills the
board and drains the rack.

## 7. Layout

The shell is exactly one viewport and never scrolls. `position: fixed` on the
body removes the scroll container entirely, which is what defeats iOS
pull-to-refresh and address-bar shifting — height and `overflow` alone are not
enough there.

Three regions: a fixed header, a fixed tray, and the board flexing between
them. Tiles size themselves so the whole game fits, stepping down only when
they must:

- at most 4 board rows and 2 rack rows
- the racks must fit the measured board region

**The sizing must stay a pure function of the tile size.** The tray's height is
*derived* rather than measured, because measuring it creates a feedback loop —
shrinking the tile shrinks the tray, which frees height, which lets the tile
grow. The board visibly shudders between two sizes. Anything added to the tray
belongs in `trayHeightAt`, not in a measurement.

Input is tap-tile-then-tap-slot, drag, or keyboard. Drag uses pointer events,
not HTML5 drag-and-drop, which mobile browsers do not implement.

## 8. Architecture

- **Frontend:** Next.js, static. `app/PhraseBoard.tsx` renders; `app/usePhrase.ts`
  holds the game state; `app/useDrag.ts` handles pointer dragging.
- **Content pipeline:** `scripts/make-phrase-puzzles.ts`, run offline.
- **Anti-cheat:** the payload currently ships each puzzle's answer in plaintext,
  which is fine for playtesting and **must change before launch** — a shipped
  puzzle should carry a solution hash, or validate server-side.

## 9. Brand

- Vitura Studio credit: footer only, small type.
- Sibling naming grammar with OROBORO: a word clipped to a rhythmic core.
- Tone: literate, a little menacing, ink-and-brass — not bubblegum.

## 10. Open questions

- Daily delivery: one puzzle per day, seeded by date, versus the current
  shuffled deck
- Streaks, and a spoiler-free share artifact
- Whether the difficulty levels ship as-is or collapse once playtesting says
  which one the game actually is
- Solution hashing (see §8)

---

## Appendix: what this replaced

LACUNO began as PROCRO, a different game: a pool of letter tiles, racks with
exact point targets, and a solver that proved each daily puzzle had exactly one
answer. That version is gone, but two of its findings are worth keeping.

**Scrabble's letter values are wrong for a puzzle like this.** Ten common
letters all worth 1 makes totals non-discriminating exactly where English
lives. Measured against a custom scheme, Scrabble produced a publishable puzzle
13% of the time against 50%+.

**Anagrams cannot be separated by any valuation.** Word score is a function of
the letter multiset, so STARE and RATES always share a total. Only positional
information — a multiplier, a pinned letter — can tell them apart. This is why
the phrase, not the arithmetic, has to be what makes a LACUNO answer unique.
