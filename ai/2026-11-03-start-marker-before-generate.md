# Fix the start-entrance marker crashing before the maze is generated

- **Pull request:** #46
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code

## What and why

Engine v0.9.0 draws a start-entrance arrow on the map (`renderStartMarker`, PR for "mark the entrance the player started from"). It reads `maze.entranceList[0]`. A page applies the player's settings, which includes `setHighContrast()` and so redraws the map, after `new MazeHtml(...)` but **before** `maze.generateMaze()` has made the entrances. At that moment `entranceList` does not exist, so `renderStartMarker` threw `Cannot read properties of undefined (reading '0')` and the maze never started. It happened for every player, whatever the high-contrast setting was. It was found when the site's staging copy tried v0.9.0.

The fix is one guard: with no entrance list yet there is nothing to mark, and `playGame()` draws the map again after the maze exists, which is when the marker appears.

## What the AI did

Traced the stack trace from staging to `renderStartMarker`, wrote the guard in `ui/mazehtml.js`, and wrote a browser test that sets up a game in the same order the site does.

## What I did

Reviewed the diff, confirmed the new test fails without the fix and passes with it (stashing only `ui/mazehtml.js`), and ran `npm test` (136 pass) and `npm run test:ui` (61 pass).

## Look closely at

Whether the marker should also be redrawn right after `generateMaze()` for pages that never call `playGame()` (none do today).
