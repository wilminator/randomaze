# Vary wall, floor and door looks within a maze

- **Pull request:** #11
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-18
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

Each level used one wall image everywhere, floors were a flat colour, and doors were picked at random
per lock, so two locks could look alike. Now about 40% of 3x3 patches use another wall, floors vary in
2x2 patches, and doors are dealt like cards so every look shows before one repeats.

Picks come from a hash of the maze seed and cell position, never from the generator or game random
streams, so looks are the same on every reload and never affect replays.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Asked for more variety and merged it. He later disliked the patchwork result ("random Legos"), which led to the region design in #23.

## Look closely at

Door open styles in existing mazes can look different after this; gameplay is not affected.
