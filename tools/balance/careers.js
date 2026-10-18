// Balance bot, part 3: XP per run, the XP table, potion values and days per level, for ONE band width.
//   node careers.js <bandWidth>        reads tuned-w<width>-g0.25.json, writes results-w<width>.json
//
// Method:
//  1. Play many runs for every (class, hero level, difficulty) and record what a run is worth.
//  2. A "career" is one run a day. XP per day = proficiency XP (kept even on death) + the escape
//     bonus (only if you survive) + the potion bonus (only if you survive).
//  3. Pick the XP table need(L) = N x r^(L-1) and the monster XP growth g that best hit Mike's
//     pace targets, then read off days per level for each policy and class.
'use strict';
const fs = require('fs');
const path = require('path');
const m = require('./model.js');

const width = Number(process.argv[2] ?? 3);
const RUNS = Number(process.argv[3] ?? 250);
const tuned = JSON.parse(fs.readFileSync(path.join(__dirname, `tuned-w${width}-g${process.env.G ?? '0.15'}.json`)));
const G_LIST = [1.05, 1.10, 1.15, 1.20, 1.25, 1.30];
const DIFF_MULT = [1, 1, 1];   // XP multiplier per difficulty (Easy, Average, Hard), set after the pace fit
const cfg = {...m.CONFIG, bandWidth: width, tierPower: tuned.tierPower, monsterGrowth: tuned.monsterGrowth, classPower: tuned.classPower, gList: G_LIST};
const LEVELS = Array.from({length: 20}, (_, i) => i + 1);

// Mike's pace targets (7.3a): cumulative day on which the hero first reaches level L (a daily player).
// Level 2 after the first run, level 3 after day 2, halfway to 5 by day 7, level 20 around day 60.
const TARGET_DAY = {2: 1, 3: 2, 4: 5, 5: 8.5};
for (let L = 6; L <= 20; ++L) TARGET_DAY[L] = 8.5 + (L - 5) * (60 - 8.5) / 15;
const MAX_DAYS_PER_LEVEL = 5;

// ---- 1. measure runs ----
// cell[cls][L][diff] = means over RUNS runs
const cell = {};
for (const cls of m.CLASS_NAMES) {
	cell[cls] = {};
	let seed = 1000;
	for (const L of LEVELS) {
		cell[cls][L] = [];
		for (const diff of [0, 1, 2]) {
			const rand = m.mulberry32(seed++ * 7919 + diff);
			const acc = {died: 0, potSurv: 0, goldSurv: 0, fights: 0, raw: G_LIST.map(() => 0), rawSurv: G_LIST.map(() => 0), potential: G_LIST.map(() => 0)};
			for (let i = 0; i < RUNS; ++i) {
				const r = m.playRun(rand, cls, L, diff, cfg);
				acc.died += r.died; acc.fights += r.fights; acc.goldSurv += r.gold;
				if (!r.died) acc.potSurv += r.potions;
				G_LIST.forEach((_, k) => { acc.raw[k] += r.rawXpG[k]; acc.potential[k] += r.potentialG[k]; if (!r.died) acc.rawSurv[k] += r.rawXpG[k]; });
			}
			const n = RUNS;
			cell[cls][L].push({died: acc.died / n, potSurv: acc.potSurv / n, gold: acc.goldSurv / n, fights: acc.fights / n,
				raw: acc.raw.map(x => x / n), rawSurv: acc.rawSurv.map(x => x / n), potential: acc.potential.map(x => x / n)});
		}
	}
}

// ---- 2. potion value per class per band (7.3a) ----
// Each potion left over at the exit pays v XP. v is set per class and band so that the average
// potion bonus is POTION_SHARE of a Average run's XP for every class (fragile classes end runs
// with fewer potions, so each one is worth more). Uses the middle growth rate; v scales with g.
const POTION_SHARE = 0.08;
const bands = Array.from({length: Math.ceil(20 / width)}, (_, b) => b);
const potionValue = {};   // [cls][band] in XP per potion at g = G_LIST[2]
const gi0 = 2;
for (const cls of m.CLASS_NAMES) {
	potionValue[cls] = {};
	for (const b of bands) {
		const Ls = LEVELS.filter(L => m.bandOf(L, width) === b);
		let xp = 0, pots = 0;
		for (const L of Ls) { const c = cell[cls][L][1]; xp += c.raw[gi0] * 1; pots += c.potSurv; }
		potionValue[cls][b] = pots > 0 ? POTION_SHARE * xp / pots : 0;
	}
}

