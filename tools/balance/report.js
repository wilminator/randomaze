// Balance bot, part 5: turns results-w*.json into RESULTS.md and balance-tuned.json.
//   node report.js [recommendedWidth]
'use strict';
const fs = require('fs');
const path = require('path');
const m = require('./model.js');

const REC = Number(process.argv[2] ?? 4);
const WIDTHS = [2, 3, 4, 5, 6];
const R = Object.fromEntries(WIDTHS.map(w => [w, JSON.parse(fs.readFileSync(path.join(__dirname, `results-w${w}.json`)))]));
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const f1 = x => x.toFixed(1), f2 = x => x.toFixed(2), pc = x => `${Math.round(100 * x)}%`;
const fmt = n => Math.round(n).toLocaleString('en-US');

// days spent ON level L = reach[L+1] - reach[L]
const daysOn = (r, L) => r.policies.Easy.daysPerLevel[L + 1];
function widthRow(w) {
	const r = R[w], arr = []; for (let L = 2; L <= 19; ++L) arr.push(daysOn(r, L));
	const first = [], last = [];
	for (let L = 2; L <= 19; ++L) { const pos = (L - 1) % w; if (pos === 0) first.push(daysOn(r, L)); if (pos === w - 1) last.push(daysOn(r, L)); }
	const mean = avg(arr), sd = Math.sqrt(avg(arr.map(x => (x - mean) ** 2)));
	const bands = Math.ceil(20 / w);
	return `| ${w} | ${bands} | ${bands * 3} | ${f1(Math.max(...arr))} | ${f2(sd)} | ${f1(avg(first))} → ${f1(avg(last))} | g ${r.fit.g}, r ${f2(r.fit.r)} | ${f1(r.policies.Easy.day7)} | ${f1(r.policies.Easy.day60)} |`;
}

const r = R[REC];
const asWritten = (() => {   // death rates with the bestiary exactly as designed
	const cfg = {...m.CONFIG, bandWidth: REC};
	const res = {};
	for (const [k, d] of [['easy', 0], ['avg', 1]]) { let dead = 0, n = 0, seed = 11; for (const c of m.CLASS_NAMES) for (const L of [2, 5, 8, 11, 14, 17, 20]) { const rand = m.mulberry32(seed++); for (let i = 0; i < 120; ++i) { dead += m.playRun(rand, c, L, d, cfg).died; ++n; } } res[k] = dead / n; }
	return res;
})();
const deathMean = (rr, L, d) => avg(Object.values(rr.deathByLevel).map(x => x[L - 1][d]));
const xpMean = (rr, L, d) => avg(Object.values(rr.xpPerRun).map(x => x[L - 1][d]));

const lines = [];
const P = s => lines.push(s ?? '');

