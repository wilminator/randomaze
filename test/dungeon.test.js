const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const { emptyMaze, openBoth, generate, params, ctx } = require('./helpers.js');

const Dungeon = vm.runInContext('Dungeon', ctx);
const DungeonGame = vm.runInContext('DungeonGame', ctx);
const DUNGEON_CONTENT = vm.runInContext('DUNGEON_CONTENT', ctx);
const buildDungeon = vm.runInContext('buildDungeon', ctx);
const replayInContext = vm.runInContext('replayDungeon', ctx);
const dungeonMonsterXp = vm.runInContext('dungeonMonsterXp', ctx);

// Results come out of the engine's own realm; copy them so deepStrictEqual can compare them.
const plain = (x) => JSON.parse(JSON.stringify(x));
const replayDungeon = (...args) => plain(replayInContext(...args));

// A level 1 hero whose monsters come from level 1 (band width 0 means "all level 1").
function hero(over = {}) {
	return { cls: 'warrior', level: 1, xp: 0, safeShare: 1, xpTable: DUNGEON_CONTENT.xpTable, monsters: { first: 1, width: 0 }, ...over };
}

// A corridor of n cells in a row. The hero enters at the west end (facing east); the exit is at the east end.
function corridor(n) {
	const maze = emptyMaze(1, n);
	for (let i = 0; i < n - 1; ++i) openBoth(maze, maze.cell(0, i), 'E');
	maze.cell(0, 0).data.W = null;
	maze.cell(0, n - 1).data.E = null;
	maze.entranceList = [{ cell: maze.cell(0, 0), dir: 'W' }, { cell: maze.cell(0, n - 1), dir: 'E' }];
	return maze;
}

/*
Dice you control. Rolls come from `queue` first, then a default of 0.99 (a miss, no crit, no
waking up). An attack draws: to-hit, damage, then crit (the last two only on a hit). So
`dice.queue.push(0, 0, 0.99)` is "hit, lowest damage, no crit".
*/
function scriptedDice() {
	return {
		queue: [], rolls: 0,
		next() { ++this.rolls; return this.queue.length ? this.queue.shift() : 0.99; },
		int(n) { return Math.floor(this.next() * n); },
	};
}
const HIT = [0, 0, 0.99];          // a hit for the least damage, no crit
const MISS = [0.99];

/*
A game on a hand-made maze, with monsters and traps exactly where you say. `monsters` are
{species, col, level}; `traps` are {kind, col}. Dice are scripted.
*/
function setup({ maze = corridor(12), monsters = [], traps = [], heroOver = {}, content = DUNGEON_CONTENT } = {}) {
	const dungeon = new Dungeon(maze, 7, content);
	dungeon.monsters = monsters.map((m, id) => ({ id, species: m.species, cell: maze.cell(0, m.col), depth: 0, jitter: (m.level ?? 1) - 1 }));
	dungeon.traps = traps.map(t => ({ kind: t.kind, cell: maze.cell(0, t.col) }));
	const game = new DungeonGame(maze, dungeon, hero(heroOver), 'test', { events: true });
	game.dice = scriptedDice();
	return game;
}
const run = (game, letters) => {
	for (const letter of letters) {
		const r = game.act(letter);
		assert.ok(r.ok, `${letter}: ${r.reason}`);
	}
};
const blind = () => { const c = structuredClone(DUNGEON_CONTENT); for (const m of Object.values(c.monsters)) m.sight = 0; return c; };

// ---------------------------------------------------------------- building the dungeon

test('the daily dungeon builds the same every time, and has its own parameter row', () => {
	const a = buildDungeon(202601018), b = buildDungeon(202601018), c = buildDungeon(202601019);
	assert.strictEqual(a.seed, b.seed);
	assert.notStrictEqual(a.seed, c.seed);
	const describe = (d) => plain([d.maze.cellList.map(x => [x.data.N, x.data.S, x.data.E, x.data.W, x.data.U, x.data.D]),
		d.dungeon.monsters.map(m => [m.species, m.cell.loc, m.depth, m.jitter]), d.dungeon.traps.map(t => [t.kind, t.cell.loc])]);
	assert.deepStrictEqual(describe(a), describe(b));
	assert.notDeepStrictEqual(describe(a), describe(c));
	// Type 4 exists, and the classic types are untouched (mazeparams.test.js pins their seeds).
	assert.ok(params(4, 5).floors >= 1);
});

