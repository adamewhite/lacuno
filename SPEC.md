# PROCRO — Game Specification

Daily word-deduction puzzle. A product of Vitura Studio, sibling to OROBORO.
Live at: playprocro.com (planned)

## 1. Concept

Player receives a fixed pool of letter tiles and a set of empty racks.
Each rack's length equals the length of one solution word. Each rack has
a target point total. The player must place ALL tiles into the racks such
that every rack contains a valid word AND hits its exact point total.

Each daily puzzle has EXACTLY ONE solution (verified at generation time
against the dictionary — see §5). Boards that fail this gate are
discarded and regenerated; they never reach a player.

Name derives from Procrustes (the mythic bandit whose iron bed victims
were stretched or cut to fit exactly). The racks are Procrustean beds
for words. Myth may be used as flavor/antagonist framing ("Procrustes
is not satisfied") but the game name is PROCRO.

## 2. Core rules

- All tiles must be used. No leftovers, no unused rack slots.
- Rack lengths are visible and fixed (they telegraph word lengths).
- Each rack displays its target total at all times.
- Each rack may contain positional multiplier slots (e.g., 2× letter
  score on slot 3). Multipliers are essential, not decorative: they
  break anagram ties (STARE vs RATES score differently) and enable
  uniqueness. Placement varies per puzzle.
- Tiles show their letter and point value on their face.
- Win condition = constraint satisfaction, NOT answer matching. Accept
  any configuration where every rack holds a valid word at the exact
  total using all tiles. (Uniqueness verification at generation time
  means this coincides with the intended answer — but the engine must
  never hard-compare against a stored answer.)

## 3. Feedback model (decided)

Three escalating tiers:

1. **Live rack totals** — always visible, updating on every placement.
   Three number states, each with non-color redundancy (icon/weight):
   - UNDER target: neutral (e.g., "11 / 18")
   - EXACT: success state with checkmark
   - OVER: distinct warning state with up-arrow; show the magnitude
     (overshoot amount is deliberate information — players use it to
     deduce which tiles don't belong)
2. **Rack glow** — fires when a rack satisfies BOTH exact total AND
   valid word (checked against the dictionary, client-side).
   - Debounce ~400ms so mid-shuffle coincidences don't flash.
   - Glowing racks NEVER lock. Tiles remain freely removable, no
     confirmation friction. False summits (locally-valid racks that
     are globally wrong because they steal a tile a sibling rack
     needs) are an intentional, core difficulty mechanic.
   - On glow loss: soft fade, not a snap. Optionally retain a faint
     "was solved" marker (thin underline) as memory aid.
3. **Full-board celebration** — all racks glow + all tiles consumed.
   Visually distinct from and bigger than rack glow.

## 4. Tile values (decided: custom, NOT Scrabble's)

Scrabble values are frequency-compensation for a different game; ten
common letters all worth 1 point make totals non-discriminating exactly
where English lives. PROCRO values exist to make totals an information
channel (a checksum).

- Design goal: maximize "sum entropy" — minimize same-length word pairs
  that collide on identical totals.
- High-frequency letters need the MOST value differentiation (they do
  the discriminating work). Rare letters (J,Q,X,Z) are nearly free
  parameters.
- Preserve rough intuitive ordering (rare letters worth more) but exact
  numbers are chosen empirically: generate candidate schemes, measure
  first-try uniqueness rate of the puzzle generator under each, pick
  the winner. (See §6 — the solver doubles as the evaluation harness.)
- Values are FIXED forever once chosen (players build fluency over
  weeks; deduction skill compounds). One-time offline optimization.
- Letter frequency reference should be computed from the actual word
  list (dictionary frequency), NOT running-text frequency. Expect S, R,
  C, L to rank higher and H, W lower than the classic prose table.

## 5. Dictionary (decided: ONE dictionary)

1. **Dictionary = 2of12inf + delta file.**
   - Base: the `2of12inf` list from the 12dicts package
     (source: http://wordlist.aspell.net/12dicts/, ~81k words,
     inflections included). Built by intersecting twelve source
     dictionaries and keeping words appearing in at least two — a junk
     filter by lexicographic consensus.
   - Delta file (`data/delta.txt`): our own curated additions/removals,
     applied to the base at build time. Nobody ever edits the base file.
   - This ONE dictionary is used for BOTH:
     a) client-side word validation (does this rack glow?), and
     b) generator-side uniqueness verification.
   - Same list, same version, both places. One source of truth.

2. **ENABLE is not used.** A word outside our dictionary cannot form an
   alternate solution, because the game itself will not accept it. The
   dictionary defines what a solution is.

3. **Solution vocabulary** — the words puzzles are BUILT from: a
   frequency-filtered subset of this same dictionary (~5k–20k common
   words, tiered by frequency for difficulty ramping, Monday = top tier).
   A strict subset: puzzles are built from common words but may be
   solved with any dictionary word.
   - Optional ban on -S plurals and -ED/-ING inflections as SOLUTION
     words (they remain valid to spell either way). Defaults OFF —
     revisit after playing one on paper (§11.5).