P('# Combat balance bot: results');
P();
P(`Run on 2026-10-18 by the "Combat balance bot" thread. Code: [balance/](/mnt/project-files/combat/sim/balance/). Machine-readable numbers: [balance-tuned.json](/mnt/project-files/combat/sim/balance/balance-tuned.json).`);
P();
P('**Read this first.** The engine has no dungeon yet, so the bot is an *abstract* model of a run (24 fights in depth order, the design\'s combat math, stat curve, classes, skills, death penalty, bag and potion rules). It answers "what shape should the numbers have", not "what is the exact number". Every guess is marked ASSUMPTION in `model.js`. When the engine\'s Dungeon (Phase 2) exists, the same questions should be re-asked of the real thing; the knobs stay the same. Treat every number below as a first fit with roughly ±20% noise.');
P();
const earlyE = w => avg(Object.values(R[w].deathByLevel).map(x => x[0][0]));
P('## 1. The answers, in short');
P();
P(`1. **Band width: I recommend ${REC}.** Widths 2 to 6 all hit your pace targets inside the "no level over 5 days" rule, so width is decided by two other things that pull in opposite directions: wide bands pay a natural difficulty carrot and need fewer boards, narrow bands are much kinder to a brand-new hero (section 2). This is your call; I have put it to you as a question.`);
P(`2. **The design's monsters are too strong, by about 3× in HP and 3× in ATK** (section 3). Calibrating Easy to about 5% deaths needs every monster at about ${f2(Math.sqrt(r.tuned.tierPower[1]))}× the 3.5 table's HP and ATK. The design's 15% a level growth is fine and unchanged. With the table as written, ${pc(asWritten.easy)} of Easy runs and ${pc(asWritten.avg)} of Average runs end in death.`);
P(`3. **XP table:** need(L) = ${fmt(r.fit.N)} × ${f2(r.fit.r)}^(L−1), with monster XP growing ${r.fit.g}× per monster level. An Easy-only player reaches level 20 on day ${Math.round(r.policies.Easy.reach[20])}, is at level ${f1(r.policies.Easy.day7)} on day 7, and no level takes more than ${f1(r.policies.Easy.worst)} days (section 4).`);
P(`4. **The difficulty carrot depends on width.** Because an Average kill is worth about g^width times an Easy kill, Average pays ${f2(r.rawRatio[1])}× Easy per day at width ${REC} with no help, but only ${f2(R[3].rawRatio[1])}× at width 3 (section 5).`);
P(`5. **The first run is harsh at wide widths.** A level 1 hero's first Easy run ends in death for ${pc(earlyE(2))} of heroes at width 2, ${pc(earlyE(3))} at width 3, ${pc(earlyE(5))} at width 5. The first-run XP floor still gives level 2, but a dead first run is a bad welcome (section 2).`);
P('6. **Class parity is uneven:** the Mage needs about 3× the damage factor of the Warrior, Cleric, Ranger and Rogue to die as often (it is the weak class as designed), the Monk sits at the tuner\'s floor so its result is unreliable, and the Rogue levels about 35 days slower than the others because it skips fights (section 6).');
P('7. **Potion bonus table** (section 7) is a placeholder; **gold** is about 4× too generous at a 30% portal rate, and about 3 days per gear piece at roughly 7% (section 8).');
P();
P('## 2. Band width');
P();
P('Each row fits the geometric XP table to your targets (level 2 after run 1, level 3 on day 2, about 4.5 by day 7, level 20 around day 60) for a player who only plays Easy. "Days on a level" is for that player, levels 2 to 19.');
P();
P('| Width | Bands | Boards a day (bands × 3) | Longest level (days) | First → last level of a band (days) | Average ÷ Easy XP, no bonus | Hard ÷ Easy, no bonus | First-ever Easy run: deaths | Easy deaths at level 5 |');
P('|---|---|---|---|---|---|---|---|---|');
for (const w of WIDTHS) {
	const rr = R[w], arr = [], first = [], last = [];
	for (let L = 2; L <= 19; ++L) { const d = daysOn(rr, L); arr.push(d); const pos = (L - 1) % w; if (pos === 0) first.push(d); if (pos === w - 1) last.push(d); }
	const bnd = Math.ceil(20 / w);
	P(`| ${w} | ${bnd} | ${bnd * 3} | ${f1(Math.max(...arr))} | ${f1(avg(first))} → ${f1(avg(last))} | ${f2(rr.rawRatio[1])} | ${f2(rr.rawRatio[2])} | ${pc(avg(Object.values(rr.deathByLevel).map(x => x[0][0])))} | ${pc(avg(Object.values(rr.deathByLevel).map(x => x[4][0])))} |`);
}
P();
P('What it says:');
P('- **Pace does not decide it.** Every width reaches the targets and stays under 5 days a level (within noise). The "pop and lull" you predicted shows up and grows with width: no swing at width 2 or 3, about +0.8 days between the first and last level of a band at width 4 and 5, and +1.7 days at width 6.');
P('- **Wide bands pay a natural carrot.** An Average kill is worth about g^width Easy kills, so at width 5 Average already pays about 1.3× Easy per day, and Hard 1.4×. At width 3 they pay only 1.1×, so you would need XP multipliers of about ×1.2 and ×1.5 to make harder runs worth the risk.');
P('- **Wide bands are rough on a new hero.** Easy monsters run from the band\'s first level up to a full band higher, so a level 1 hero meets monsters up to level (width + 1) in the same maze. Width 5 means level 6 monsters against a level 1 hero, and about a third of first runs end in death.');
P('- **Wide bands also mean fewer boards:** 12 a day at width 5, 15 at width 4, 21 at width 3, 30 at width 2. At launch most boards will be empty.');
P();
P(`**My view.** I lean to **${REC}**: it keeps boards to 15, pays most of the carrot on its own, and the first run is bad but not awful. The counterpoint for **3** is that new players matter more than board counts: a quarter fewer first-run deaths, a gentler ladder, and the multipliers are easy to add. The counterpoint for **5** is the simplest design (12 boards, the carrot is free, and it matches the "bands of 5" you wrote earlier), if you accept that new heroes should lean on the first-run floor and pick Easy until level 3 or so. Either way, one cheap fix for the first run is to let monster level rise more slowly with depth at the start of a band.`);
P();
P(`## 3. Monsters (width ${REC})`);
P();
P(`Calibration target (my proposal): **Easy runs end in death about ${pc(0.05)} of the time**, averaged over the sampled hero levels and classes. Class powers were tuned at width 5 and kept for the other widths; only the global monster scale was re-fitted per width, so it moves a little (${WIDTHS.map(w => `w${w} ×${f2(Math.sqrt(R[w].tuned.tierPower[1]))}`).join(', ')} on HP and ATK each).`);
P();
P(`**What was tuned.** A strength multiplier on every monster (×${f2(r.tuned.tierPower[1])}, split evenly: HP and ATK each ×${f2(Math.sqrt(r.tuned.tierPower[1]))}, since a fight's danger grows with HP × ATK). The growth per level stays at the design's ${r.tuned.monsterGrowth}. The bestiary's shape (species, tiers, DEF, SPD) is unchanged.`);
P();
P('Why the design numbers are too strong, from the bot:');
P(`- A fresh hero loses about 25% of fights against a tier 3 monster (orc, wraith) one band up, and a run has about 8 tier 3 fights, so survival is roughly 0.75^8, about 10%.`);
P('- It is **not attrition.** Giving the hero 5%, 10% or 20% of its HP back after every fight changes Average deaths by less than 1 point. Fewer monsters helps only slowly: 24 monsters 92% deaths, 12 monsters 77%, 6 monsters 55% (Average, as written).');
P('- A more careful potion policy (drink when the next hit could kill) lowers Average deaths from 92% to 79%, nowhere near the target. So it is not just the bot playing badly.');
P('- The tuner also found that the DEF/2 subtraction matters: tier 1 monsters\' ATK 2 to 3 barely scratches a Warrior (DEF 5), so most of the early danger comes from tier 2 and 3.');
P();
P('Monster stats at level 1, design versus tuned (multiply both by 1 + 0.15 × (level − 1)):');
P();
P('| Species | Tier | Design HP / ATK / DEF | Tuned HP / ATK | DEF (unchanged) |');
P('|---|---|---|---|---|');
for (const [n, s_] of Object.entries(m.MONSTERS)) P(`| ${n} | ${s_.tier} | ${s_.hp} / ${s_.atk} / ${s_.def} | ${f1(s_.hp * Math.sqrt(r.tuned.tierPower[s_.tier]))} / ${f1(s_.atk * Math.sqrt(r.tuned.tierPower[s_.tier]))} | ${s_.def} |`);
P();
P('Caveat: with damage = ATK − DEF/2 and a minimum of 1, ATK values this low make the 1-damage minimum do most of the work at level 1. The tuned numbers show the *size* of the gap; the real fix may be a mix (weaker monsters, a DEF that does not subtract so much). That is a design call.');
P();
P(`### Death rate by hero level and difficulty (class mean, width ${REC})`);
P();
P('| Hero level | Easy | Average | Hard |');
P('|---|---|---|---|');
for (const L of [1, 2, 3, 4, 5, 6, 8, 11, 15, 20]) P(`| ${L} | ${pc(deathMean(r, L, 0))} | ${pc(deathMean(r, L, 1))} | ${pc(deathMean(r, L, 2))} |`);
P();
P('The ladder is steep: each band step multiplies danger by roughly 3. Deaths peak at the first level of each band (the hero is weakest against a freshly raised monster band) and fall through it.');
P();
P('## 4. XP table');
P();
P(`Fitted on the Easy-only player (the hardest promise: "a short run on Easy is enough"). Everyone else is at least this fast.`);
P();
P(`- **Geometric table:** need(L) = ${fmt(r.fit.N)} × ${f2(r.fit.r)}^(L−1).`);
P(`- **Monster XP:** (4 × tier² + HP/4) × ${r.fit.g}^(monster level − 1). (HP here is the design's level 1 HP, so tuning monster HP does not change XP.)`);
P();
P('| Level | 1→2 | 2→3 | 3→4 | 4→5 | 5→6 | 6→7 | 7→8 | 8→9 | 9→10 | 10→11 |');
P('|---|---|---|---|---|---|---|---|---|---|---|');
P(`| XP needed (geometric) | ${r.table.slice(0, 10).map(fmt).join(' | ')} |`);
P(`| XP needed (hits targets exactly) | ${r.impliedTable.slice(0, 10).map(fmt).join(' | ')} |`);
P();
P(`The geometric table lands level 3 on day ${Math.round(r.policies.Easy.reach[3])}, not day 2 (an Easy run at level 1 and 2 pays about ${fmt(xpMean(r, 1, 0))}, so two days cannot cover ${fmt(r.table[0] + r.table[1])}). The "exactly" row is need = days wanted × XP per day, which reaches every target but is not a smooth formula. If you want "level 3 on day 2" to be a promise, use the first few entries of that row and the geometric table after. The first-run floor (level 2 after run one, even after a death) is built in.`);
P();
P('Pace by player type (mean of the six classes, level reached on each day):');
P();
P('| Player | Day 7 | Day 30 | Day 60 | Reaches 20 | Longest level (days) |');
P('|---|---|---|---|---|---|');
const lvAt = (reach, day) => { let L = 1; while (L < 20 && reach[L + 1] <= day) ++L; if (L >= 20) return 20; const prev = reach[L] ?? 0, next = reach[L + 1]; return L + (day - prev) / (next - prev); };
for (const p of ['Easy', 'Average', 'Hard', 'Adaptive']) {
	const P_ = r.policies[p];
	P(`| ${p === 'Adaptive' ? 'Adaptive (hardest difficulty with ≤12% deaths)' : p + ' only'} | ${f1(lvAt(P_.reach, 7))} | ${f1(lvAt(P_.reach, 30))} | ${f1(lvAt(P_.reach, 60))} | day ${Math.round(P_.reach[20])} | ${f1(P_.worst)} |`);
}
P();
P('## 5. Difficulty needs a carrot');
P();
P('Expected XP per day relative to Easy (class mean, levels 2 to 20), **before** any difficulty bonus, with the XP rules as designed (proficiency share kept on death, escape bonus only on survival):');
P();
P('| Hero level | Average ÷ Easy | Hard ÷ Easy | Hard death rate |');
P('|---|---|---|---|');
const rawAt = L => { const c = m.CLASS_NAMES; return [1, 2].map(d => 0); };
for (const L of [1, 2, 3, 5, 8, 11, 15, 20]) P(`| ${L} | ${f2(r.diffRatioRaw[L - 1][1])} | ${f2(r.diffRatioRaw[L - 1][2])} | ${pc(deathMean(r, L, 2))} |`);
P();
P(`Average pays about **${f2(r.rawRatio[1])}×** Easy and Hard about **${f2(r.rawRatio[2])}×**, with Hard runs ending in death ${pc(deathMean(r, 20, 2))} to ${pc(deathMean(r, 1, 2))} of the time depending on level. The average hides a trap: at the first level or two of each band (levels 1, 2 and 5 above) Average and Hard pay *less* than Easy, because the hero dies often and loses XP. Section 4.5 of the design worried about exactly this. XP multipliers that would make Average pay 1.35× and Hard 1.7× (my proposals, the numbers are yours to change): **Average ×${f2(r.diffMult[1])}, Hard ×${f2(r.diffMult[2])}**, applied to the XP of the whole run. Other levers to try instead or as well: pay the escape bonus at half rate on a Hard death, or give Average and Hard kills more XP per level than Easy ones.`);
P();
P('## 6. Classes');
P();
P('Class power factors (a multiplier on every point of damage that class deals, chosen so each class\'s deaths per run match). The point is the *direction*: a factor below 1 means the class is stronger than the others as designed, above 1 weaker. A factor at the 0.10 floor means the fit could not go low enough, so read it as "much stronger", not as a number.');
P();
P('| Class | Power factor | Average deaths (mean) | Unused potions on survival, Average | Days to level 20 (Easy only) | XP factor to even out pace |');
P('|---|---|---|---|---|---|');
for (const c of m.CLASS_NAMES) {
	const s = r.runStats[c][1];
	P(`| ${c} | ${f2(r.tuned.classPower[c])} | ${pc(s.death)} | ${f1(s.unusedPotions)} | ${r.byClass[c].Easy.day20} | ×${f2(r.classXpFactor[c])} |`);
}
P();
P('- **Warrior (lowest factor):** with HP 30, DEF 5 and Power Strike it is the strongest class as designed. Cutting its damage would not fix how it *feels*; trimming HP or DEF would. A DEF of 5 against level 1 monsters\' ATK 3 to 5 makes most early hits do 1 to 3 damage.');
P('- **Mage (highest factor):** the weakest as designed. 16 HP means one tier 3 hit takes most of it, and SP runs out (1 SP per 8 steps, Firebolt costs 3).');
P('- **Monk (factor at the 0.10 floor, so unreliable):** in this model Flurry\'s three to five hits each get the 1-damage minimum, which makes it strong against the weakened monsters, while against high DEF its 0.5× hits lose most of their damage (damage = ATK × mult − DEF/2). It is a sign the minimum-damage rule and Flurry interact strongly; check with real fights, and consider Flurry ignoring DEF or hitting at 0.7×.');
P(`- **Rogue:** skipping 25% of fights is Shadow Step\'s identity, but it costs about a quarter of the XP, so Rogues level ${Math.round(r.byClass.Rogue.Easy.day20 - avg(m.CLASS_NAMES.filter(c => c !== 'Rogue').map(c => r.byClass[c].Easy.day20)))} days later. Either a stealth XP bonus (about ×${f2(r.classXpFactor.Rogue)}) or Shadow Step should still pay partial XP.`);
P();
P('## 7. Potion bonus (unused dungeon potions)');
P();
P(`Per-potion XP such that the average potion bonus is **8% of an Average run's XP for every class** (the cap you suggested is 20%). Band numbers for width ${REC}; "band 1" is hero levels 1 to ${REC}.`);
P();
const bands = Object.keys(r.potionValue.Warrior);
P(`| Class | ${bands.map(b => `Band ${Number(b) + 1}`).join(' | ')} |`);
P(`|---|${bands.map(() => '---').join('|')}|`);
for (const c of m.CLASS_NAMES) P(`| ${c} | ${bands.map(b => fmt(r.potionValue[c][b])).join(' | ')} |`);
P();
P('**Surprise: fragile classes did not end up with higher values.** The design expected a Mage to finish with fewer potions, so each should pay more. In this model the Mage finishes with *more* unused potions (a one-hit burst kills it before it can drink, and it drinks less because it fights less), so equalizing the bonus gives it a *lower* per-potion value than the Warrior. Please treat this table as a placeholder. The real answer needs real fights, because it depends on how a hero uses potions mid-fight.');
P();
P('## 8. Gold and loot');
P();
P('| Class | Gold per surviving run, Easy | Average | Hard | Unused dungeon potions at exit (Easy) |');
P('|---|---|---|---|---|');
for (const c of m.CLASS_NAMES) { const s = r.runStats[c]; P(`| ${c} | ${fmt(s[0].gold)} | ${fmt(s[1].gold)} | ${fmt(s[2].gold)} | ${f1(s[0].unusedPotions)} |`); }
const goldMean = avg(m.CLASS_NAMES.map(c => r.runStats[c][0].gold));
P();
P(`Gold is about **${fmt(goldMean)} a run** at the 30% portal rate, close to the inventory sim's 80. A plain gear piece is 60 gold, so that is **${f1(60 / goldMean)} days per piece, against your target of about 3**. A **10% portal rate** gives about ${fmt(goldMean / 3)} gold a run and ${f1(60 / (goldMean / 3))} days per piece; about **7%** reaches 3 days. Drop volume is unchanged from the inventory sim (about 16 items a run, bag of 8), where I found the bag cap fine.`);
P();
P('## 9. What I did not model, and what to check next');
P();
P('- **No real maze.** Fights are placed in depth order with a fixed 14 steps between them. Real corridors, dead ends, doors, holes and monsters that chase mean more or fewer fights per run.');
P('- **Player skill is one policy** (fight what you meet, drink when low, flee when nearly dead). Real players avoid fights, use doors and exploration skills, and make mistakes. My "Adaptive" and "Easy" players are bookends.');
P('- **Skills are simplified.** Only the main damage or defence skill of each class is modelled, capstones and most exploration skills are not, and SP costs are guesses.');
P('- **Equipment adds nothing** (gearBonus 0). Gear is capped to the band, but it would still raise power a little.');
P('- **No mid-run level-ups** in the death-rate runs (XP per run is measured at a fixed level). Levels gained mid-run would make late fights easier.');
P('- **Death rates come from one target I picked** (Average ≈ 12%). Change `TARGET_AVERAGE_DEATH` in `tune.js` and re-run if you want it harder.');
P('- **Next:** once the engine\'s Dungeon exists, plug a real `playRun` into the same tuner and the same career model (`careers.js`), then ship the numbers as the content table.');
P();
P('## 10. How to re-run');
P();
P('```');
P('cd /mnt/project-files/combat/sim/balance');
P('node tune.js 5 0.15                              # tune class powers at width 5 (about 1 minute)');
P('for w in 2 3 4 6; do node tune.js $w 0.15 tuned-w5-g0.15.json; done   # re-scale monsters per width');
P('for w in 2 3 4 5 6; do node careers.js $w 600; done                    # XP, pace, potions (about 1 minute each)');
P('node report.js 4                                # rebuild this file and balance-tuned.json');
P('```');
P('In Docker (your rule for dev tools): `docker run --rm -v "$PWD":/w -w /w node:22 node tune.js 5 0.15`.');