// ---- XP per day ----
// v at other growth rates scales the same way as the monsters' XP, so use the ratio of potentials.
function xpPerDay(cls, L, diff, gi) {
	const c = cell[cls][L][diff], loss = m.lossShare(L, diff);
	const prof = c.raw[gi] * (1 - loss);
	const escape = c.rawSurv[gi] * loss;
	const ratio = c.potential[gi] / (cell[cls][L][diff].potential[gi0] || 1);
	const v = potionValue[cls][m.bandOf(L, width)] * ratio;
	const potion = Math.min(c.potSurv * v, 0.2 * (prof + escape));
	return {prof, escape, potion, total: (prof + escape + potion) * DIFF_MULT[diff]};
}

// ---- 3. careers ----
function policyDiff(cls, L, policy) {
	if (policy === 'Easy') return 0;
	if (policy === 'Average') return 1;
	if (policy === 'Hard') return 2;
	// Adaptive: the hardest difficulty that kills at most 12% of runs.
	for (let d = 2; d >= 0; --d) if (cell[cls][L][d].died <= 0.12) return d;
	return 0;
}
// Day on which each level is first reached, for one class and policy.
function career(cls, policy, need, gi) {
	const reach = {1: 0};
	let level = 1, xp = 0;
	for (let day = 1; day <= 400 && level < 20; ++day) {
		const d = policyDiff(cls, level, policy);
		xp += xpPerDay(cls, level, d, gi).total;
		if (level === 1 && xp < need(1)) xp = need(1);   // first-run XP floor: level 2 after run one, even after a death
		while (level < 20 && xp >= need(level)) { xp -= need(level); ++level; reach[level] = day; }
	}
	return reach;
}
const meanReach = (policy, need, gi) => {
	const out = {};
	for (let L = 2; L <= 20; ++L) {
		const days = m.CLASS_NAMES.map(c => career(c, policy, need, gi)[L] ?? 400);
		out[L] = days.reduce((a, x) => a + x, 0) / days.length;
	}
	return out;
};
function daysPerLevel(reach) { const d = {}; for (let L = 2; L <= 20; ++L) d[L] = reach[L] - (reach[L - 1] ?? 0); return d; }

// Fit need(L) = N x r^(L-1) (and the monster XP growth g) to the targets, for the Easy player
// ("a short run on Easy is enough", 7.3a): the hardest promise, so everyone else is at least that fast.
const e1 = m.CLASS_NAMES.reduce((a, c) => a + xpPerDay(c, 1, 0, gi0).total, 0) / 6;
// Pace fit: choose the table AND the monster XP growth g that best hit the targets for Easy.
// The fit barely depends on g (g and the table ratio r trade off), so g is pinned to one value for
// every width; that keeps the widths comparable, and the difficulty multipliers absorb the rest.
const FIXED_G = 1.20;
let fit = null;
for (let gi = G_LIST.indexOf(FIXED_G); gi <= G_LIST.indexOf(FIXED_G); ++gi) {
	for (let r = 1.0; r <= 1.5; r += 0.01) for (let k = -12; k <= 12; ++k) {
		const N = e1 * Math.pow(1.12, k) ;
		const need = L => N * Math.pow(r, L - 1);
		const reach = meanReach('Easy', need, gi);
		let err = 0, worst = 0;
		for (let L = 2; L <= 20; ++L) {
			err += Math.log(Math.max(0.5, reach[L]) / TARGET_DAY[L]) ** 2;
			worst = Math.max(worst, reach[L] - (reach[L - 1] ?? 0));
		}
		err = err / 19 + Math.max(0, worst - MAX_DAYS_PER_LEVEL) ** 2 * 0.1;
		if (!fit || err < fit.err) fit = {err, g: G_LIST[gi], gi, r, N, worst};
	}
}
// The carrot: how much more XP per day a harder difficulty should pay than Easy (Claude's proposals,
// not Mike's decisions). Monster XP alone can't pay it (deaths cost XP), so each difficulty gets an
// XP multiplier, set so the mean over levels 2..20 and the six classes matches.
const CARROT = {1: 1.35, 2: 1.7};
const rawRatio = d => { let sum = 0; for (let L = 2; L <= 20; ++L) sum += m.CLASS_NAMES.reduce((a, c) => a + xpPerDay(c, L, d, fit.gi).total, 0) / m.CLASS_NAMES.reduce((a, c) => a + xpPerDay(c, L, 0, fit.gi).total, 0); return sum / 19; };
const rawAvg = rawRatio(1), rawHard = rawRatio(2);
DIFF_MULT[1] = CARROT[1] / rawAvg; DIFF_MULT[2] = CARROT[2] / rawHard;
const need = L => fit.N * Math.pow(fit.r, L - 1);

