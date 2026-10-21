# Combat balance bot: results

Run on 2026-10-18 by the "Combat balance bot" thread. Code: [balance/](/mnt/project-files/combat/sim/balance/). Machine-readable numbers: [balance-tuned.json](/mnt/project-files/combat/sim/balance/balance-tuned.json).

**Read this first.** The engine has no dungeon yet, so the bot is an *abstract* model of a run (24 fights in depth order, the design's combat math, stat curve, classes, skills, death penalty, bag and potion rules). It answers "what shape should the numbers have", not "what is the exact number". Every guess is marked ASSUMPTION in `model.js`. When the engine's Dungeon (Phase 2) exists, the same questions should be re-asked of the real thing; the knobs stay the same. Treat every number below as a first fit with roughly ±20% noise.

## 1. The answers, in short

1. **Band width: I recommend 4.** Widths 2 to 6 all hit your pace targets inside the "no level over 5 days" rule, so width is decided by two other things that pull in opposite directions: wide bands pay a natural difficulty carrot and need fewer boards, narrow bands are much kinder to a brand-new hero (section 2). This is your call; I have put it to you as a question.
2. **The design's monsters are too strong, by about 3× in HP and 3× in ATK** (section 3). Calibrating Easy to about 5% deaths needs every monster at about 0.31× the 3.5 table's HP and ATK. The design's 15% a level growth is fine and unchanged. With the table as written, 82% of Easy runs and 94% of Average runs end in death.
3. **XP table:** need(L) = 1,152 × 1.25^(L−1), with monster XP growing 1.2× per monster level. An Easy-only player reaches level 20 on day 61, is at level 4.4 on day 7, and no level takes more than 4.7 days (section 4).
4. **The difficulty carrot depends on width.** Because an Average kill is worth about g^width times an Easy kill, Average pays 1.25× Easy per day at width 4 with no help, but only 1.11× at width 3 (section 5).
5. **The first run is harsh at wide widths.** A level 1 hero's first Easy run ends in death for 12% of heroes at width 2, 18% at width 3, 35% at width 5. The first-run XP floor still gives level 2, but a dead first run is a bad welcome (section 2).
6. **Class parity is uneven:** the Mage needs about 3× the damage factor of the Warrior, Cleric, Ranger and Rogue to die as often (it is the weak class as designed), the Monk sits at the tuner's floor so its result is unreliable, and the Rogue levels about 35 days slower than the others because it skips fights (section 6).
7. **Potion bonus table** (section 7) is a placeholder; **gold** is about 4× too generous at a 30% portal rate, and about 3 days per gear piece at roughly 7% (section 8).

## 2. Band width

Each row fits the geometric XP table to your targets (level 2 after run 1, level 3 on day 2, about 4.5 by day 7, level 20 around day 60) for a player who only plays Easy. "Days on a level" is for that player, levels 2 to 19.

| Width | Bands | Boards a day (bands × 3) | Longest level (days) | First → last level of a band (days) | Average ÷ Easy XP, no bonus | Hard ÷ Easy, no bonus | First-ever Easy run: deaths | Easy deaths at level 5 |
|---|---|---|---|---|---|---|---|---|
| 2 | 10 | 30 | 5.2 | 3.6 → 3.5 | 1.08 | 1.07 | 12% | 10% |
| 3 | 7 | 21 | 5.0 | 3.4 → 3.7 | 1.11 | 1.10 | 18% | 8% |
| 4 | 5 | 15 | 4.7 | 3.0 → 3.8 | 1.25 | 1.31 | 24% | 15% |
| 5 | 4 | 12 | 4.8 | 3.0 → 3.9 | 1.33 | 1.42 | 35% | 1% |
| 6 | 4 | 12 | 5.0 | 2.7 → 4.4 | 1.50 | 1.73 | 38% | 1% |

What it says:
- **Pace does not decide it.** Every width reaches the targets and stays under 5 days a level (within noise). The "pop and lull" you predicted shows up and grows with width: no swing at width 2 or 3, about +0.8 days between the first and last level of a band at width 4 and 5, and +1.7 days at width 6.
- **Wide bands pay a natural carrot.** An Average kill is worth about g^width Easy kills, so at width 5 Average already pays about 1.3× Easy per day, and Hard 1.4×. At width 3 they pay only 1.1×, so you would need XP multipliers of about ×1.2 and ×1.5 to make harder runs worth the risk.
- **Wide bands are rough on a new hero.** Easy monsters run from the band's first level up to a full band higher, so a level 1 hero meets monsters up to level (width + 1) in the same maze. Width 5 means level 6 monsters against a level 1 hero, and about a third of first runs end in death.
- **Wide bands also mean fewer boards:** 12 a day at width 5, 15 at width 4, 21 at width 3, 30 at width 2. At launch most boards will be empty.

**My view.** I lean to **4**: it keeps boards to 15, pays most of the carrot on its own, and the first run is bad but not awful. The counterpoint for **3** is that new players matter more than board counts: a quarter fewer first-run deaths, a gentler ladder, and the multipliers are easy to add. The counterpoint for **5** is the simplest design (12 boards, the carrot is free, and it matches the "bands of 5" you wrote earlier), if you accept that new heroes should lean on the first-run floor and pick Easy until level 3 or so. Either way, one cheap fix for the first run is to let monster level rise more slowly with depth at the start of a band.

## 3. Monsters (width 4)

Calibration target (my proposal): **Easy runs end in death about 5% of the time**, averaged over the sampled hero levels and classes. Class powers were tuned at width 5 and kept for the other widths; only the global monster scale was re-fitted per width, so it moves a little (w2 ×0.33, w3 ×0.33, w4 ×0.31, w5 ×0.30, w6 ×0.29 on HP and ATK each).

**What was tuned.** A strength multiplier on every monster (×0.09, split evenly: HP and ATK each ×0.31, since a fight's danger grows with HP × ATK). The growth per level stays at the design's 0.15. The bestiary's shape (species, tiers, DEF, SPD) is unchanged.

Why the design numbers are too strong, from the bot:
- A fresh hero loses about 25% of fights against a tier 3 monster (orc, wraith) one band up, and a run has about 8 tier 3 fights, so survival is roughly 0.75^8, about 10%.
- It is **not attrition.** Giving the hero 5%, 10% or 20% of its HP back after every fight changes Average deaths by less than 1 point. Fewer monsters helps only slowly: 24 monsters 92% deaths, 12 monsters 77%, 6 monsters 55% (Average, as written).
- A more careful potion policy (drink when the next hit could kill) lowers Average deaths from 92% to 79%, nowhere near the target. So it is not just the bot playing badly.
- The tuner also found that the DEF/2 subtraction matters: tier 1 monsters' ATK 2 to 3 barely scratches a Warrior (DEF 5), so most of the early danger comes from tier 2 and 3.

Monster stats at level 1, design versus tuned (multiply both by 1 + 0.15 × (level − 1)):

| Species | Tier | Design HP / ATK / DEF | Tuned HP / ATK | DEF (unchanged) |
|---|---|---|---|---|
| rat | 1 | 6 / 3 / 0 | 1.8 / 0.9 | 0 |
| slime | 1 | 12 / 3 / 2 | 3.7 / 0.9 | 2 |
| bat | 1 | 5 / 2 / 0 | 1.5 / 0.6 | 0 |
| goblin | 2 | 14 / 5 / 2 | 4.3 / 1.5 | 2 |
| skeleton | 2 | 18 / 6 / 4 | 5.5 / 1.8 | 4 |
| spider | 2 | 12 / 5 / 1 | 3.7 / 1.5 | 1 |
| orc | 3 | 28 / 8 / 4 | 8.6 / 2.4 | 4 |
| wraith | 3 | 20 / 7 / 6 | 6.1 / 2.1 | 6 |

Caveat: with damage = ATK − DEF/2 and a minimum of 1, ATK values this low make the 1-damage minimum do most of the work at level 1. The tuned numbers show the *size* of the gap; the real fix may be a mix (weaker monsters, a DEF that does not subtract so much). That is a design call.

### Death rate by hero level and difficulty (class mean, width 4)

| Hero level | Easy | Average | Hard |
|---|---|---|---|
| 1 | 24% | 83% | 96% |
| 2 | 9% | 66% | 93% |
| 3 | 3% | 38% | 83% |
| 4 | 1% | 20% | 68% |
| 5 | 15% | 63% | 89% |
| 6 | 8% | 47% | 80% |
| 8 | 1% | 19% | 56% |
| 11 | 2% | 20% | 50% |
| 15 | 2% | 12% | 34% |
| 20 | 1% | 6% | 21% |

The ladder is steep: each band step multiplies danger by roughly 3. Deaths peak at the first level of each band (the hero is weakest against a freshly raised monster band) and fall through it.

## 4. XP table

Fitted on the Easy-only player (the hardest promise: "a short run on Easy is enough"). Everyone else is at least this fast.

- **Geometric table:** need(L) = 1,152 × 1.25^(L−1).
- **Monster XP:** (4 × tier² + HP/4) × 1.2^(monster level − 1). (HP here is the design's level 1 HP, so tuning monster HP does not change XP.)

| Level | 1→2 | 2→3 | 3→4 | 4→5 | 5→6 | 6→7 | 7→8 | 8→9 | 9→10 | 10→11 |
|---|---|---|---|---|---|---|---|---|---|---|
| XP needed (geometric) | 1,152 | 1,440 | 1,800 | 2,251 | 2,813 | 3,517 | 4,396 | 5,495 | 6,868 | 8,585 |
| XP needed (hits targets exactly) | 654 | 752 | 2,429 | 2,910 | 4,653 | 5,175 | 5,529 | 5,801 | 9,574 | 10,538 |

The geometric table lands level 3 on day 3, not day 2 (an Easy run at level 1 and 2 pays about 654, so two days cannot cover 2,592). The "exactly" row is need = days wanted × XP per day, which reaches every target but is not a smooth formula. If you want "level 3 on day 2" to be a promise, use the first few entries of that row and the geometric table after. The first-run floor (level 2 after run one, even after a death) is built in.

Pace by player type (mean of the six classes, level reached on each day):

| Player | Day 7 | Day 30 | Day 60 | Reaches 20 | Longest level (days) |
|---|---|---|---|---|---|
| Easy only | 4.4 | 12.2 | 19.8 | day 61 | 4.7 |
| Average only | 4.6 | 13.6 | 20.0 | day 49 | 3.0 |
| Hard only | 4.3 | 14.4 | 20.0 | day 42 | 3.2 |
| Adaptive (hardest difficulty with ≤12% deaths) | 4.5 | 12.5 | 20.0 | day 56 | 3.8 |

## 5. Difficulty needs a carrot

Expected XP per day relative to Easy (class mean, levels 2 to 20), **before** any difficulty bonus, with the XP rules as designed (proficiency share kept on death, escape bonus only on survival):

| Hero level | Average ÷ Easy | Hard ÷ Easy | Hard death rate |
|---|---|---|---|
| 1 | 0.74 | 0.54 | 96% |
| 2 | 0.86 | 0.66 | 93% |
| 3 | 1.21 | 0.96 | 83% |
| 5 | 0.89 | 0.73 | 89% |
| 8 | 1.35 | 1.27 | 56% |
| 11 | 1.27 | 1.29 | 50% |
| 15 | 1.37 | 1.64 | 34% |
| 20 | 1.51 | 2.00 | 21% |

Average pays about **1.25×** Easy and Hard about **1.31×**, with Hard runs ending in death 21% to 96% of the time depending on level. The average hides a trap: at the first level or two of each band (levels 1, 2 and 5 above) Average and Hard pay *less* than Easy, because the hero dies often and loses XP. Section 4.5 of the design worried about exactly this. XP multipliers that would make Average pay 1.35× and Hard 1.7× (my proposals, the numbers are yours to change): **Average ×1.08, Hard ×1.29**, applied to the XP of the whole run. Other levers to try instead or as well: pay the escape bonus at half rate on a Hard death, or give Average and Hard kills more XP per level than Easy ones.

## 6. Classes

Class power factors (a multiplier on every point of damage that class deals, chosen so each class's deaths per run match). The point is the *direction*: a factor below 1 means the class is stronger than the others as designed, above 1 weaker. A factor at the 0.10 floor means the fit could not go low enough, so read it as "much stronger", not as a number.

| Class | Power factor | Average deaths (mean) | Unused potions on survival, Average | Days to level 20 (Easy only) | XP factor to even out pace |
|---|---|---|---|---|---|
| Warrior | 0.16 | 16% | 0.6 | 52 | ×1.17 |
| Rogue | 0.31 | 32% | 0.2 | 91 | ×0.67 |
| Mage | 1.07 | 33% | 1.5 | 51 | ×1.20 |
| Cleric | 0.37 | 28% | 0.3 | 55 | ×1.11 |
| Ranger | 0.34 | 34% | 0.1 | 57 | ×1.07 |
| Monk | 0.10 | 16% | 0.2 | 60 | ×1.02 |

- **Warrior (lowest factor):** with HP 30, DEF 5 and Power Strike it is the strongest class as designed. Cutting its damage would not fix how it *feels*; trimming HP or DEF would. A DEF of 5 against level 1 monsters' ATK 3 to 5 makes most early hits do 1 to 3 damage.
- **Mage (highest factor):** the weakest as designed. 16 HP means one tier 3 hit takes most of it, and SP runs out (1 SP per 8 steps, Firebolt costs 3; both since changed, see the README).
- **Monk (factor at the 0.10 floor, so unreliable):** in this model Flurry's three to five hits each get the 1-damage minimum, which makes it strong against the weakened monsters, while against high DEF its 0.5× hits lose most of their damage (damage = ATK × mult − DEF/2). It is a sign the minimum-damage rule and Flurry interact strongly; check with real fights, and consider Flurry ignoring DEF or hitting at 0.7×.
- **Rogue:** skipping 25% of fights is Shadow Step's identity, but it costs about a quarter of the XP, so Rogues level 36 days later. Either a stealth XP bonus (about ×0.67) or Shadow Step should still pay partial XP.

## 7. Potion bonus (unused dungeon potions)

Per-potion XP such that the average potion bonus is **8% of an Average run's XP for every class** (the cap you suggested is 20%). Band numbers for width 4; "band 1" is hero levels 1 to 4.

| Class | Band 1 | Band 2 | Band 3 | Band 4 | Band 5 |
|---|---|---|---|---|---|
| Warrior | 261 | 268 | 359 | 474 | 803 |
| Rogue | 326 | 543 | 600 | 821 | 1,267 |
| Mage | 68 | 147 | 190 | 242 | 370 |
| Cleric | 84 | 638 | 1,009 | 1,661 | 2,446 |
| Ranger | 607 | 832 | 1,120 | 1,763 | 2,539 |
| Monk | 275 | 590 | 973 | 1,859 | 3,186 |

**Surprise: fragile classes did not end up with higher values.** The design expected a Mage to finish with fewer potions, so each should pay more. In this model the Mage finishes with *more* unused potions (a one-hit burst kills it before it can drink, and it drinks less because it fights less), so equalizing the bonus gives it a *lower* per-potion value than the Warrior. Please treat this table as a placeholder. The real answer needs real fights, because it depends on how a hero uses potions mid-fight.

## 8. Gold and loot

| Class | Gold per surviving run, Easy | Average | Hard | Unused dungeon potions at exit (Easy) |
|---|---|---|---|---|
| Warrior | 90 | 82 | 48 | 1.9 |
| Rogue | 81 | 61 | 44 | 0.6 |
| Mage | 72 | 54 | 30 | 3.0 |
| Cleric | 86 | 67 | 34 | 1.7 |
| Ranger | 85 | 62 | 35 | 1.2 |
| Monk | 91 | 82 | 60 | 1.0 |

Gold is about **84 a run** at the 30% portal rate, close to the inventory sim's 80. A plain gear piece is 60 gold, so that is **0.7 days per piece, against your target of about 3**. A **10% portal rate** gives about 28 gold a run and 2.1 days per piece; about **7%** reaches 3 days. Drop volume is unchanged from the inventory sim (about 16 items a run, bag of 8), where I found the bag cap fine.

## 9. What I did not model, and what to check next

- **No real maze.** Fights are placed in depth order with a fixed 14 steps between them. Real corridors, dead ends, doors, holes and monsters that chase mean more or fewer fights per run.
- **Player skill is one policy** (fight what you meet, drink when low, flee when nearly dead). Real players avoid fights, use doors and exploration skills, and make mistakes. My "Adaptive" and "Easy" players are bookends.
- **Skills are simplified.** Only the main damage or defence skill of each class is modelled, capstones and most exploration skills are not, and SP costs are guesses.
- **Equipment adds nothing** (gearBonus 0). Gear is capped to the band, but it would still raise power a little.
- **No mid-run level-ups** in the death-rate runs (XP per run is measured at a fixed level). Levels gained mid-run would make late fights easier.
- **Death rates come from one target I picked** (Average ≈ 12%). Change `TARGET_AVERAGE_DEATH` in `tune.js` and re-run if you want it harder.
- **Next:** once the engine's Dungeon exists, plug a real `playRun` into the same tuner and the same career model (`careers.js`), then ship the numbers as the content table.

## 10. How to re-run

```
cd /mnt/project-files/combat/sim/balance
node tune.js 5 0.15                              # tune class powers at width 5 (about 1 minute)
for w in 2 3 4 6; do node tune.js $w 0.15 tuned-w5-g0.15.json; done   # re-scale monsters per width
for w in 2 3 4 5 6; do node careers.js $w 600; done                    # XP, pace, potions (about 1 minute each)
node report.js 4                                # rebuild this file and balance-tuned.json
```
In Docker (your rule for dev tools): `docker run --rm -v "$PWD":/w -w /w node:22 node tune.js 5 0.15`.
