# Add the combat balance bot

- **Pull request:** #9 (into `staging-combat`)
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-18
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

The combat numbers (band width, monster stats, XP table, potion values, gold) had no data behind them.
`tools/balance/` simulates thousands of runs per class, level and difficulty and fits the numbers to
target death rates. It is an abstract model of the design's rules, not a real maze, so its results are
the shape of the answer, not final values.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Asked for a way to test the numbers before building, and merged it.

## Look closely at

Results are only as good as the model; #13 replaced it with the real dungeon.