test('monsters follow the placement rules', () => {
	for (let day = 1; day <= 40; ++day) {
		const { maze, dungeon } = buildDungeon(202601000 + day);
		const cells = new Set();
		for (const m of dungeon.monsters) {
			assert.ok(!cells.has(m.cell), 'one monster per cell');
			cells.add(m.cell);
			assert.ok(!dungeon.entranceSet.has(m.cell), 'never on an entrance');
			if (m.species != 'guardian') assert.ok(dungeon.dist.get(m.cell) > 3, 'never within 3 steps of the start');
			if (m.species == 'spider') assert.strictEqual(dungeon.openSides(m.cell), 1, 'spiders wait in dead ends');
			assert.ok(m.depth >= 0 && m.depth <= 1 && [-1, 0, 1].includes(m.jitter));
		}
		const wanted = Math.round(maze.cellList.length / DUNGEON_CONTENT.cellsPerMonster);
		assert.ok(dungeon.monsters.length >= Math.min(wanted, 1) && dungeon.monsters.length <= wanted + 2, `${dungeon.monsters.length} monsters for ${maze.cellList.length} cells`);
		for (const t of dungeon.traps) assert.ok(dungeon.dist.get(t.cell) > 3 && !dungeon.entranceSet.has(t.cell));
	}
});

test('monster levels rise with depth inside the band, and XP follows the level', () => {
	const { dungeon } = buildDungeon(202601018);
	const shallow = { depth: 0, jitter: 0 }, deep = { depth: 1, jitter: 0 };
	assert.strictEqual(dungeon.monsterLevel(shallow, 4, 3), 4);
	assert.strictEqual(dungeon.monsterLevel(deep, 4, 3), 7);
	assert.strictEqual(dungeon.monsterLevel({ depth: 0, jitter: -1 }, 1, 3), 1, 'never below level 1');
	assert.ok(dungeon.totalXp(7, 3) > dungeon.totalXp(1, 3), 'a higher band is worth more');
	assert.ok(dungeonMonsterXp(DUNGEON_CONTENT, 'orc', 5) > dungeonMonsterXp(DUNGEON_CONTENT, 'orc', 1));
});

// ---------------------------------------------------------------- monsters on ticks

test('a monster that sees you in a straight line chases', () => {
	const game = setup({ monsters: [{ species: 'rat', col: 3 }] });
	const rat = game.monsters[0];
	assert.strictEqual(rat.state, 'idle');
	run(game, 'W');                      // the hero is 3 cells away: inside the rat's sight of 3
	assert.strictEqual(rat.state, 'chase');
	assert.ok(game.events.some(e => e.type == 'alert'));
});

test('a closed door blocks a monster\'s sight, and an open one does not', () => {
	const maze = corridor(12);
	openBoth(maze, maze.cell(0, 1), 'E', 1);                 // a plain door between cells 1 and 2
	const game = setup({ maze, monsters: [{ species: 'rat', col: 3 }] });
	const rat = game.monsters[0];
	run(game, 'FW');                                         // the hero is 2 cells from the rat, behind the door
	assert.strictEqual(rat.state, 'idle');
	run(game, 'F');                                          // opens the door
	assert.strictEqual(rat.state, 'chase');
});

test('slow monsters move every second tick and fast ones twice per tick', () => {
	const slow = setup({ monsters: [{ species: 'slime', col: 8 }] });
	slow.monsters[0].state = 'chase'; slow.monsters[0].target = slow.maze.cell(0, 0);
	const startSlime = slow.monsters[0].cell;
	run(slow, 'W');                                          // tick 1: nothing
	assert.strictEqual(slow.monsters[0].cell, startSlime);
	run(slow, 'W');                                          // tick 2: one step
	assert.strictEqual(slow.monsters[0].cell.loc[2], 7);

	const fast = setup({ monsters: [{ species: 'bat', col: 8 }] });
	fast.monsters[0].state = 'chase'; fast.monsters[0].target = fast.maze.cell(0, 0);
	fast.dice.queue.push(0.99, 0.99);                        // no flutter on either step
	run(fast, 'W');
	assert.strictEqual(fast.monsters[0].cell.loc[2], 6);
});