4. **Drift guard:** any change to the base list or the delta file
   re-triggers uniqueness re-verification of all unpublished puzzles in
   the queue. Each puzzle stores the hash of the dictionary version it
   was verified against. A word added later must never retroactively
   create a second solution.

5. **Licensing:** 12dicts is public-domain-grade; the compiler requests
   acknowledgment. The 12dicts README ships verbatim in the repo
   (`data/raw/12dicts-ReadMe.html`), and the game's About/footer carries:
   "Word list based on 12dicts by Alan Beale."

**If a player's obscure-but-real word isn't recognized:** correct
behavior, not a bug. FAQ line: "PROCRO uses a dictionary of common
English words."

## 6. The solver (build this FIRST — it is the whole engine)

One core function serving four roles: uniqueness validator, puzzle
generator (run backwards), difficulty grader, tile-value optimizer.

    solve(tiles, racks, dictionary) -> [solutions]
    # rack = (length, target_total, multipliers)

Algorithm:

- Per rack, filter dictionary: length match → multiset containment
  against tile pool (Counter/26-int array) → exact score under that
  rack's multipliers. Constraints prune ~82k to dozens per rack.
- Backtracking across racks: choose candidate, subtract letters,
  recurse; branches that consume the pool exactly are solutions.
- Order racks by fewest candidates first. Do not optimize beyond that;
  exhaustiveness IS the correctness guarantee. Milliseconds at scale.

Generation pipeline:

1. Pick 2–4 words from solution vocabulary (tier per target difficulty).
2. Pool their tiles; place multipliers; compute rack targets.
3. Run solve() against the dictionary (§5) — the same list the client
   validates against.
4. len(solutions) == 1 → publish candidate. Else: repair (nudge a
   multiplier, swap a word — the alternate solution's diff says which)
   or regenerate. Roughly half of random boards pass first try, so
   retries are cheap.

Difficulty proxy: per-rack candidate count before applying the total
constraint (search-space size). Grade puzzles objectively; schedule
easy→hard across the week.

## 7. Architecture

- **Frontend:** Next.js (this repo, create-next-app). Daily puzzle is a
  static JSON blob. Client-side: rendering, interaction, live totals,
  glow validation against the shipped dictionary.
- **Offline tooling:** generator/solver as TypeScript scripts in this
  repo (`lib/`, `scripts/`), run via tsx. Single-language codebase: the
  same solver serves offline generation and client-side glow checks, so
  there is only one implementation to keep correct. Commonness ranking
  comes from a static frequency list, not a runtime library.
- **Anti-cheat:** the validation dictionary shipping client-side is
  fine; the daily SOLUTION must not sit in the client payload in
  plaintext. Validate final submission server-side or ship only a
  solution hash. Leaderboard/streak integrity depends on this.
- **Puzzle format (sketch):**

  {
  "id": "2026-08-12",
  "dictVersion": "<hash>",
  "tiles": ["G","L","O","W", ...],
  "racks": [
  { "length": 5, "target": 18, "multipliers": {"2": 2} },
  { "length": 4, "target": 9 }
  ],
  "solutionHash": "<hash>"
  }

## 8. UX decisions

- Live totals: yes (decided). The arithmetic deduction is the fun;
  never make players do mental math against hidden state.
- Input model: OPEN — tap-tile-then-tap-slot vs drag-and-drop.
  Leaning tap-tap for mobile forgiveness; prototype both.
- Tiles ~44px minimum touch targets.
- All state signals need non-color redundancy (color-blind safe).
- Share artifact: OPEN — spoiler-free, braggable; carries
  playprocro.com; candidates: move count, time, rack-solve order.
  Design early, not bolted on. Aesthetic: ink/myth, not confetti.

## 9. Brand context

- Vitura Studio credit: footer only, "from Vitura Studio," small type.
  Games-forward; no "Vitura Games" sub-brand at current scale.
- Sibling naming grammar with OROBORO: myth clipped to rhythmic core
  (no PROCROS — the S breaks the pattern, the rhythm, and the hearing
  test). URL grammar: play\_\_\_\_.com.
- Cross-link OROBORO ↔ PROCRO from day one (SEO cold-start for PROCRO
  is muddy against ProGame/PROcru noise).
- Tone: literate, a little menacing, ink-and-brass — not bubblegum.

## 10. Open questions (do not resolve unilaterally — ask)

- Final tile valuation numbers (pending solver-based optimization)
- Input model (tap-tap vs drag)
- Share artifact format
- Number of racks per puzzle (2–4 assumed) and tile pool sizes
- Whether glow-loss "ember" memory aid ships in v1
- Server-side submission validation vs solution-hash-only approach

## 11. Build order

1. Solver core (solve function + tests against hand-built cases)
2. Dictionary pipeline (2of12inf + delta, frequency tiering, ban-list rules)
3. Valuation harness (compare schemes by generator uniqueness rate)
4. Generator with repair loop + difficulty grading
5. Print candidate puzzles to terminal; PLAY ONE ON PAPER before any UI
6. Frontend: board, tiles, totals, glow states
7. Daily delivery, streaks, share artifact
