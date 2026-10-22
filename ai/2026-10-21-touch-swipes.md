# Touch swipes, swipe direction and a page-scroll strip

- **Pull request:** #26
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-21
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

On a phone with the map below the maze there was nowhere to put a finger to scroll the page, and
some players prefer swipes. Three options: `setTouchStyle('taps' | 'swipes' | 'both')`,
`setSwipeDirection('point' | 'drag')`, and `setScrollSide('left' | 'right')`, which makes one side strip
scroll the page. A blocked, crooked or too-short swipe does nothing and costs no move.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Asked for swipes and a scroll area, set the scope (no Up/Down resizing, Comfort mode or bump feedback), and merged it.

## Look closely at

Two choices were left for Mike to confirm: in swipes-only style, taps on the scroll strip are ignored too; a sideways swipe that starts on a side strip does nothing.