// ---- results ----
const res = {width, runs: RUNS, diffMult: DIFF_MULT.slice(), rawRatio: [1, rawAvg, rawHard], fit: {g: fit.g, r: fit.r, N: fit.N, err: fit.err, worstDaysPerLevel: fit.worst}, tuned,
	table: LEVELS.slice(0, 19).map(L => Math.round(need(L))), potionValue, policies: {}, byClass: {}, runStats: {}};
for (const policy of ['Easy', 'Average', 'Hard', 'Adaptive']) {
	const reach = meanReach(policy, need, fit.gi);
	const dpl = daysPerLevel(reach);
	res.policies[policy] = {reach, daysPerLevel: dpl, worst: Math.max(...Object.values(dpl)), day7: levelAtDay(reach, 7), day60: levelAtDay(reach, 60)};
}
function levelAtDay(reach, day) {
	let L = 1;
	while (L < 20 && reach[L + 1] <= day) ++L;
	if (L >= 20) return 20;
	const prev = reach[L] ?? 0, next = reach[L + 1];
	return L + (day - prev) / (next - prev);
}
for (const cls of m.CLASS_NAMES) {
	res.byClass[cls] = {};
	for (const policy of ['Easy', 'Average', 'Adaptive']) {
		const r = career(cls, policy, need, fit.gi);
		res.byClass[cls][policy] = {day20: r[20] ?? null, day10: r[10] ?? null, maxDaysPerLevel: Math.max(...Array.from({length: 19}, (_, i) => (r[i + 2] ?? 400) - (r[i + 1] ?? 0)))};
	}
}
// run stats per class / difficulty, averaged over levels 2..20
for (const cls of m.CLASS_NAMES) {
	res.runStats[cls] = [0, 1, 2].map(d => {
		const cs = LEVELS.filter(L => L >= 2).map(L => cell[cls][L][d]);
		const avg = f => cs.reduce((a, c) => a + f(c), 0) / cs.length;
		return {death: avg(c => c.died), gold: avg(c => c.gold), unusedPotions: avg(c => c.potSurv), fights: avg(c => c.fights)};
	});
}
res.deathByLevel = {};
for (const cls of m.CLASS_NAMES) res.deathByLevel[cls] = LEVELS.map(L => [0, 1, 2].map(d => cell[cls][L][d].died));
res.xpPerRun = {};
for (const cls of m.CLASS_NAMES) res.xpPerRun[cls] = LEVELS.map(L => [0, 1, 2].map(d => Math.round(xpPerDay(cls, L, d, fit.gi).total)));
// A table that hits the targets exactly for the Easy player (not geometric): need(L) = days wanted x XP per day.
const D = L => L <= 1 ? 0 : TARGET_DAY[L];
res.impliedTable = LEVELS.slice(0, 19).map(L => {
	const xpd = m.CLASS_NAMES.reduce((a, c) => a + xpPerDay(c, L, 0, fit.gi).total, 0) / 6;
	return Math.round(xpd * (D(L + 1) - D(L)));
});
// XP factor each class would need so every class reaches level 20 on the same day as the mean (approximation: time is inversely proportional to XP rate).
const d20 = m.CLASS_NAMES.map(c => res.byClass[c].Easy.day20 ?? 400), d20mean = d20.reduce((a, x) => a + x, 0) / d20.length;
res.classXpFactor = Object.fromEntries(m.CLASS_NAMES.map((c, i) => [c, d20mean / d20[i]]));
// Same, before the difficulty multipliers
res.diffRatioRaw = LEVELS.map(L => {
	const t = d => m.CLASS_NAMES.reduce((a, c) => a + xpPerDay(c, L, d, fit.gi).total / DIFF_MULT[d], 0);
	return [1, t(1) / t(0), t(2) / t(0)];
});
// How much more XP per day does a harder difficulty pay than Easy? (mean over classes, per hero level)
res.diffRatio = LEVELS.map(L => {
	const t = d => m.CLASS_NAMES.reduce((a, c) => a + xpPerDay(c, L, d, fit.gi).total, 0);
	return [1, t(1) / t(0), t(2) / t(0)];
});
fs.writeFileSync(path.join(__dirname, `results-w${width}.json`), JSON.stringify(res, null, 1));
console.log(`width ${width}: g ${fit.g} r ${fit.r.toFixed(2)} N ${Math.round(fit.N)} err ${fit.err.toFixed(3)}; Easy worst days/level ${res.policies.Easy.worst}, day-60 level ${res.policies.Easy.day60.toFixed(1)}`);