test('most monsters cannot open doors; goblins open plain ones; wraiths walk through', () => {
	const doorway = (species, door) => {
		const maze = corridor(12);
		openBoth(maze, maze.cell(0, 5), 'E', door);
		const game = setup({ maze, monsters: [{ species, col: 6 }] });
		const m = game.monsters[0];
		m.state = 'chase'; m.target = maze.cell(0, 0);
		run(game, 'W');
		return m.cell.loc[2];
	};
	assert.strictEqual(doorway('orc', 7), 6, 'a locked door stops an orc');
	assert.strictEqual(doorway('skeleton', 1), 6, 'a skeleton cannot open a plain door');
	assert.strictEqual(doorway('goblin', 1), 5, 'a goblin opens a plain door');
	assert.strictEqual(doorway('goblin', 7), 6, 'but not a locked one');
	assert.strictEqual(doorway('wraith', 7), 5, 'a wraith passes any closed door');
	// Nothing climbs a ladder: ladders are U/D sides, which canMove refuses.
});

// Put a monster in a column of a corridor after the game has started.
function place(game, monster, col) {
	game.occupied.delete(monster.cell);
	monster.cell = game.maze.cell(0, col);
	game.occupied.set(monster.cell, monster);
}

test('wanderers stay within their leash, and spiders stay home', () => {
	const game = setup({ content: blind(), monsters: [{ species: 'rat', col: 6 }, { species: 'spider', col: 9 }] });
	game.dice = new (vm.runInContext('Dice', ctx))('wander');   // the real dice this time
	const [rat, spider] = game.monsters;
	const visited = new Set();
	for (let i = 0; i < 300; ++i) {
		run(game, 'W');
		visited.add(rat.cell.loc[2]);
		assert.ok(Math.abs(rat.cell.loc[2] - 6) <= DUNGEON_CONTENT.monsters.rat.leash, 'the rat stays within 4 cells of home');
		assert.strictEqual(spider.cell.loc[2], 9, 'a spider that has not seen anyone never moves');
	}
	assert.ok(visited.size > 2, 'but the rat does wander');
});

test('a searching monster follows the hero\'s scent trail', () => {
	const game = setup({ content: blind(), monsters: [{ species: 'skeleton', col: 11 }] });
	const skeleton = game.monsters[0];
	run(game, 'FFFF');                                       // the hero is at column 4; columns 0-4 smell of the hero
	place(game, skeleton, 1);
	skeleton.state = 'search'; skeleton.searchLeft = 6;
	run(game, 'W');
	assert.strictEqual(skeleton.cell.loc[2], 2, 'one step along the trail, towards where the hero went');
	run(game, 'WW');
	assert.ok(game.fight, 'it caught up with the hero');
});

test('only the last 8 cells smell, and a monster off the trail gives up', () => {
	const game = setup({ content: blind(), monsters: [{ species: 'skeleton', col: 11 }] });
	const skeleton = game.monsters[0];
	run(game, 'F'.repeat(10));                               // columns 0 and 1 have dropped off the trail
	place(game, skeleton, 0);
	skeleton.state = 'search'; skeleton.searchLeft = 6;
	run(game, 'W');
	assert.strictEqual(skeleton.cell.loc[2], 0, 'no scent next to it, so it stays');
	assert.strictEqual(skeleton.state, 'wander');
});

// ---------------------------------------------------------------- fights

test('walking into a monster that has not noticed you gives the first strike, even to a slower hero', () => {
	const game = setup({ content: blind(), monsters: [{ species: 'rat', col: 2 }] });
	run(game, 'F');
	run(game, 'F');                                // walks into the rat's cell
	assert.ok(game.fight && game.fight.firstStrike);
	// The rat (SPD 6) is faster than the warrior (SPD 4) but the hero swings first this round.
	game.dice.queue.push(...HIT);                  // hero hits: 7 x 0.85 = 5.95 -> 6, rat has 6 HP
	run(game, 'A');
	assert.strictEqual(game.fight, null);
	assert.strictEqual(game.kills, 1);
	assert.strictEqual(game.hp, 30, 'the rat never got to swing');
});

test('without a first strike the faster side swings first', () => {
	const game = setup({ monsters: [{ species: 'rat', col: 3 }] });
	run(game, 'W');                                // the rat notices the hero
	run(game, 'W');                                // and closes in
	run(game, 'W');
	assert.ok(game.fight, 'the rat ran into the hero');
	assert.strictEqual(game.fight.firstStrike, false);
	// The rat is faster. It hits (3 ATK - 5/2 DEF = 0.5 -> at least 1), then the hero kills it.
	game.dice.queue.push(0, 0, 0.99, ...HIT);
	run(game, 'A');
	assert.strictEqual(game.hp, 29);
	assert.strictEqual(game.fight, null);
});

