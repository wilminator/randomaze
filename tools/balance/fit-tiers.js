// Fit one strength factor per monster tier (HP and ATK each scaled) so a same-level monster costs a
// hero the target share of HP. Default targets are for the Warrior, the baseline class, averaged over
// hero levels 5, 9, 14 and 19:  node fit-tiers.js [t1=0.05 t2=0.10 t3=0.20 boss=0.50]
'use strict';
const { C, hs, ms, fight } = require('./fights.js');
const targets = {1: Number(process.argv[2] ?? 0.05), 2: Number(process.argv[3] ?? 0.10), 3: Number(process.argv[4] ?? 0.20), 4: Number(process.argv[5] ?? 0.50)};
const LEVELS = [5, 9, 14, 19], N = 1500, base = JSON.parse(JSON.stringify(C.monsters));
const lossFor = (tier, f, cls = 'warrior', k = 0) => {
	let total = 0, n = 0;
	for (const [sp, m] of Object.entries(base)) {
		if (m.tier != tier) continue;
		C.monsters[sp] = {...m, hp: m.hp * f, atk: m.atk * f};
		for (const L of LEVELS) { const h = hs(C, cls, L), mo = ms(C, sp, Math.max(1, L + k)); for (let i = 0; i < N; ++i) { total += fight(h, mo).lost; ++n; } }
		C.monsters[sp] = m;
	}
	return total / n;
};
const fit = {};
for (const tier of [1, 2, 3, 4]) {
	let lo = Math.log(0.05), hi = Math.log(2);
	for (let i = 0; i < 14; ++i) { const mid = (lo + hi) / 2; if (lossFor(tier, Math.exp(mid)) > targets[tier]) hi = mid; else lo = mid; }
	fit[tier] = Math.exp((lo + hi) / 2);
	console.log(`tier ${tier}: x${fit[tier].toFixed(2)} (target ${targets[tier] * 100}% of HP)`);
}
const out = {};
for (const [sp, m] of Object.entries(base)) out[sp] = {hp: +(m.hp * fit[m.tier]).toFixed(1), atk: +(m.atk * fit[m.tier]).toFixed(2)};
console.log('\nnew hp/atk:', JSON.stringify(out));
console.log('\nHP lost per fight with those monsters (levels 5,9,14,19 averaged), by class and level offset k:');
for (const [sp, v] of Object.entries(out)) C.monsters[sp] = {...base[sp], ...v};
for (const k of [-3, 0, 4]) {
	console.log(`k=${k >= 0 ? '+' : ''}${k}  ` + ['warrior', 'rogue', 'mage', 'cleric', 'ranger', 'monk'].map(cls => {
		const row = [1, 2, 3, 4].map(t => { let tot = 0, n = 0; for (const [sp, m] of Object.entries(base)) { if (m.tier != t) continue; for (const L of LEVELS) { const h = hs(C, cls, L), mo = ms(C, sp, Math.max(1, L + k)); for (let i = 0; i < 600; ++i) { tot += fight(h, mo).lost; ++n; } } } return (tot / n * 100).toFixed(0).padStart(3) + '%'; });
		return `${cls} ${row.join('/')}`;
	}).join('  '));
}
require('fs').writeFileSync(__dirname + '/fit-tiers.json', JSON.stringify({targets, factors: fit, monsters: out}, null, 1));
