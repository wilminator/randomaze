# Fix maze repair, demo crash, stuck keys and autoplay errors

- **Pull request:** #2
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-16
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

A bug hunt across the engine found five real faults:

- `ensureSolvable` mixed up which side of a split maze could reach the exit (`pathfind` measures
  backwards from the end), so it opened walls the wrong way and recursed until the stack overflowed.
  The fix opens one wall from the start's side into the exit's side. About 1 in 50 seeds hit this repair,
  and only those seeds build a different maze now.
- The demo crashed on about a quarter of large mazes because it loaded fewer key items than the maze
  had keys. The UI now reuses items (copied, so each door keeps its own animation).
- Alt-Tab while holding an arrow left the player walking forever; keys are now let go on window blur.
- `removeGameUi` crashed with no menu callback.
- Blocked autoplay logged an uncaught promise error; `startAudio` catches it and retries on the first key or click.

Smaller fixes rode along: dead `openPath` removed, debug stair icons, key colours wrapping after 20,
and two title colour effects that skipped every other step.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description. It found the bugs by reading the code and running `npm run check` over thousands of mazes, wrote a failing test for each one first, then fixed it.

## What Mike did

Asked for the bug hunt and merged it.

## Look closely at

The `ensureSolvable` change moves a small number of mazes. It shipped as v0.1.1, before server replay existed, so no recorded game depended on the old shapes.
