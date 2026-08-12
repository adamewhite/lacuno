# Raw word list sources

Vendored from **BartMassey/wordlists** (MIT), retrieved 2026-08-12:
<https://github.com/BartMassey/wordlists>

These are inputs to the word-list pipeline (SPEC §5). Nothing here ships to the
client as-is — the pipeline derives the two shipped lists from these files.

## Files

| File | Words | Role | License |
|---|---|---|---|
| `enable2k.txt.gz` | 173,528 | Validation dictionary ("big list", SPEC §5.1) | Public Domain |
| `freq.txt.gz` | 60,540 | Commonness ranking for solution vocabulary (SPEC §5.2) | see `README-freq.md` |

Accompanying provenance files: `README-enable2k.txt`, `README-freq.md`,
`LICENSE.txt`.

## Provenance notes

**enable2k** — the Enhanced North American Benchmark LExicon, by Alan Beale and
others, explicitly released into the Public Domain. This is the list SPEC §5
names (the spec calls the source `enable1.txt`; enable2k is the 2000 revision of
the same lexicon). It is a legitimate free alternative to the proprietary
NWL/CSW Scrabble dictionaries, which SPEC §5 forbids shipping.

**freq** — derived from Peter Norvig's 300k-word ngram frequency list, built
from Google's *Web Trillion Word Corpus*. Format is `word<space>count`, ordered
most-frequent-first.

## Deviation from SPEC §5

The spec planned to derive commonness ranking with the Python `wordfreq`
library. `freq.txt` already provides that ranking as a static file, so the
pipeline needs no Python and no runtime dependency — which also removes the main
reason SPEC §7 leaned toward Python for offline tooling. Everything can be
TypeScript. **This is a deviation worth confirming, not a silent substitution.**

Two caveats on using `freq` in place of `wordfreq`:

1. **Web corpus bias.** Counts come from web text, so internet vocabulary is
   over-weighted relative to general English — `click`, `price`, `email`, and
   `video` all rank in the top 20 five-letter words. Fine for difficulty
   tiering (they are genuinely common words), but "frequency" here means *web*
   frequency, not prose or spoken frequency.
2. **Coverage.** 59,658 of 60,540 freq words (98.5%) appear in enable2k. The
   intersection restricted to pure-alphabetic 3–8 letter words is 33,905 — well
   above the 5k–20k solution vocabulary SPEC §5.2 targets, leaving room for the
   inflection ban and hand curation to cut aggressively.

## Regenerating

    curl -sSLO https://raw.githubusercontent.com/BartMassey/wordlists/main/enable2k.txt.gz
    curl -sSLO https://raw.githubusercontent.com/BartMassey/wordlists/main/freq.txt.gz
