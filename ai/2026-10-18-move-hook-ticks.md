# Move hook, tick layer, and door close and wait

- **Pull request:** #7 (into `staging-combat`)
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-18
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

Combat needs the world to react to each move. `MazePlayer` gets an `onMove(action, result)` hook;
`TickLayer(player, onTick, policy)` counts ticks by move type; dungeon-only actions `C` (close the open
door ahead) and `W` (wait). `replayGame` takes `{dungeon, tickPolicy, onTick}` so the page and server share
one clock. Classic play installs no hook and ignores `C`/`W`.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Designed the combat rules with the AI beforehand (turn-based ticks, door closing) and merged it into `staging-combat`.

## Look closely at

Classic output of `replayGame` must stay the same; the fingerprint test is untouched.