test('guard halves the damage and gives back 1 SP', () => {
	const game = setup({ content: blind(), monsters: [{ species: 'orc', col: 1 }], heroOver: { level: 1 } });
	run(game, 'F');                                // into the orc: first strike for the hero
	game.sp = 3;
	// Orc ATK 8, hero DEF 5 -> 8 x 1.0 - 2.5 = 5.5. A hit rolls 0.5 for damage: 8 x 1.0 = 8 - 2.5 = 5.5 -> 6; guarded: 3.
	game.dice.queue.push(0, 0.5, 0.99);
	run(game, 'G');
	assert.strictEqual(game.sp, 4);
	assert.strictEqual(game.hp, 30 - 3);
});

test('a hero who is knocked to 0 HP dies, and the run takes no more actions', () => {
	// A level 1 mage (16 HP) against a level 6 orc (ATK 14). Guarding halves each hit to 7.
	const game = setup({ content: blind(), monsters: [{ species: 'orc', col: 1, level: 6 }], heroOver: { cls: 'mage' } });
	run(game, 'F');
	while (!game.outcome) {
		game.dice.queue.push(0, 0.5, 0.99);        // the orc hits for 14 x 1.0 - 0.5, halved
		run(game, 'G');
	}
	assert.strictEqual(game.outcome, 'died');
	assert.strictEqual(game.hp, 0);
	assert.deepStrictEqual(plain(game.act('A')), { ok: false, reason: 'the run is over' });
});

test('fleeing steps back to where you came from and freezes the monster for 4 ticks', () => {
	const game = setup({ content: blind(), monsters: [{ species: 'skeleton', col: 2 }] });
	run(game, 'FF');
	assert.ok(game.fight);
	game.dice.queue.push(0.99, 0.0);               // the skeleton misses (SPD 3 < 4: the hero goes first), then hero flees: 0 < chance
	game.dice.queue.length = 0;
	game.dice.queue.push(0.0);                     // the flee roll succeeds
	run(game, 'X');
	assert.strictEqual(game.fight, null);
	assert.strictEqual(game.playerCell(), game.maze.cell(0, 1), 'stepped back one cell');
	const skeleton = game.monsters[0];
	assert.strictEqual(skeleton.frozen, 4);
	for (let i = 0; i < 4; ++i) { run(game, 'W'); assert.strictEqual(skeleton.cell, game.maze.cell(0, 2)); }
	// The fifth tick it moves again, and the way into its cell restarts the fight with no first strike.
	run(game, 'W');
	assert.ok(game.fight && !game.fight.firstStrike);
});

test('a failed flee costs the round, and a boss can never be fled from', () => {
	const game = setup({ content: blind(), monsters: [{ species: 'guardian', col: 2 }] });
	run(game, 'FF');
	game.dice.queue.push(0.99);                    // the guardian (faster) misses; a flee roll of 0 would win if one were made
	const rolls = game.dice.rolls;
	run(game, 'X');
	assert.ok(game.fight, 'still fighting');
	assert.strictEqual(game.dice.rolls - rolls, 1, 'only the guardian\'s to-hit was rolled: no flee roll for a boss');
	// With no cell to step back to (the very first move was the fight), flee also fails.
	const cornered = setup({ content: blind(), monsters: [{ species: 'rat', col: 1 }] });
	run(cornered, 'F');
	assert.ok(cornered.fight);
	cornered.prev = null;
	cornered.dice.queue.push(0.0);
	run(cornered, 'X');
	assert.ok(cornered.fight);
});

test('a goblin that is nearly dead runs away once, and forced moves set off traps', () => {
	const game = setup({ content: blind(), monsters: [{ species: 'goblin', col: 3 }], traps: [{ kind: 'spikes', col: 4 }] });
	run(game, 'FFF');
	assert.ok(game.fight);
	const goblin = game.monsters[0];
	goblin.hp = 2;                                  // below a quarter of 14
	game.dice.queue.push(0.99);                     // the hero misses; the goblin (SPD 5 > 4) acts first and misses too
	run(game, 'A');
	assert.strictEqual(goblin.state, 'flee');
	assert.strictEqual(game.fight, null);
	// It runs east, straight onto the hidden spikes at column 4: 15% of 14 HP = 3, which kills it.
	run(game, 'W');
	assert.strictEqual(goblin.alive, false);
	assert.strictEqual(game.kills, 1, 'full XP for a kill by a trap');
	assert.ok(game.xp > 0);
});

