# Weaker monsters and a head start for heroes

- **Pull request:** #24 (into `staging-combat`)
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-21
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

A level 9 Warrior lost half its HP to one same-level goblin. Monster HP and attack are scaled per tier
so a same-level monster costs a Warrior about 5/10/20/50% of HP, and heroes start with 10 levels of HP
growth and 3 of SP (`headStart`).

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Set the goal (heroes clearly sturdier than monsters) and proposed the head start, an idea from another game. Merged it.

## Look closely at

Mage and Cleric stay weak until skills exist; with no healing most heroes still die (fixed in #25).
