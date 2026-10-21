# Dungeon layer: monsters, traps, fights, and replayDungeon

- **Pull request:** #10 (into `staging-combat`)
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-18
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

`generator/dungeon.js` puts monsters and traps in the maze: monsters wander, spot you down a line,
chase and follow scent; walking into one starts a 1v1 fight (attack, guard, flee); hidden spikes, darts
and alarms. `replayDungeon(maze, dungeon, hero, nonce, actions)` replays a run from its action string,
with dice from one seeded stream `${dungeonSeed}:${nonce}`. All numbers live in `DUNGEON_CONTENT` so they
can be tuned.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Designed the combat rules with the AI (design doc sections 3, 4, 8.2, 9.1) and merged it.

## Look closely at

A stand-in player plays 24 real daily dungeons and checks the live run and its replay agree on every number.
