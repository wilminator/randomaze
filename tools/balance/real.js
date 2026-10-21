// Balance bot, part 6: the same questions, asked of the REAL dungeon (generator/dungeon.js).
//   node real.js [days=6] [nonces=3] [bandWidth=4] [out=real-results.json]
//
// Plays the engine's own stand-in player (shortest route to the exit; attack; flee below 30% HP)
// on real daily dungeons, for every class, a spread of hero levels and the three difficulties,
// and reports deaths, XP per run, fights and ticks. The real dungeon has no skills or potions yet,
// so this measures the core loop: stats, the combat maths, monster placement and their chasing.
//
// Content overrides (to try tuned monsters without editing dungeon.js):
//   CONTENT='{"monsterGrowth":0.15,"monsterPower":0.3}' node real.js
// heroGrowth merges into the table's heroGrowth, e.g. CONTENT='{"heroGrowth":{"def":0.15}}'.
// monsterPower scales every monster's HP and ATK (both, each by this factor). classPower scales a
// class's ATK, e.g. CONTENT='{"classPower":{"warrior":0.6}}'.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { load } = require('../check_mazes_lib.js');

const days = Number(process.argv[2] ?? 6);
const nonces = Number(process.argv[3] ?? 3);
const width = Number(process.argv[4] ?? 4);
const outFile = process.argv[5] ?? 'real-results.json';
const override = JSON.parse(process.env.CONTENT ?? '{}');
const LEVELS = (process.env.LEVELS ?? '1,2,5,8,11,14,17,20').split(',').map(Number);
const DIFFS = (process.env.DIFFS ?? '0,1,2').split(',').map(Number);
const QUIET = !!process.env.QUIET;
// HEAL=<share>: after each fight the hero recovers that share of max HP (1 = full). Stands in for the
// potions, Heal skill and rests that do not exist yet, to show how much sustain the design numbers need.
const HEAL = Number(process.env.HEAL ?? 0);

const ctx = load(path.join(__dirname, '..', '..'));
const DungeonGame = vm.runInContext('DungeonGame', ctx);
const buildDungeon = vm.runInContext('buildDungeon', ctx);
const BASE = vm.runInContext('DUNGEON_CONTENT', ctx);

// A content table with the overrides applied (a copy, so the engine's own table is untouched).
const content = JSON.parse(JSON.stringify(BASE));
if (override.trapDamage) Object.assign(content.trapDamage, override.trapDamage);   // e.g. {"spikes":0,"dart":0}
for (const k of ['monsterGrowth', 'monsterXpGrowth', 'cellsPerMonster']) if (override[k] !== undefined) content[k] = override[k];
if (override.monsterPower !== undefined) for (const m of Object.values(content.monsters)) { m.hp *= override.monsterPower; m.atk *= override.monsterPower; }
Object.assign(content.heroGrowth, override.heroGrowth ?? {});
if (override.headStart) content.headStart = {hp: 0, sp: 0, ...override.headStart};   // e.g. {"hp":10,"sp":3}   // e.g. {"def":0.15,"sp":0.15}
for (const [cls, p] of Object.entries(override.classPower ?? {})) { content.classes[cls].atk *= p; if (content.classes[cls].spell) content.classes[cls].spell *= p; }
// Keep the placement code's view of the content in the engine's realm.
const contentInCtx = vm.runInContext('(' + JSON.stringify(content) + ')', ctx);

