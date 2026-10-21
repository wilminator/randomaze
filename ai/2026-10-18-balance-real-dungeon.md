# Balance bot: harness for the real dungeon

- **Pull request:** #13 (into `staging-combat`)
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-18
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

The bot from #9 played an abstract model. `tools/balance/real.js` and `real-fit.js` play the real dungeon
and fit monster strength to a target death rate. Finding: monsters needed only 5-16% of their stated HP
and attack. Tools only.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Asked for real-dungeon numbers and merged it.

## Look closely at

Re-run whenever healing, skills or potions change.