test('XP: part is safe, a level-up mid-run is permanent, the bonus is paid only on escape', () => {
	const game = setup({ content: blind(), monsters: [{ species: 'rat', col: 1 }, { species: 'rat', col: 2 }], heroOver: { safeShare: 0.5 } });
	run(game, 'F');
	game.dice.queue.push(...HIT);
	run(game, 'A');
	run(game, 'F');
	game.dice.queue.push(...HIT);
	run(game, 'A');
	assert.strictEqual(game.xp, 12);                // two rats at 6 each
	assert.strictEqual(game.safeXp, 6);             // half of each kill, rounded: 3 + 3
	assert.strictEqual(game.level, 1, '6 safe XP is short of the 10 for level 2');
	const dead = game.summary();
	assert.strictEqual(dead.grantedXp, 6, 'a hero who died would keep only the safe share');

	const full = setup({ content: blind(), monsters: [{ species: 'rat', col: 1 }, { species: 'rat', col: 2 }], heroOver: { safeShare: 1 } });
	run(full, 'F'); full.dice.queue.push(...HIT); run(full, 'A');
	run(full, 'F'); full.dice.queue.push(...HIT); run(full, 'A');
	assert.strictEqual(full.level, 2, '12 safe XP crosses the line to level 2');
	assert.strictEqual(full.stats.maxHp, 35, '30 x 1.15 = 34.5 rounds to 35');
	assert.strictEqual(full.hp, 35, 'the extra HP comes with the level');
});

// ---------------------------------------------------------------- traps

test('traps: spikes cost 15% each time, darts and alarms go off once, all become visible', () => {
	const game = setup({ content: blind(), traps: [{ kind: 'spikes', col: 1 }, { kind: 'dart', col: 2 }, { kind: 'alarm', col: 3 }], monsters: [{ species: 'orc', col: 8 }] });
	run(game, 'F');
	assert.strictEqual(game.hp, 30 - 5);            // ceil(30 x 0.15) = 5
	run(game, 'F');
	assert.strictEqual(game.hp, 25 - 3);            // ceil(30 x 0.10) = 3
	run(game, 'F');
	assert.strictEqual(game.monsters[0].state, 'chase', 'the alarm woke the orc');
	assert.strictEqual(game.monsters[0].target, game.maze.cell(0, 3));
	run(game, 'BB');                                // back onto the dart cell (spent), then the spikes again
	assert.strictEqual(game.hp, 22 - 5);
	assert.strictEqual(game.seenTraps.size, 3);
});

test('a trap can kill the hero', () => {
	const game = setup({ content: blind(), traps: [{ kind: 'spikes', col: 1 }] });
	game.hp = 4;                                    // the spikes do 5
	run(game, 'F');
	assert.strictEqual(game.outcome, 'died');
});

// ---------------------------------------------------------------- the whole run, and replay

test('walking out of the exit ends the run as escaped', () => {
	const game = setup({ content: blind() });
	run(game, 'F'.repeat(12));
	assert.strictEqual(game.outcome, 'escaped');
	assert.strictEqual(game.summary().floor, 1);
});

test('replayDungeon accepts a real run and reports why it refuses a bad one', () => {
	const maze = corridor(12);
	const dungeon = new Dungeon(maze, 7, blind());
	dungeon.monsters = []; dungeon.traps = [];
	const ok = replayDungeon(maze, dungeon, hero(), 'n', 'F'.repeat(12));
	assert.strictEqual(ok.valid, true);
	assert.strictEqual(ok.outcome, 'escaped');
	assert.strictEqual(ok.ticks, 11);               // the winning step is not a tick
	const bad = (actions) => replayDungeon(maze, dungeon, hero(), 'n', actions).reason;
	assert.strictEqual(bad(''), 'no actions');
	assert.strictEqual(bad('FFA'), 'action 2 (A): no fight in progress');
	assert.strictEqual(bad('FFF'), 'the run never ended');
	assert.strictEqual(bad('F'.repeat(12) + 'F'), 'actions continue after the run ended at 12');
	assert.strictEqual(bad('B'), 'action 0 (B): does nothing');
	assert.strictEqual(bad('F1'), 'action 1 (1): skills and items are not available yet');
	assert.strictEqual(bad('Z'), 'action 0 (Z): no fight in progress');
	assert.strictEqual(bad('C'), 'action 0 (C): does nothing');
});

