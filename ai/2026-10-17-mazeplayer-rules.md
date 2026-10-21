# Move the rules of play into mazeplayer.js

- **Pull request:** #4
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-17
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

The rules for each key press lived inside `playGame()`, mixed with animation code, and the page
reported only a move total, so nobody could check a score. Mike chose full server-side replay to make
cheating "not easy" (not impossible).

The rules moved to a DOM-free `generator/mazeplayer.js` (`MazePlayer`), which the UI calls and then
animates. Every counted move is recorded as one letter (`F B L R U D`) with its time, and
`replayGame(maze, actions)` returns the real move count or why the recording is impossible. Play state
lives on the player, not the cells, so one cached maze can be replayed many times on the server.
`test/fingerprint.test.js` was added here to pin the walls, doors and keys of 20 mazes.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description. Mike picked the approach (full replay) from options the AI laid out.

## What Mike did

Chose replay over lighter checks, and merged it. The site and backend halves followed as separate pull requests, in the order he released them.

## Look closely at

`mazegen.js` is untouched, and the fingerprint test is what proves it. A browser test plays the real UI and checks the page's recording replays to the same result.
