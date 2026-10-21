// Single-fight arithmetic with the engine's own rules (strike(), dungeonHeroStats, dungeonMonsterStats):
//   node fights.js [heroLevel=9]
// For each class and species: how much of its HP a hero loses to one same-level monster, and how
// often it wins, by the monster's level offset k from the hero (Easy spans about -3..+4 inside a band).
'use strict';
const path = require('path'), vm = require('vm');
const ctx = require('../check_mazes_lib.js').load(path.join(__dirname, '..', '..'));
const C = vm.runInContext('DUNGEON_CONTENT', ctx), hs = vm.runInContext('dungeonHeroStats', ctx), ms = vm.runInContext('dungeonMonsterStats', ctx);
const N = 4000;
let seed = 1; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function strike(atk, def, as, ds, crit) {
	if (rnd() >= clamp(0.9 + 0.02 * (as - ds), 0.6, 0.98)) return 0;
	let d = atk * (0.85 + 0.3 * rnd()) - def / 2; rnd();
	if (rnd() < crit) d *= C.critMultiplier;
	return Math.max(1, Math.round(d));
}
function fight(h, m) {
	let hp = h.maxHp, mhp = m.maxHp, lost = 0;
	for (let r = 0; r < 200; ++r) {
		const heroFirst = h.spd >= m.spd;
		for (const who of heroFirst ? ['h', 'm'] : ['m', 'h']) {
			if (who == 'h') { mhp -= strike(h.atk, m.def, h.spd, m.spd, h.crit); if (mhp <= 0) return {win: 1, lost: (h.maxHp - hp) / h.maxHp}; }
			else { hp -= strike(m.atk, h.def, m.spd, h.spd, C.monsterCrit); if (hp <= 0) return {win: 0, lost: 1}; }
		}
	}
	return {win: 0, lost: 1};
}
if (require.main === module) {
const L = Number(process.argv[2] ?? 9);
const species = Object.keys(C.monsters);
for (const k of [-3, 0, 4]) {
	console.log(`\nmonster level = hero level ${L} ${k >= 0 ? '+' : ''}${k}: hero HP lost per fight (win%)`);
	console.log('          ' + species.map(s => s.padEnd(13)).join(''));
	for (const cls of Object.keys(C.classes)) {
		const h = hs(C, cls, L);
		console.log(cls.padEnd(10) + species.map(sp => {
			const m = ms(C, sp, Math.max(1, L + k)); let lost = 0, win = 0;
			for (let i = 0; i < N; ++i) { const r = fight(h, m); lost += r.lost; win += r.win; }
			return `${(lost / N * 100).toFixed(0)}% (${(win / N * 100).toFixed(0)})`.padEnd(13);
		}).join(''));
	}
}
}
module.exports = {C, hs, ms, fight, N};
