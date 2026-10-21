# Animation speed setting (slow motion)

- **Pull request:** #18
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-21
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

Some players want the turns and steps slower. `mazehtml.setAnimationSpeed(speed)` makes every
animation last `1 / speed` times as long, through a CSS variable (`--maze-slow`) and the same factor for
durations set from JavaScript.

Speed is held between 0.25 and 1 on purpose: the backend flags moves less than 400 ms apart as
impossible, so the game may only be slowed, never sped up.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description. It found the 400 ms backend rule in the private backend and set the limit from it.

## What Mike did

Asked for slow motion and merged it; the site's Settings dropdown was a separate site pull request.

## Look closely at

The upper limit of 1 is a fairness rule, not a technical one. Don't raise it without changing the backend.
