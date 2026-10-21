# Class HP and gentler traps

- **Pull request:** #PRNUM (into `staging-combat`)
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code

## What and why

Level 1 heroes were too fragile for the first dungeon runs, and traps hurt too much. Mike wanted traps to be an
inconvenience, not a game killer. Base HP per class is raised so that, with the 10-level head start, level 1 HP is
Warrior 115, Monk 98, Cleric 93, Ranger 93, Rogue 85 and Mage 75. Spikes now cost 5% and darts 3% of max HP
(was 15% and 10%). The same pull request carries the collector bot from the balance thread, which measures
how well a level 1 Mage clears a band. This is the first step in rebalancing the classes; more patches follow.

## What the AI did

Claude Code (in the balance thread) chose the numbers by simulation and wrote the code, tests and README notes.
This thread only applied the two patches onto a fresh branch from `staging-combat` and opened the pull request.

## What I did

Mike agreed the milestone and the target HP values. The 146 unit tests pass (`npm test`).

## Look closely at

The HP numbers are in `DUNGEON_CONTENT.classes` in `generator/dungeon.js`. They are base values; the head start
adds the rest, so the table above is the level 1 total, not the number in the file.