test('in a fight only fight actions work', () => {
	const game = setup({ content: blind(), monsters: [{ species: 'orc', col: 1 }] });
	run(game, 'F');
	assert.strictEqual(game.act('F').reason, 'you are in a fight');
	assert.strictEqual(game.act('W').reason, 'you are in a fight');
	assert.strictEqual(game.act('2').reason, 'skills and items are not available yet');
});

// A stand-in for a player: walk the shortest route to the exit, fight what gets in the way.
const turnLeft = { N: 'W', W: 'S', S: 'E', E: 'N' };
function nextStep(game) {
	const { maze, player } = game, exit = maze.entranceList[maze.entranceList.length - 1];
	const bit = (k) => 1n << BigInt(k);
	let keys = 0n;
	for (const k of player.keys) keys |= bit(k);
	const pick = (cell, held) => (cell.data.item.key && !player.takenKeys.has(`${cell.loc}`)) ? held | bit(cell.data.item.key) : held;
	const start = { cell: player.cell(), keys: pick(player.cell(), keys), first: null };
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
			queue.push({ cell: next, keys: held, first });
		}
	}
	return null;
}
function botAction(game) {
	if (game.fight) return game.hp < game.stats.maxHp * 0.3 ? 'X' : 'A';
	const dir = nextStep(game), p = game.player;
	if (dir == 'U' || dir == 'D') return dir;
	if (dir === p.dir) return 'F';
	return turnLeft[p.dir] === dir ? 'L' : 'R';
}
function playBot(maze, dungeon, h, nonce, limit = 4000) {
	const game = new DungeonGame(maze, dungeon, h, nonce);
	while (!game.outcome && game.actions.length < limit) {
		const r = game.act(botAction(game));
		assert.ok(r.ok, `the bot made a bad move: ${r.reason}`);
	}
	return game;
}

test('a live run and its replay agree exactly, on real daily dungeons', () => {
	const outcomes = { escaped: 0, died: 0 };
	for (let day = 1; day <= 12; ++day) {
		const built = buildDungeon(202601000 + day);
		for (const [cls, level] of [['warrior', 20], ['mage', 1]]) {
			const h = hero({ cls, level, monsters: { first: cls == 'mage' ? 7 : 1, width: 3 } });
			const game = playBot(built.maze, built.dungeon, h, `run${day}`);
			assert.ok(game.outcome, `day ${day} ${cls}: the bot ended the run`);
			++outcomes[game.outcome];
			const live = plain(game.summary());
			// Replay on a dungeon rebuilt from scratch: nothing is shared with the live run.
			const again = buildDungeon(202601000 + day);
			const replay = replayDungeon(again.maze, again.dungeon, h, `run${day}`, game.actions);
			assert.strictEqual(replay.valid, true, replay.reason);
			const { valid, ...rest } = replay;
			assert.deepStrictEqual(rest, live);
			// A different nonce means different dice: the same actions need not even be legal.
		}
	}
	assert.ok(outcomes.escaped > 0 && outcomes.died > 0, `both endings happen: ${JSON.stringify(outcomes)}`);
});

test('the dice depend on the nonce: another nonce gives another run', () => {
	const built = buildDungeon(202601005);
	const h = hero({ cls: 'warrior', level: 20, monsters: { first: 1, width: 3 } });
	const a = playBot(built.maze, built.dungeon, h, 'one').summary();
	const b = playBot(built.maze, built.dungeon, h, 'two').summary();
	assert.notDeepStrictEqual(plain(a.stats), plain(b.stats));
});

test('a long run is cheap to replay', () => {
	const built = buildDungeon(202601007);
	const h = hero({ cls: 'warrior', level: 20, monsters: { first: 1, width: 3 } });
	const game = playBot(built.maze, built.dungeon, h, 'speed');
	const t = process.hrtime.bigint();
	for (let i = 0; i < 20; ++i) replayDungeon(built.maze, built.dungeon, h, 'speed', game.actions);
	const ms = Number(process.hrtime.bigint() - t) / 1e6 / 20;
	assert.ok(ms < 100, `${ms.toFixed(1)} ms per replay of ${game.actions.length} actions`);
});
