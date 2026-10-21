# Holes, pits and ropes, and the combat maze type

- **Pull request:** #8 (into `staging-combat`)
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-18
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

`maze.generateHoles(count, pits)` cuts one-way holes and hidden pits, using its own random stream
(`seed:holes`). A hole is the vertical twin of a one-way wall. `findTraps` checks each round and takes
back any hole that would strand the player. Rules: walk around a visible hole safely, `D` drops, a pit
drops you on the spot, `T` ties a rope that makes a hole two-way. New maze type `COMBAT = 4`.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Set the hole and rope rules in the combat design and merged it.

## Look closely at

Classic mazes are byte-identical; a pit is only allowed where the maze still works with that cell as a dead end.
