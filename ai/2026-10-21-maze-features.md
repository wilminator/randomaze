# Optional maze features (plain doors), off by default

- **Pull request:** #22
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-21
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

A switchboard so a future mode, such as the Explorer maze, can turn on extras without touching any
classic maze. `new MazeParameters(type, seed, features = {})`: every feature defaults to off.
`features.plainDoors` draws a count (8 to 20) from a separate stream, `${seed}:features`, so every
classic number stays the same. `buildMaze(params)` is now the one place that builds a maze, so the site,
the server replay and the demo apply a feature the same way.

Which day gets which features is decided by the server, never the browser.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Wanted a quiet beta switch that can never touch the free daily mazes; set that as the rule and merged it.

## Look closely at

`test/fingerprint.test.js` is unchanged and passes. When `main` is merged into `staging-combat`, the COMBAT type's own plain doors must win over this.
