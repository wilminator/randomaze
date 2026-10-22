# Draw only the cells you can see

- **Pull request:** (this PR)
- **Author:** Mike Wilmes (wilminator)
- **AI tool(s):** Claude Code (Claude Sonnet 5.5)

## What and why

Every floor, ceiling and wall is its own 3D layer, and phones run out of graphics memory (see `textureRange`).
The game drew every cell in a square window around the player, most of it behind walls. Mike suggested drawing
only what can be seen, as MazeBot does. `visibleCells` now walks outward through open passages (and opened
doors) up to the view range, and only those cells are drawn. Standing still, walls facing away from the player
are hidden too. A step passes through a doorway, so walls are kept while moving. Chosen over a ray table
because it is simple, cannot hide something visible, and can be tightened later.

## What the AI did

Wrote `visibleCells` and changed `hideOutOfRangeCells` in `ui/mazehtml.js`, plus tests in
`test/variety.test.js` and `test/ui/game.test.mjs`. The design came from Mike's idea.

## What I did

Reviewed the plan; will check on a phone. Tests: `npm test`, `npm run test:ui`.

## Look closely at

The back-wall rule and the walk-out-through-the-exit case (nothing is re-culled once outside the maze).