// ---- the stand-in player, copied from test/dungeon.test.js ----
const turnLeft = {N: 'W', W: 'S', S: 'E', E: 'N'};
function nextStep(game) {
	const {maze, player} = game, exit = maze.entranceList[maze.entranceList.length - 1];
	const bit = k => 1n << BigInt(k);
	let keys = 0n;
	for (const k of player.keys) keys |= bit(k);
	const pick = (cell, held) => (cell.data.item.key && !player.takenKeys.has(`${cell.loc}`)) ? held | bit(cell.data.item.key) : held;
	const start = {cell: player.cell(), keys: pick(player.cell(), keys), first: null};
	const seen = new Set([`${start.cell.loc}:${start.keys}`]);
	const queue = [start];
	for (let i = 0; i < queue.length; ++i) {
		const s = queue[i];
		if (s.cell === exit.cell && s.first === null) return exit.dir;
		for (const dir of ['N', 'S', 'E', 'W', 'U', 'D']) {
			const v = s.cell.data[dir], next = maze.getNextCell(s.cell, dir);
			if (!next || !(v === null || (v > 0 && (s.keys & bit(v))))) continue;
			const held = pick(next, s.keys), id = `${next.loc}:${held}`;
			if (seen.has(id)) continue;
			seen.add(id);
			const first = s.first ?? dir;
			if (next === exit.cell) return first;
			queue.push({cell: next, keys: held, first});
		}
	}
	return null;
}
// SKILLS=0 and POTIONS=0 switch the stand-in's use of skills (key 1) and potions (I) off.
const USE_SKILLS = process.env.SKILLS !== '0', USE_POTIONS = process.env.POTIONS !== '0';
function botAction(game) {
	const maxHp = game.stats.maxHp, k = game.content.skills[game.hero.cls], hpShare = game.hp / maxHp;
	const canCast = USE_SKILLS && game.sp >= k.sp;
	if (game.fight) {
		if (USE_POTIONS && hpShare < 0.4 && game.bag.length) return 'I';
		if (canCast && k.kind == 'heal' && hpShare < 0.5) return '1';
		if (hpShare < 0.3) return 'X';
		if (canCast && k.kind == 'backstab') return game.fight.round == 0 && game.fight.firstStrike ? '1' : 'A';
		if (canCast && k.kind != 'heal') return '1';
		return 'A';
	}
	if (USE_POTIONS && hpShare < 0.5 && game.bag.length) return 'I';
	if (canCast && k.kind == 'heal' && hpShare < 0.6) return '1';
	if (canCast && k.kind == 'aimed-shot' && game.shotTarget(k.range)) return '1';
	const dir = nextStep(game), p = game.player;
	if (dir == 'U' || dir == 'D') return dir;
	if (dir === p.dir) return 'F';
	return turnLeft[p.dir] === dir ? 'L' : 'R';
}

const bandOf = (level, w) => Math.floor((level - 1) / w);
const NEVER = Array.from({length: 21}, (_, i) => i === 0 ? 0 : 1e12);   // no mid-run level-ups
const CLASSES = Object.keys(content.classes);

const built = [];
for (let d = 1; d <= days; ++d) {
	const b = buildDungeon(202610000 + d, contentInCtx);
	built.push(b);
}
const cells = built.map(b => b.maze.grid.flat(2).length);
if (!QUIET) console.log(`dungeons: ${days} days, ${built.reduce((a, b) => a + b.dungeon.monsters.length, 0) / days} monsters on average, ${cells.reduce((a, x) => a + x, 0) / days} cells on average`);

const result = {width, days, nonces, content: override, cells: {}};
const t0 = Date.now();
for (const cls of CLASSES) {
	result.cells[cls] = {};
	for (const L of LEVELS) {
		result.cells[cls][L] = [];
		for (const diff of DIFFS) {
			let n = 0, died = 0, xp = 0, kills = 0, fights = 0, ticks = 0, monsters = 0, potentialXp = 0, found = 0, drunk = 0, skills = 0, progress = 0;
			for (let d = 0; d < days; ++d) {
				const b = built[d];
				const first = 1 + (bandOf(L, width) + diff) * width;
				for (let k = 0; k < nonces; ++k) {
					const hero = {cls, level: L, xp: 0, safeShare: 1, xpTable: NEVER, monsters: {first, width}};
					const game = new DungeonGame(b.maze, b.dungeon, hero, `bal${d}_${k}`);
					let guard = 0, wasFight = false;
					while (!game.outcome && game.actions.length < 6000 && ++guard < 12000) {
						const r = game.act(botAction(game));
						if (!r.ok) break;
						if (HEAL && wasFight && !game.fight && !game.outcome) game.hp = Math.min(game.stats.maxHp, game.hp + game.stats.maxHp * HEAL);
						wasFight = !!game.fight;
					}
					const s = game.summary();
					found += game.counts.potionsFound; drunk += game.counts.potionsDrunk; skills += game.counts.skills; progress += s.progress;
					++n; if (s.outcome === 'died') ++died;
					xp += s.xp; kills += s.kills; fights += s.stats?.fights ?? 0; ticks += s.ticks;
					monsters += game.monsters.length;
					potentialXp += game.monsters.reduce((a, m) => a + m.xp, 0);
				}
			}
			result.cells[cls][L].push({diff, n, death: died / n, xp: xp / n, kills: kills / n, fights: fights / n, ticks: ticks / n, monsters: monsters / n, potentialXp: potentialXp / n, potionsFound: found / n, potionsDrunk: drunk / n, skills: skills / n, progress: progress / n});
		}
	}
	if (!QUIET) console.log(`${cls} done (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
fs.writeFileSync(path.resolve(__dirname, outFile), JSON.stringify(result, null, 1));
if (!QUIET) console.log('wrote ' + outFile);
