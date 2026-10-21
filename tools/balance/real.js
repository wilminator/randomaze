// Balance bot, part 6: the same questions, asked of the REAL dungeon (generator/dungeon.js).
//   node real.js [days=6] [nonces=3] [bandWidth=4] [out=real-results.json]
//
// Plays the engine's own stand-in player (shortest route to the exit; attack; flee below 30% HP)
// on real daily dungeons, for every class, a spread of hero levels and the three difficulties,
// and reports deaths, XP per run, fights and ticks. The real dungeon has no skills or potions yet,
// so this measures the core loop: stats, the combat maths, monster placement and their chasing.
//
// Content overrides (also "classes":{"mage":{"hp":40}} to change a class's base stats) (to try tuned monsters without editing dungeon.js):
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
const COLLECT = process.env.COLLECT === '1';
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
if (override.potions) Object.assign(content.potions, override.potions);   // e.g. {"cellsPerSpPotion":100000} for none
if (override.headStart) content.headStart = {hp: 0, sp: 0, ...override.headStart};   // e.g. {"hp":10,"sp":3}   // e.g. {"def":0.15,"sp":0.15}
for (const [cls, o] of Object.entries(override.classes ?? {})) Object.assign(content.classes[cls], o);   // e.g. {"mage":{"sp":99}}
for (const [cls, p] of Object.entries(override.classPower ?? {})) { content.classes[cls].atk *= p; if (content.classes[cls].spell) content.classes[cls].spell *= p; }
// Keep the placement code's view of the content in the engine's realm.
const contentInCtx = vm.runInContext('(' + JSON.stringify(content) + ')', ctx);

