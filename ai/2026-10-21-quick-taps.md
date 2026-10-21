# Count quick taps, and keep the touch buttons live when not drawn

- **Pull request:** #19
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-21
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

Two touch fixes after #16. The game looks at the buttons ten times a second, so a tap that started and
ended between two looks was lost; a tapped button is now remembered until the next look. And #16's Hide
removed the buttons, breaking the original design where undrawn buttons still catch taps on the maze;
they now always catch touches and are only drawn in portrait or after Show.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Asked for the follow-up fix to #16 and merged it.

## Look closely at

`tappedKey` and `nextKey()` in `ui/mazehtml.js`: a cancelled touch must not count as a tap.
