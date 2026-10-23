# Hero growth: ATK 10%, DEF and SPD 5% a level

- **Pull request:** (see the PR that carries this note)
- **Author:** Mike (requested), written by Claude
- **AI tool(s):** Claude (Sonnet 5.5)

## What and why

Mike asked for strength gains to be cut from 15% to 10% of base per level, and for defense and speed, which were flat, to grow 5% of base per level.
`heroGrowth` in `DUNGEON_CONTENT` is now `{hp: 0.15, atk: 0.10, def: 0.05, spd: 0.05, sp: 0.10}` and `dungeonHeroStats` grows SPD. Crit stays flat.

## What the AI did

Changed `heroGrowth` and the `spd` line in `dungeonHeroStats` (`generator/dungeon.js`) and added a test in `test/dungeon.test.js`.
It re-ran the real-dungeon balance harness at levels 1, 5, 11 and 20 against the old growth.

## What I did

Mike set the numbers. The tests pass (`npm test`, 147). Level 1 is unchanged. Deaths at levels 5 to 20 on the own-band Easy board moved by a few points (a 3-run sample, so noisy).

## Look closely at

SPD is now fractional above level 1. It is only compared and subtracted (first strike, to-hit, flee chance), so replays stay deterministic, but any display should round it.
