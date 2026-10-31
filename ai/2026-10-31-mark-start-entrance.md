# Mark the start entrance on the map

- **Pull request:** (this PR)
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code

## What and why

A maze can have several entrances, and some of them are fake exits. The map never said which
entrance the player started from, so once you wandered off it was easy to lose your bearings.
Entrances were only drawn on debug maps (numbered, white squares).

Now every normal map marks the start: a yellow arrow on a dark square in the border cell outside the
start entrance, pointing into the maze, with the hover title "Start". The start is always
`maze.entranceList[0]` (the generator treats it as the start and the last entrance as the exit).
Only the start is marked, not the other entrances, because showing the fakes would give away
which door is the real exit. The dark square keeps the arrow readable on the normal, dark and high
contrast maps. Debug maps are unchanged and still number every entrance.

## What the AI did

Claude Code added `renderStartMarker()` to `ui/mazehtml.js` (called from `renderMap()` when not in
debug), the `.startMarker` rule in `ui/css/maze.css`, and a browser test and this note.

## What I did

Nothing by hand. `npm test` (136 pass) and `npm run test:ui` (56 pass). The new test checks that exactly
one border cell is marked, that it is the cell outside `entranceList[0]`, that it has an arrow and
the Start title, and that redrawing the map in the normal, dark map and high contrast looks never
adds a second marker.

## Look closely at

The marker colors (#ffd400 on #202020) were picked by eye and not viewed on a phone.
