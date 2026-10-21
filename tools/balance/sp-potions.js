// How many SP potions a maze needs so a Mage that found them all could Firebolt every monster to death.
//   node sp-potions.js [days=20] [restore=0.5]
// For each hero level and difficulty: casts = sum over monsters of ceil(monster HP / Firebolt damage),
// SP needed = casts x cost, less the full tank the Mage starts with; potions = that / (restore x max SP).
// Firebolt damage is the average roll (spell x 1.0, rounded); regen along the way is ignored.
'use strict';
const path = require('path'), vm = require('vm');
const ctx = require('../check_mazes_lib.js').load(path.join(__dirname, '..', '..'));
const C = vm.runInContext('DUNGEON_CONTENT', ctx), hs = vm.runInContext('dungeonHeroStats', ctx), ms = vm.runInContext('dungeonMonsterStats', ctx), build = vm.runInContext('buildDungeon', ctx);
const days = Number(process.argv[2] ?? 20), restore = Number(process.argv[3] ?? C.potions.sp ?? 0.5), width = 4;
const dungeons = Array.from({length: days}, (_, d) => build(202610000 + d + 1));
const cells = dungeons.reduce((a, b) => a + b.maze.cellList.length, 0) / days;
const cost = C.skills.mage.sp;
const out = {};
console.log(`mage Firebolt ${cost} SP, potion restores ${restore * 100}% of max SP, ${days} dungeons of ${cells.toFixed(0)} cells on average`);
console.log('hero level | monsters | Easy: casts -> potions | Average | Hard');
for (const L of [1, 2, 3, 4, 5, 8, 12, 16, 20]) {
	const h = hs(C, 'mage', L), dmg = Math.max(1, Math.round(h.spell)), row = [];
	for (let diff = 0; diff <= 2; ++diff) {
		const first = 1 + (Math.floor((L - 1) / width) + diff) * width;
		let casts = 0, mons = 0;
		for (const { dungeon } of dungeons) for (const m of dungeon.monsters) { ++mons; casts += Math.ceil(ms(C, m.species, dungeon.monsterLevel(m, first, width)).maxHp / dmg); }
		casts /= days; mons /= days;
		const need = Math.max(0, casts * cost - h.maxSp), potions = need / (restore * h.maxSp);
		row.push({ casts, mons, potions });
		(out[diff] ??= []).push(potions);
	}
	console.log(`${String(L).padStart(10)} | ${row[0].mons.toFixed(0).padStart(8)} | ${row.map(r => `${r.casts.toFixed(0).padStart(3)} casts -> ${r.potions.toFixed(1).padStart(4)}`).join(' | ')}`);
}
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`\nmean over these levels: Easy ${mean(out[0]).toFixed(1)}, Average ${mean(out[1]).toFixed(1)}, Hard ${mean(out[2]).toFixed(1)} potions per maze`);
console.log(`=> one SP potion per ${(cells / mean(out[0])).toFixed(0)} cells (Easy), ${(cells / mean(out[1])).toFixed(0)} (Average), ${(cells / mean(out[2])).toFixed(0)} (Hard)`);
