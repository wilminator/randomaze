# Let go of touch buttons when the phone cancels a touch

- **Pull request:** #5
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-17
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

On phones, a touch button could stick: the player kept turning with no finger down, and every other
button stopped working until a reload. A phone can end a touch with `touchcancel` instead of `touchend`
(long press, a notification, a swipe taken as a scroll), and only `touchend` released the button.

The fix releases on `touchcancel` too, calls `preventDefault()` on `touchstart` and adds
`touch-action:none` and no-select styles so the browser can't take over a held button, and makes the
slide-off check use the finger that moved, in window coordinates.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Asked for the fix and merged it.

## Look closely at

The new test holds Right, cancels the touch, and checks turning stops and Left still works; it fails on the old code.
