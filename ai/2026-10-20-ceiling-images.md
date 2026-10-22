# Add ceiling images, varied like floors

- **Pull request:** #15
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-20
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

Images tagged `ceiling` in `loadWall` were accepted but never drawn. This draws them, varied in 2x2
patches the same way floors are, with its own hash salt so ceiling and floor picks are independent.
With no ceiling images loaded, the ceiling keeps its flat colour.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Asked for it and merged it. He has since said not to make ceiling art unless the art exists, so the site loads none and nothing visible changed.

## Look closely at

Nothing: no page loads ceiling images yet.
