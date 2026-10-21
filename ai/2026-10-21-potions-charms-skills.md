# Potions, charms, level 1 skills, doubled and growing SP

- **Pull request:** #25 (into `staging-combat`)
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-21
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

With no healing, 10-15 fights killed most heroes. Adds HP and SP potions on the floor, Feather and
Anchor charms (passive, single use), one level 1 skill per class on key `1`, doubled SP that grows 10%
per level. Easy deaths across the six classes fall from about 98% to about 51% in the balance bot.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Chose doubling SP and the potion and charm rules, and merged it.

## Look closely at

A full bag of SP potions blocks HP potions (deaths doubled in a test); whether unused charms pay XP is still open.
