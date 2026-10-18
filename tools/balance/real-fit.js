// Balance bot, part 7: what monster strength does the REAL dungeon need for a target death rate?
//   node real-fit.js [days=4] [nonces=2] [bandWidth=4]
// Bisects monsterPower (a multiplier on every monster's HP and ATK, each) at the design's growth until
// the stand-in player's mean death rate on Easy hits each target. The real dungeon has no skills or
// potions yet, so these are strengths for the core loop only; skills and potions will let monsters be
// stronger again.
'use strict';
const {execFileSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const [days = 4, nonces = 2, width = 4] = process.argv.slice(2);
const tmp = path.join(os.tmpdir(), `real-fit-${process.pid}.json`);
const LEVELS = process.env.LEVELS ?? '2,5,8,11,14,17,20';
const EXTRA = JSON.parse(process.env.EXTRA ?? '{}');   // content overrides held fixed, e.g. {"heroGrowth":{"def":0.15}}
const TAG = process.env.TAG ?? '';

function meanDeath(power, extra = {}) {
	execFileSync('node', [path.join(__dirname, 'real.js'), days, nonces, width, tmp], {
		env: {...process.env, QUIET: '1', LEVELS, DIFFS: '0', CONTENT: JSON.stringify({...EXTRA, monsterPower: power, ...extra})}, stdio: 'ignore'});
	const r = JSON.parse(fs.readFileSync(tmp));
	let d = 0, n = 0;
	for (const cls of Object.keys(r.cells)) for (const L of Object.keys(r.cells[cls])) { d += r.cells[cls][L][0].death; ++n; }
	return d / n;
}
const out = {};
for (const target of [0.05, 0.15, 0.30]) {
	let lo = 0.02, hi = 1.5;
	for (let i = 0; i < 9; ++i) {
		const mid = Math.sqrt(lo * hi);
		if (meanDeath(mid) < target) lo = mid; else hi = mid;
	}
	out[target] = Math.sqrt(lo * hi);
	console.log(`Easy deaths ${Math.round(target * 100)}%: monster HP and ATK each x${out[target].toFixed(2)}`);
}
fs.writeFileSync(path.join(__dirname, `real-fit${TAG}.json`), JSON.stringify({days, nonces, width, extra: EXTRA, easyDeathTargets: out}, null, 1));
