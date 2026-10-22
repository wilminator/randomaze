# Show the touch buttons automatically on touch screens

- **Pull request:** #16
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-21
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

Touch buttons showed only when the window was narrower than 1.4x its height, so an iPad held sideways
had invisible buttons that still covered the maze and caught every tap, and "Show" did nothing.

`MazeHtml.setTouchControls('auto' | 'on' | 'off')`: `auto` shows the buttons on any touch screen in either
orientation and hides them otherwise.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Asked for the fix and merged it.

## Look closely at

A narrow desktop window no longer gets the buttons. #19 later corrected Hide, which this pull request had made remove the buttons entirely.
