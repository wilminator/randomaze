'use strict';
// Balance bot, part 2: the tuner. Finds the monster strength and the per-class power factors that make
// runs at one difficulty (Easy by default) equally risky for every class and level.
//   node tune.js <bandWidth> <monsterGrowth> [initFile]     writes tuned-w<width>-g<growth>.json
//   e.g.  node tune.js 5 0.15                               full tune
//         node tune.js 4 0.15 tuned-w5-g0.15.json           keep that file's class powers, re-scale monsters
// TARGET (Claude's proposal, not Mike's decision; change it here or with CAL_DIFF=1 TARGET=0.12 node tune.js ...):
// Easy is the baseline (monsters from your own band), so it is calibrated; Average and Hard then show
// what the design's "+1 band, +2 bands" ladder does.
const CAL_DIFF = Number(process.env.CAL_DIFF ?? 0);              // difficulty the targets apply to: 0 Easy, 1 Average, 2 Hard
const TARGET_DEATH = Number(process.env.TARGET ?? 0.05);         // share of runs at that difficulty that end in death
const LEVELS = [2, 5, 8, 11, 14, 17, 20];
const RUNS = 60;                     // runs per (class, level) per evaluation

const fs = require('fs');
const path = require('path');
const m = require('./model.js');

const width = Number(process.argv[2] ?? 3);
const growth = Number(process.argv[3] ?? 0.15);
const initFrom = process.argv[4];   // 'tuned-w3-g0.25.json': keep its class powers, only re-scale the monsters   // monster stat growth per level: a SCENARIO, not fitted
const cfg = JSON.parse(JSON.stringify(m.CONFIG));
cfg.bandWidth = width;

// The variables being fitted. "monsterPower" multiplies every tier equally; the design's tier
// shape (3.5) is kept as is.
const vars = {monsterPower: 1, monsterGrowth: growth, ...Object.fromEntries(m.CLASS_NAMES.map(c => ['class_' + c, 1]))};
function apply() {
	for (const t of [1, 2, 3]) cfg.tierPower[t] = vars.monsterPower;
	cfg.monsterGrowth = vars.monsterGrowth;
	for (const c of m.CLASS_NAMES) cfg.classPower[c] = vars['class_' + c];
}

// Mean HP lost per run (in units of max HP) for every (class, level), measured in IMMORTAL mode:
// a hero who would die is restored to full HP and the run goes on, so every run is the same length
// and HP lost is a fair measure of "how hard is this" (a dying hero stops losing HP, which fooled
// my first attempt into weakening the classes that die fastest). Same random numbers every time.
function measure(diff = CAL_DIFF, runs = RUNS, immortal = true) {
	const out = {};
	let seed = 4242;
	const old = cfg.immortal; cfg.immortal = immortal;
	for (const c of m.CLASS_NAMES) for (const L of LEVELS) {
		const rand = m.mulberry32(seed++);
		let lost = 0, died = 0;
		for (let i = 0; i < runs; ++i) { const r = m.playRun(rand, c, L, diff, cfg); lost += r.deaths + 0.05 * r.hpLost; died += r.died; }
		out[c + L] = {lost: lost / runs, died: died / runs};
	}
	cfg.immortal = old;
	return out;
}
const geo = o => Math.exp(Object.values(o).reduce((a, x) => a + Math.log(Math.max(0.02, x)), 0) / Object.keys(o).length);
const mean = o => Object.values(o).reduce((a, x) => a + x, 0) / Object.keys(o).length;
const pickKeys = (r, f) => Object.fromEntries(Object.entries(r).filter(([k]) => f(k)));

// Equalize: moves class powers and monster growth so every (class, level) burns the same amount of HP.
function equalize(passes) {
	const loss = () => {
		apply();
		const r = measure(), t = geo(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.lost])));
		let e = 0;
		for (const k in r) e += Math.log(Math.max(0.02, r[k].lost) / t) ** 2;
		return e / Object.keys(r).length;
	};
	let best = loss();
	for (let step = 0.5; step > 0.04; step *= 0.7) {
		let improved = true;
		for (let round = 0; improved && round < 4; ++round) {
			improved = false;
			for (const v of Object.keys(vars)) {
				if (v === 'monsterPower' || v === 'monsterGrowth') continue;
				const old = vars[v];
				for (const f of [Math.exp(step), Math.exp(-step)]) {
					vars[v] = Math.max(0.1, Math.min(4, old * f));
					const l = loss();
					if (l < best - 1e-5) { best = l; improved = true; break; }
					vars[v] = old;
				}
			}
		}
	}
	apply();
	return best;
}

// Scale: moves monsterPower until the real (mortal) death rate at the calibration difficulty matches the target.
function scale() {
	let lo = 0.003, hi = 4;
	for (let i = 0; i < 14; ++i) {
		vars.monsterPower = Math.sqrt(lo * hi); apply();
		const d = mean(Object.fromEntries(Object.entries(measure(CAL_DIFF, 40, false)).map(([k, v]) => [k, v.died])));
		if (d < TARGET_DEATH) lo = vars.monsterPower; else hi = vars.monsterPower;
	}
	vars.monsterPower = Math.sqrt(lo * hi); apply();
}

console.log(`Tuning with band width ${width}, monster growth ${growth}${initFrom ? ', class powers from ' + initFrom : ''}`);
if (initFrom) {
	const init = JSON.parse(fs.readFileSync(path.join(__dirname, initFrom)));
	for (const c of m.CLASS_NAMES) vars['class_' + c] = init.classPower[c];
	vars.monsterPower = init.tierPower[1];
	apply(); scale();
	console.log(` monsterPower ${vars.monsterPower.toFixed(2)}`);
}
else for (let pass = 1; pass <= 3; ++pass) {
	const loss = equalize();
	scale();
	console.log(` pass ${pass}: spread ${loss.toFixed(3)}  monsterPower ${vars.monsterPower.toFixed(2)} growth ${vars.monsterGrowth.toFixed(3)}  classes ` + m.CLASS_NAMES.map(c => `${c.slice(0, 3)} ${vars['class_' + c].toFixed(2)}`).join(' '));
}
apply();
console.log(' class power:', m.CLASS_NAMES.map(c => `${c} ${cfg.classPower[c].toFixed(2)}`).join(', '));
for (const [diff, name] of [[0, 'Easy'], [1, 'Average'], [2, 'Hard']]) {
	const d = measure(diff, 150, false);
	console.log(` ${name}: death% (rows = hero level)`);
	for (const L of LEVELS) console.log('  L' + String(L).padEnd(3), m.CLASS_NAMES.map(c => c.slice(0, 3) + ' ' + String(Math.round(100 * d[c + L].died)).padStart(3)).join('  '));
}

fs.writeFileSync(path.join(__dirname, `tuned-w${width}-g${growth}.json`), JSON.stringify({bandWidth: width, tierPower: cfg.tierPower, monsterGrowth: cfg.monsterGrowth, classPower: cfg.classPower}, null, 2));
console.log(`wrote tuned-w${width}-g${growth}.json`);
