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

## Single fights, monster tiers and the head start (`fights.js`, `fit-tiers.js`)

`fights.js [heroLevel]` plays one fight at a time with the engine's own maths and prints the share of
HP a hero loses to each species, by class and by the monster's level offset from the hero (Easy spans
about -3..+4 inside a band). Before this change a level 9 Warrior lost 40-50% of its HP to a
same-level goblin or skeleton and lost to orcs and wraiths. A Mage lost to goblins.

`fit-tiers.js` scales each tier's HP and ATK so a same-level monster costs a Warrior (the baseline
class) 5% / 10% / 20% / 50% of its HP for tiers 1 / 2 / 3 / boss, averaged over levels 5-19.
Factors: tier 1 x0.9, tier 2 x0.54, tier 3 x0.45, boss x0.38. These are now in `DUNGEON_CONTENT`.

`headStart` (Mike's idea) gives every hero extra levels of HP and SP growth on top of its own level
(now 10 HP and 3 SP): about 2.5x base HP at level 1. `HEAL=<share>` in `real.js` stands in for
the missing potions and Heal skill (that share of max HP back after each fight). Easy deaths, mean of
all six classes, traps off:

| HP back per fight | Level 1 | Level 5 | Level 12 | with head start: L1 | L5 | L12 |
|---|---|---|---|---|---|---|
| 0 | 100% | 100% | 92% | 100% | 96% | 79% |
| 10% | 100% | 100% | 67% | 58% | 71% | 46% |
| 20% | 88% | 92% | 58% | 42% | 50% | 33% |
| 40% | 83% | 75% | 46% | 38% | 42% | 29% |

(4 dungeons x 1 dice seed per cell, so each cell is rough, and Mage never survives: it only has ATK 4
until its spells exist, which drags every mean up.) Without any healing, a run of 10-15 fights is
lethal whatever the monsters do, so healing/potions are the missing piece, not more monster tuning.

## Potions and level 1 skills

`real.js` now plays with them: the stand-in drinks (`I`) below 40% HP in a fight or 50% outside one,
Clerics Heal below 50-60%, Rangers shoot a monster in line, and every other class uses its skill
(`1`) whenever it has the SP (Rogue only on a first strike). `SKILLS=0` / `POTIONS=0` switch either
off. Easy deaths, mean of all six classes, hero levels 1 / 5 / 12, traps on, head start on:

| | L1 | L5 | L12 |
|---|---|---|---|
| neither | 98% | 98% | 94% |
| potions only | 71% | 69% | 48% |
| skills only | 94% | 90% | 81% |
| both | 67% | 71% | 40% |

Easy deaths by class, both on (mean over the three levels): Warrior 29%, Rogue 50%, Ranger 46%,
Cleric 54%, Monk 79%, Mage 50% (96% when Firebolt cost 3 SP; it now costs 2, so 8 casts).

The stand-in only walks the shortest route to the exit, so it meets about 10 fights and finds about 2
of the dungeon's ~10 potions. A player who explores finds far more, so these deaths are an upper
bound. Monk and Rogue die most after the Mage fix: they are the ones chased into the most fights.

## Why the early Mage dies (Firebolt 2 SP, Easy, hero levels 1 / 3 / 5, 18 runs per cell)

`CLASSES_ONLY=mage node real.js 6 3 4` with `CONTENT` overrides (`classes`, `trapDamage`), `SKILLS=0`, `POTIONS=0`:

| What is changed | L1 | L3 | L5 |
|---|---|---|---|
| as built | 39% | 33% | 44% |
| no traps | 39% | 33% | 39% |
| no Firebolt (basic attack only) | 100% | 100% | 100% |
| no potions | 56% | 56% | 61% |
| DEF 1 -> 4 | 39% | 22% | 39% |
| HP x2 | 28% | 17% | 44% |
| SP unlimited | 28% | 17% | 22% |
| HP x2 and SP unlimited | 17% | 17% | 17% |

The limiting factor is SP: the Mage's basic attack (ATK 4) cannot kill anything, so once the ~9
Firebolts of a run are spent it is helpless. Traps and DEF barely matter. Potions help a lot.

The 1-cell out-of-combat Firebolt (`FIRE1=1`) does not help a rule-following bot: burning every
adjacent monster raised level 1 deaths from 39% to 78%, because a monster that survives the bolt
wakes up, chases, and takes away the hero's first strike, and the SP is spent either way. It is a tool
for a player who picks the target (a monster that blocks a corridor, one at low HP), not free power.
