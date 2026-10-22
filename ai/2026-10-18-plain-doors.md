# Add plain (keyless) doors to the generator

- **Pull request:** #6
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-18
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

The rules already allowed a door that needs no key (a side of `1`), but the generator never placed
one and the UI crashed drawing one. The combat design wants keyless doors that can be closed behind
you, and they are useful to the core game too, so this went to `main`.

`maze.generatePlainDoors(count)` picks open two-way passages (never one-way walls or entrances) with its
own random stream (`${seed}:plainDoors`), so it can't move any wall, key or locked door. Plain doors can't
make a maze unsolvable because the player always holds key 1. The UI gets its own door style for them.
Nothing calls it by default, so classic mazes are unchanged.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Asked for plain doors as part of the combat design and decided they belong on `main`. Whether classic daily mazes get them was left as his call (later answered by the features switchboard, #22).

## Look closely at

The separate random stream is the important idea: it is how a feature can be added without changing existing mazes.