// ---- the stand-in player, copied from test/dungeon.test.js ----
const turnLeft = {N: 'W', W: 'S', S: 'E', E: 'N'};
function nextStep(game, goals) {
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
		if (s.cell === exit.cell && s.first === null && !goals) return exit.dir;
		for (const dir of ['N', 'S', 'E', 'W', 'U', 'D']) {
			const v = s.cell.data[dir], next = maze.getNextCell(s.cell, dir);
			if (!next || !(v === null || (v > 0 && (s.keys & bit(v))))) continue;
			const held = pick(next, s.keys), id = `${next.loc}:${held}`;
			if (seen.has(id)) continue;
			seen.add(id);
			const first = s.first ?? dir;
			if (goals ? goals.has(next) : next === exit.cell) { nextStep.found = next; return first; }
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
	if (USE_POTIONS && USE_SKILLS && !canCast && game.bag.some(x => x.sp) && (game.fight || game.sp < game.stats.maxSp * 0.5)) return 'I';
	if (game.fight) {
		if (USE_POTIONS && hpShare < 0.4 && game.bag.some(x => !x.sp && !x.charm)) return 'I';
		if (canCast && k.kind == 'heal' && hpShare < 0.5) return '1';
		if (hpShare < 0.3) return 'X';
		if (canCast && k.kind == 'backstab') return game.fight.round == 0 && game.fight.firstStrike ? '1' : 'A';
		if (canCast && k.kind != 'heal') return '1';
		return 'A';
	}
	if (USE_POTIONS && hpShare < 0.5 && game.bag.some(x => !x.sp && !x.charm)) return 'I';
	if (canCast && k.kind == 'heal' && hpShare < 0.6) return '1';
	if (canCast && k.kind == 'aimed-shot' && game.shotTarget(k.range)) return '1';
	if (canCast && k.kind == 'firebolt' && (process.env.FIRE1 === '1' || COLLECT) && game.shotTarget(1)) return '1';
	let dir = null;
	if (COLLECT) {
		// COLLECT=1: clear the whole band and pick everything up before heading for the exit. The bot
		// sticks to one target until it is reached (or gone), so two near-equal targets cannot make it pace.
		const mons = game.monsters.filter(m => m.alive);
		const valid = t => t && (t.monster ? t.monster.alive : (game.potionAt.has(t.cell) || game.charmAt.has(t.cell)) && game.bag.length < game.content.potions.carry);
		// Hurt with no potion to drink: stop hunting and leave (the run is still worth its XP).
		const weak = hpShare < 0.5 && !game.bag.some(x => !x.sp && !x.charm);
		if (weak) game.botTarget = null;
		else if (!valid(game.botTarget) || (game.botTarget.monster ? game.botTarget.monster.cell : game.botTarget.cell) === game.player.cell()) {
			game.botTarget = null;
			const goals = new Set(mons.map(m => m.cell));
			if (game.bag.length < game.content.potions.carry) for (const c of [...game.potionAt.keys(), ...game.charmAt.keys()]) goals.add(c);
			goals.delete(game.player.cell());
			nextStep.found = null;
			if (goals.size && nextStep(game, goals) && nextStep.found) {
				const mon = mons.find(m => m.cell === nextStep.found);
				game.botTarget = mon ? {monster: mon} : {cell: nextStep.found};
			}
		}
		if (process.env.DEBUG2) console.log(game.actions.length, 'at', `${game.player.cell().loc}`, 'target', game.botTarget ? (game.botTarget.monster ? 'm@' + game.botTarget.monster.cell.loc : 'i@' + game.botTarget.cell.loc) : null, 'mons', mons.length);
		if (game.botTarget) dir = nextStep(game, new Set([game.botTarget.monster ? game.botTarget.monster.cell : game.botTarget.cell]));
	}
	dir = dir ?? nextStep(game);
	const p = game.player;
	if (dir == 'U' || dir == 'D') return dir;
	if (dir === p.dir) return 'F';
	return turnLeft[p.dir] === dir ? 'L' : 'R';
}

const bandOf = (level, w) => Math.floor((level - 1) / w);
const NEVER = Array.from({length: 21}, (_, i) => i === 0 ? 0 : 1e12);   // no mid-run level-ups
const CLASSES = process.env.CLASSES_ONLY ? process.env.CLASSES_ONLY.split(',') : Object.keys(content.classes);

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
			let n = 0, died = 0, xp = 0, kills = 0, fights = 0, ticks = 0, monsters = 0, potentialXp = 0, found = 0, drunk = 0, skills = 0, progress = 0, escaped = 0, cleared = 0, lvl2 = 0, grant = 0, killShare = 0, success = 0;
			for (let d = 0; d < days; ++d) {
				const b = built[d];
				const first = 1 + (bandOf(L, width) + diff) * width;
				for (let k = 0; k < nonces; ++k) {
					const hero = {cls, level: L, xp: 0, safeShare: 1, xpTable: NEVER, monsters: {first, width}, ...JSON.parse(process.env.HERO ?? '{}')};
					const game = new DungeonGame(b.maze, b.dungeon, hero, `bal${d}_${k}`);
					let guard = 0, wasFight = false;
					while (!game.outcome && game.actions.length < (COLLECT ? 30000 : 6000) && ++guard < (COLLECT ? 60000 : 12000)) {
						const r = game.act(botAction(game));
						if (process.env.DEBUG && game.actions.length >= 600 && game.actions.length < 606 && d == 2) console.log('pos', `${game.player.cell().loc}`, game.player.dir, game.actions.slice(-1));
						if (0) console.log('at', `${game.player.cell().loc}`, game.player.dir, 'goals', [...game.monsters.filter(m=>m.alive).map(m=>`m${m.species}@${m.cell.loc} ${m.state}`), ...[...game.potionAt.keys()].map(c=>`p@${c.loc}`), ...[...game.charmAt.keys()].map(c=>`c@${c.loc}`)].join(' | '), 'bag', game.bag.length);
						if (!r.ok) { if (process.env.DEBUG) console.log('refused', r.reason, 'fight', !!game.fight, 'hp', game.hp, 'sp', game.sp); break; }
						if (HEAL && wasFight && !game.fight && !game.outcome) game.hp = Math.min(game.stats.maxHp, game.hp + game.stats.maxHp * HEAL);
						wasFight = !!game.fight;
					}
					const s = game.summary();
					if (process.env.DEBUG) console.log(d, k, s.outcome, 'actions', game.actions.length, 'kills', s.kills, '/', s.monsters, 'xp', s.xp, 'tail', game.actions.slice(-30));
					found += game.counts.potionsFound; drunk += game.counts.potionsDrunk; skills += game.counts.skills; progress += s.progress;
					++n; if (s.outcome === 'died') ++died;
					if (s.outcome === 'escaped') ++escaped; if (s.kills === s.monsters) ++cleared; if (s.grantedXp >= 10) ++lvl2; grant += s.grantedXp; killShare += s.kills / s.monsters; if (s.outcome === 'escaped' && s.kills === s.monsters && s.grantedXp >= 10) ++success;
					xp += s.xp; kills += s.kills; fights += s.stats?.fights ?? 0; ticks += s.ticks;
					monsters += game.monsters.length;
					potentialXp += game.monsters.reduce((a, m) => a + m.xp, 0);
				}
			}
			result.cells[cls][L].push({diff, n, death: died / n, xp: xp / n, kills: kills / n, fights: fights / n, ticks: ticks / n, monsters: monsters / n, potentialXp: potentialXp / n, potionsFound: found / n, potionsDrunk: drunk / n, skills: skills / n, progress: progress / n, escaped: escaped / n, cleared: cleared / n, levelUp: lvl2 / n, grantedXp: grant / n, killShare: killShare / n, success: success / n});
		}
	}
	if (!QUIET) console.log(`${cls} done (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
fs.writeFileSync(path.resolve(__dirname, outFile), JSON.stringify(result, null, 1));
if (!QUIET) console.log('wrote ' + outFile);
