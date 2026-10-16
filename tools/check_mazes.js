/*
Headless maze checker: generates many mazes in Node (no browser) and reports
crashes, hangs, and mazes where the player can get permanently stuck.

Setup (once):   npm install --no-save seedrandom@3.0.5
Run:            node tools/check_mazes.js [mazesPerType=200] [firstSeed=1]

The stuck check simulates every (cell, keys held) situation a player can reach,
using the same movement rules as the game, independently of Maze.findTraps.
*/
const vm = require('vm');
const { load, countTraps } = require('./check_mazes_lib.js');
const siteDir = require('path').join(__dirname, '..');
const count = Number(process.argv[2] || 200);
const startSeed = Number(process.argv[3] || 1);
const ctx = load(siteDir);
const summary = {};
for (let type = 0; type < 4; ++type) {
	const r = summary[type] = { mazes: 0, withOneWay: 0, crash: 0, hang: 0, trapped: 0, unsolvable: 0, examples: [] };
	for (let seed = startSeed; seed < startSeed + count; ++seed) {
		r.mazes++;
		let p, m;
		try {
			[p, m] = vm.runInContext(`build(${type}, ${seed})`, ctx, { timeout: 5000 });
		} catch (e) {
			const hang = /timed out/.test(e.message);
			r[hang ? 'hang' : 'crash']++;
			if (r.examples.length < 4) r.examples.push(`seed ${seed}: ${hang ? 'HANG' : 'CRASH ' + e.message}`);
			continue;
		}
		if (p.oneWayWalls > 0) r.withOneWay++;
		const t = countTraps(m);
		if (!t.solvable) r.unsolvable++;
		else if (t.trapped > 0) {
			r.trapped++;
			if (r.examples.length < 4) r.examples.push(`seed ${seed}: TRAP ${t.trapped}/${t.states} states stuck (oneWay=${p.oneWayWalls})`);
		}
	}
}
console.log(JSON.stringify(summary, null, 1));
