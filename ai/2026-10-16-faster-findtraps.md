# Make findTraps about 4x faster

- **Pull request:** #3
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-16
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

About 1 in 200 large mazes took 1 to 3.5 seconds to build, nearly all of it in `findTraps`, which
explores every (cell, keys held) state a player can reach. On a phone that froze the page.

The rewrite keeps states in plain number arrays with one small `Map` per cell, stores a key set as a
number bitmask (BigInt past 30 keys), works out each cell's moves once, and uses a flat incoming-edge
index for the backward walk. The worst maze dropped from 3.5 s to 0.75 s.

The hard requirement was that no maze may change. The search visits states and edges in the same order
as before, so the list of one-way walls comes back in the same order and the random repair picks the same one.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description. It timed the slow seeds to find where the time went before changing anything.

## What Mike did

Asked for the speed-up and merged it.

## Look closely at

Same-order traversal is what keeps mazes identical. The AI compared the full cell data of 4,000 mazes against `main` (0 differences), and a test makes `findTraps` agree with the separate plain checker in `tools/check_mazes_lib.js`. A 40-door corridor test covers the BigInt fallback.
