# Show the fallen wall on the map after a fake exit

- **Pull request:** #TBD
- **Author:** Mike (wilminator)
- **AI tool(s):** Claude Code (Sonnet 5.5)

## What and why

Walking out of an entrance that is not the real exit drops a wall behind the player in the 3D view, and the player's rules (`MazePlayer.fallenWalls`) treat that spot as a wall from then on. The map did not: it draws walls from the maze data, where that side is still an opening, so it kept showing a gap the player can no longer pass. The fix records the fallen wall in the cell's own play state (`cell.play.fallen`) when the `trap` result comes back, and `renderMapWall` draws such a side as a normal wall. The play state is used, not `player.fallenWalls`, because a game layer can supply its own player object that has no such set.

## What the AI did

Planned and wrote the change in `ui/mazehtml.js` (`renderMapWall`, the `trap` case in the action handler) and a browser regression test in `test/ui/game.test.mjs`.

## What I did

Ran `npm test` and `npm run test:ui`. The new test fails without the fix and passes with it.

## Look closely at

`renderMapWall` now switches on `shown`, which is `0` for a fallen wall, so the usual wall colours (plain, dark map, high contrast) apply unchanged. ui files are CRLF; the edit kept that.
