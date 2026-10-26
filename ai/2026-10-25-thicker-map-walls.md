# Thicker map walls and a dark map option

- **Pull request:** #38
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code

## What and why

Mike's wife found it hard to see where a wall is on the map when it sits beside unexplored cells.
The cause: a wall between explored cells was a 1px black line (keyed doors 2px), and unexplored
cells are mid grey, so a thin dark line on grey nearly disappears, most of all on a phone.

Walls and plain doors are now 3px, keyed doors 3px (4px in high contrast), and the high contrast
white wall 3px. Only the border widths in `ui/mazehtml.js` changed (the `doors` table and
`renderMapWall`). Options weighed and not used: a hatched pattern on unexplored cells (helps tell
"unexplored" from "wall" but not the wall itself, and adds a background image per cell) and a
lighter or darker unexplored grey (trades away contrast elsewhere). Plain thicker lines add no
textured layers, which matters because phones are near their graphics memory limit.

Mike liked the dark look (black explored cells, white walls, dark grey unexplored cells) that high
contrast already gives the map, so it is now its own option: `mazehtml.setDarkMap(true)`. It
changes only the map. Walls turn white; doors keep their colors and stay solid (high contrast
still swaps them for its own colors and dashes). `mapIsDark()` is true for either option.
The site gets a Settings checkbox in a separate randomaze-site PR after an engine release.

## What the AI did

Claude Code found the cause, rendered the options in headless Chromium to compare them,
made the change, and wrote the browser test and this note.

## What I did

Nothing by hand. Tested with `npm test` and `npm run test:ui`; the new test reads the computed
border width of every wall and door drawn on the map, in both the normal and high contrast looks,
and fails on the old 1px and 2px lines.

## Look closely at

Cells are small (about 25px on a phone-sized map), so 3px walls on both sides of a shared wall
take up a noticeable share of a cell on very large mazes. Nothing else.
