// Balance bot, part 4: how many monsters / how much healing can the design's bestiary support?
// Plays Average runs with the bestiary EXACTLY as written (power 1, growth 0.15, all classes power 1)
// and reports the death rate for different monster counts and rest-healing amounts.
'use strict';
const m = require('./model.js');
const LEVELS = [2, 5, 8, 11, 14, 17, 20], RUNS = 200;
const monsters = [24, 16, 12, 8, 6], heals = [0, 0.05, 0.10, 0.20];
console.log('Average-difficulty death% (mean of 6 classes and 7 hero levels), design bestiary as written');
console.log('monsters \\ rest heal after each fight: ' + heals.map(h => (h * 100) + '%').join('   '));
for (const n of monsters) {
	const row = heals.map(h => {
		const cfg = {...m.CONFIG, bandWidth: 3, monsters: n, restHeal: h};
		let d = 0, k = 0, seed = 99;
		for (const c of m.CLASS_NAMES) for (const L of LEVELS) { const rand = m.mulberry32(seed++); for (let i = 0; i < RUNS; ++i) { d += m.playRun(rand, c, L, 1, cfg).died; ++k; } }
		return (100 * d / k).toFixed(0).padStart(4) + '%';
	});
	console.log(String(n).padStart(8), '                              ' + row.join('  '));
}