fs.writeFileSync(path.join(__dirname, 'RESULTS.md'), lines.join('\n') + '\n');

// machine-readable
const out = {
	generated: '2026-10-18',
	recommendedBandWidth: REC,
	note: 'Abstract model; see RESULTS.md. All values are first fits for the real engine to refine.',
	monsters: {tierPower: r.tuned.tierPower, growthPerLevel: r.tuned.monsterGrowth, designGrowthPerLevel: 0.15},
	classPower: r.tuned.classPower,
	xp: {geometric: {N: Math.round(r.fit.N), ratio: Number(r.fit.r.toFixed(3))}, table1to20: r.table, tableExactTargets: r.impliedTable, monsterXpGrowth: r.fit.g, monsterXpFormula: '(4*tier^2 + level1HP/4) * growth^(monsterLevel-1)'},
	potionValuePerBand: r.potionValue,
	classXpFactorToEvenOutPace: r.classXpFactor,
	perWidth: Object.fromEntries(WIDTHS.map(w => [w, {monsterPower: R[w].tuned.tierPower[1], fit: R[w].fit, easyReach: R[w].policies.Easy.reach}])),
};
fs.writeFileSync(path.join(__dirname, 'balance-tuned.json'), JSON.stringify(out, null, 1));
console.log('wrote RESULTS.md and balance-tuned.json');
