# Balance bot

An abstract simulator for the dungeon's numbers (combat design, section 11, Phase 3). It plays
thousands of runs per class, hero level and difficulty and answers: how wide should a level band
be, how strong should monsters be, what should the XP table look like, how fast do heroes level,
what is a leftover potion worth, how much gold does a run pay.

It does **not** walk a real maze: a run is 24 fights in depth order using the design's own combat
math. When the engine's `Dungeon` exists, swap a real run in for `playRun` in `model.js`; the tuner
and the career model stay the same.

Read [RESULTS.md](RESULTS.md) for the findings. `balance-tuned.json` holds the numbers in a form the
content table can use.

| File | Job |
|---|---|
| `model.js` | One run: classes, bestiary, fights, skills, potions, loot. Every guess is marked ASSUMPTION. |
| `tune.js` | Finds the monster strength and the per-class power factors for a target death rate. |
| `careers.js` | XP per run, the XP table, days per level, potion values. One band width at a time. |
| `levers.js` | How monster count and rest healing change deaths (shows attrition is not the problem). |
| `report.js` | Builds `RESULTS.md` and `balance-tuned.json` from the results. |

```
cd tools/balance
node tune.js 5 0.15                                                       # class powers at width 5
for w in 2 3 4 6; do node tune.js $w 0.15 tuned-w5-g0.15.json; done       # re-scale monsters per width
for w in 2 3 4 5 6; do node careers.js $w 600; done                       # about a minute each
node report.js 4                                                          # recommended width
```

In Docker: `docker run --rm -v "$PWD":/w -w /w/tools/balance node:22 node tune.js 5 0.15`.
No npm packages are needed.

## Real-dungeon harness (`real.js`, `real-fit.js`)

The abstract model above is a stand-in. These two scripts play the engine's own dungeon
(`generator/dungeon.js`) with the stand-in player from `test/dungeon.test.js` (shortest route to the
exit, attack, flee below 30% HP). There are no skills, potions or healing yet, so they measure the core
loop only and must be re-run when those land.

- `node real.js [days=6] [nonces=3] [bandWidth=4] [out]` plays every class x level x difficulty and
  records deaths, XP, kills, fights and ticks. `CONTENT='{"monsterPower":0.1}'` overrides content.
- `node real-fit.js [days] [nonces] [width]` bisects `monsterPower` (HP and ATK each scaled) until Easy
  deaths hit 5%, 15% and 30%. `EXTRA` fixes other overrides; `TAG` names the output.

Findings at width 4, monsterGrowth 0.15, traps off (traps alone kill 8-17% of runs, since nothing heals):

| Easy deaths | Flat hero DEF (as built) | DEF +15% a level |
|---|---|---|
| 5% | x0.05 | x0.05 |
| 15% | x0.11 | x0.12 |
| 30% | x0.16 | x0.20 |

Monsters need to be about 5-16% of their stated HP and ATK for this player to survive. Hero DEF growth
barely changes that, so the gap is in the monster/hero ratio, not DEF alone.
