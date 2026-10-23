const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const { Maze, emptyMaze, openBoth, generate, params, ctx } = require('./helpers.js');

const Dungeon = vm.runInContext('Dungeon', ctx);
const DungeonGame = vm.runInContext('DungeonGame', ctx);
const DUNGEON_CONTENT = vm.runInContext('DUNGEON_CONTENT', ctx);
const buildDungeon = vm.runInContext('buildDungeon', ctx);
const replayInContext = vm.runInContext('replayDungeon', ctx);
const dungeonMonsterXp = vm.runInContext('dungeonMonsterXp', ctx);
const dungeonHeroStats = vm.runInContext('dungeonHeroStats', ctx);

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
{species, col, level}; `traps` are {kind, col}; `potions` are {col, heal} or {col, sp}. Dice are scripted.
*/
function setup({ maze = corridor(12), monsters = [], traps = [], potions = [], heroOver = {}, content = DUNGEON_CONTENT } = {}) {
	const dungeon = new Dungeon(maze, 7, content);
	dungeon.monsters = monsters.map((m, id) => ({ id, species: m.species, cell: maze.cell(0, m.col), depth: 0, jitter: (m.level ?? 1) - 1 }));
	dungeon.traps = traps.map(t => ({ kind: t.kind, cell: maze.cell(0, t.col) }));
	dungeon.charms = [];
	dungeon.potions = potions.map(x => ({ cell: maze.cell(0, x.col), ...(x.sp ? { sp: x.sp } : { heal: x.heal ?? DUNGEON_CONTENT.potions.heal }) }));
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
// The rules tests pin the numbers they were written against, so retuning DUNGEON_CONTENT (monster
// strength, the hero's head start) does not break them. They still use the shipped behaviour flags.
const RULES_STATS = {
	rat: [6, 3], slime: [12, 3], bat: [5, 2], goblin: [14, 5], skeleton: [18, 6], spider: [12, 5], orc: [28, 8], wraith: [20, 7], guardian: [50, 10],
};
const pinned = () => {
	const c = structuredClone(DUNGEON_CONTENT);
	c.headStart = { hp: 0, sp: 0 };
	// The tests were written against the old class HP, ATK and trap damage; the live numbers have moved.
	for (const [cls, hp] of Object.entries({ warrior: 30, rogue: 20, mage: 16, cleric: 24, ranger: 22, monk: 22 })) c.classes[cls].hp = hp;
	for (const [cls, atk] of Object.entries({ warrior: 7, rogue: 6, ranger: 6, monk: 5 })) c.classes[cls].atk = atk;
	c.trapDamage = { spikes: 0.15, dart: 0.10 };
	for (const [name, m] of Object.entries(c.monsters)) [m.hp, m.atk] = RULES_STATS[name];
	return c;
};
const blind = () => { const c = pinned(); for (const m of Object.values(c.monsters)) m.sight = 0; return c; };

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

test('buildDungeon makes the same maze as the combat row of the maze builder', () => {
	// The dungeon's maze is the ordinary COMBAT maze for that seed: the dungeon layer adds monsters, not walls.
	const layout = (m) => plain(m.cellList.map(x => [x.data.N, x.data.S, x.data.E, x.data.W, x.data.U, x.data.D, !!x.data.hole, !!x.data.pit, x.data.item.key]));
	const [, same] = vm.runInContext('build(4, "202601018:dungeon")', ctx);
	assert.deepStrictEqual(layout(buildDungeon(202601018).maze), layout(same));
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
		const hpPotions = dungeon.potions.filter(x => x.heal), spPotions = dungeon.potions.filter(x => x.sp);
		assert.strictEqual(hpPotions.length, Math.round(maze.cellList.length / DUNGEON_CONTENT.potions.cellsPerPotion));
		assert.strictEqual(spPotions.length, Math.round(maze.cellList.length / DUNGEON_CONTENT.potions.cellsPerSpPotion));
		assert.strictEqual(new Set(dungeon.potions.map(x => x.cell)).size, dungeon.potions.length, 'one potion per cell');
		for (const x of dungeon.potions) assert.ok(dungeon.dist.get(x.cell) > 3 && !dungeon.entranceSet.has(x.cell) && (x.heal ?? x.sp) > 0 && (x.heal ?? x.sp) <= 1);
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
	const game = setup({ content: pinned(), monsters: [{ species: 'rat', col: 3 }] });
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

test('guard halves the damage and gives back 2 SP', () => {
	const game = setup({ content: blind(), monsters: [{ species: 'orc', col: 1 }], heroOver: { level: 1 } });
	run(game, 'F');                                // into the orc: first strike for the hero
	game.sp = 6;
	// Orc ATK 8, hero DEF 5 -> 8 x 1.0 - 2.5 = 5.5. A hit rolls 0.5 for damage: 8 x 1.0 = 8 - 2.5 = 5.5 -> 6; guarded: 3.
	game.dice.queue.push(0, 0.5, 0.99);
	run(game, 'G');
	assert.strictEqual(game.sp, 8);
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

// ---------------------------------------------------------------- holes

// Two floors, three cells wide. The hero starts on the top floor (west), the exit is on the
// top floor (east), and the middle top cell is a hole (or a hidden pit) down to the bottom floor.
function holeMaze(pit) {
	const maze = new Maze('holes', 2, 3, 1, 0, 2, 0);
	const upper = (c) => maze.grid[1][0][c], lower = (c) => maze.grid[0][0][c];
	openBoth(maze, upper(0), 'E'); openBoth(maze, upper(1), 'E');
	openBoth(maze, lower(0), 'E');
	upper(0).data.W = null; upper(2).data.E = null;
	upper(1).data.D = null; upper(1).data.hole = true; lower(1).data.U = 0;
	if (pit) upper(1).data.pit = true;
	maze.entranceList = [{ cell: upper(0), dir: 'W' }, { cell: upper(2), dir: 'E' }];
	maze.cell = (r, c) => upper(c);
	maze.lower = lower;
	return maze;
}

test('dropping through a hole costs a tick and 10% of max HP', () => {
	const game = setup({ maze: holeMaze(false), content: blind() });
	run(game, 'F');
	assert.strictEqual(game.hp, 30, 'a hole you can see is safe to stand on');
	const ticks = game.ticks;
	run(game, 'D');
	assert.strictEqual(game.player.z, 0, 'one floor down');
	assert.strictEqual(game.hp, 27, 'a fall is 10% of 30 HP');
	assert.strictEqual(game.ticks, ticks + 1);
	assert.strictEqual(game.act('U').ok, false, 'there is no way back up');
});

test('an unseen pit drops you when you step on it, and can land you in a fight or kill you', () => {
	const fight = setup({ maze: holeMaze(true), content: blind() });
	fight.monsters.length = 0;
	const lowerCell = fight.maze.lower(1);
	fight.dungeon.monsters = [{ id: 0, species: 'rat', cell: lowerCell, depth: 0, jitter: 0 }];
	const game = new DungeonGame(fight.maze, fight.dungeon, hero(), 'pit', { events: true });
	game.dice = scriptedDice();
	run(game, 'F');
	assert.strictEqual(game.player.z, 0, 'the pit swallowed the hero');
	assert.ok(game.events.some(e => e.type == 'fall' && e.via == 'step'));
	assert.ok(game.fight, 'and the hero landed on the rat');
	assert.strictEqual(game.fight.firstStrike, true);

	const deadly = setup({ maze: holeMaze(true), content: blind() });
	deadly.hp = 3;
	run(deadly, 'F');
	assert.strictEqual(deadly.outcome, 'died');
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
	assert.strictEqual(bad('F2'), 'action 1 (2): that skill is not available yet');
	assert.strictEqual(bad('Z'), 'action 0 (Z): Z is not an action');
	assert.strictEqual(bad('T'), 'action 0 (T): T is not an action');
	assert.strictEqual(bad('C'), 'action 0 (C): does nothing');
});

test('in a fight only fight actions work', () => {
	const game = setup({ content: blind(), monsters: [{ species: 'orc', col: 1 }] });
	run(game, 'F');
	assert.strictEqual(game.act('F').reason, 'you are in a fight');
	assert.strictEqual(game.act('W').reason, 'you are in a fight');
	assert.strictEqual(game.act('2').reason, 'that skill is not available yet');
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


// ---------------------------------------------------------------- potions

test('potions are picked up by walking onto them, and I drinks the oldest', () => {
	const game = setup({ content: pinned(), potions: [{ col: 2 }] });
	run(game, 'FF');
	assert.strictEqual(game.bag.length, 1);
	assert.strictEqual(game.counts.potionsFound, 1);
	assert.ok(game.events.some(e => e.type == 'potion-found'));
	assert.strictEqual(game.act('I').reason, 'no potion would help');
	game.hp = 10;
	const ticks = game.ticks;
	run(game, 'I');
	assert.strictEqual(game.hp, 25, 'a found potion heals half of max HP (15 of 30)');
	assert.strictEqual(game.ticks, ticks + 1, 'drinking outside a fight costs a tick');
	assert.strictEqual(game.bag.length, 0);
	assert.strictEqual(game.act('I').reason, 'no potion to drink');
	game.hp = 10;
	assert.strictEqual(game.act('I').reason, 'no potion to drink');
});

test('shop potions come with the hero and are weaker; the bag holds eight', () => {
	const game = setup({ content: pinned(), heroOver: { potions: [0.25] } });
	game.hp = 10;
	run(game, 'I');
	assert.strictEqual(game.hp, 18, 'a shop potion heals 25% of 30, rounded up to 8');
	const full = setup({ content: pinned(), potions: [{ col: 1 }], heroOver: { potions: Array(8).fill(0.25) } });
	run(full, 'F');
	assert.strictEqual(full.bag.length, 8, 'no room: the potion stays on the floor');
	assert.strictEqual(full.potionAt.size, 1);
	assert.throws(() => setup({ heroOver: { potions: Array(9).fill(0.25) } }), /shares/);
	assert.throws(() => setup({ heroOver: { potions: [2] } }), /shares/);
});

test('drinking in a fight takes the round: the monster still swings', () => {
	const game = setup({ content: pinned(), monsters: [{ species: 'orc', col: 1 }], heroOver: { potions: [0.5] } });
	run(game, 'F');                                // first strike
	game.hp = 5;
	game.dice.queue.push(0, 0.5, 0.99);            // after the potion the orc hits: 8 x 1.0 - 2.5 = 5.5 -> 6
	run(game, 'I');
	assert.strictEqual(game.hp, 5 + 15 - 6);
	assert.ok(game.fight, 'still fighting');
});

// ---------------------------------------------------------------- level 1 skills

const orcFight = (cls) => {
	const game = setup({ content: pinned(), monsters: [{ species: 'orc', col: 1 }], heroOver: { cls } });
	run(game, 'F');                                // walks into the orc: first strike for the hero
	return game;
};

test('Warrior: Power Strike hits for 1.8x and costs 4 SP', () => {
	const game = orcFight('warrior');
	game.dice.queue.push(...HIT);                  // 7 x 0.85 - 4/2 = 3.95; x 1.8 = 7.1 -> 7
	run(game, '1');
	assert.strictEqual(game.monsters[0].hp, 28 - 7);
	assert.strictEqual(game.sp, 8);
	game.sp = 1;
	assert.strictEqual(game.act('1').reason, 'not enough SP for Power Strike');
});

test('Rogue: Backstab is 3x, and only on a first strike', () => {
	const game = orcFight('rogue');
	game.dice.queue.push(...HIT);                  // 6 x 0.85 - 2 = 3.1; x 3 = 9.3 -> 9
	run(game, '1');
	assert.strictEqual(game.monsters[0].hp, 28 - 9);
	assert.strictEqual(game.act('1').reason, 'Backstab needs a first strike', 'the second round is no first strike');
});

test('Mage: Firebolt ignores DEF and needs no to-hit roll', () => {
	const game = orcFight('mage');
	game.dice.queue.push(0.5);                     // spell 9 x 1.0 = 9, whatever the orc\'s DEF
	run(game, '1');
	assert.strictEqual(game.monsters[0].hp, 28 - 9);
	assert.strictEqual(game.sp, 28);
});

test('Mage: Firebolt out of a fight burns a monster in the next cell, and only that close', () => {
	const near = setup({ content: blind(), monsters: [{ species: 'orc', col: 1 }], heroOver: { cls: 'mage' } });
	near.dice.queue.push(0.5);                     // 9 damage, no to-hit roll
	const ticks = near.ticks;
	run(near, '1');
	assert.strictEqual(near.monsters[0].hp, 28 - 9);
	assert.strictEqual(near.sp, 28);
	assert.strictEqual(near.ticks, ticks + 1);
	assert.strictEqual(near.monsters[0].state, 'chase', 'the orc comes for the hero');
	const weak = setup({ content: blind(), monsters: [{ species: 'rat', col: 1 }], heroOver: { cls: 'mage' } });
	weak.dice.queue.push(0.5);
	run(weak, '1');
	assert.strictEqual(weak.kills, 1, 'a rat burns to death without a fight');
	const far = setup({ content: blind(), monsters: [{ species: 'rat', col: 2 }], heroOver: { cls: 'mage' } });
	assert.strictEqual(far.act('1').reason, 'nothing in the next cell to burn');
});

test('Cleric: Heal restores 40% of max HP, in a fight or out of one', () => {
	const game = setup({ content: pinned(), monsters: [{ species: 'orc', col: 3 }], heroOver: { cls: 'cleric' } });
	assert.strictEqual(game.act('1').reason, 'already at full health');
	game.hp = 5;
	const ticks = game.ticks;
	run(game, '1');
	assert.strictEqual(game.hp, 5 + 10, '40% of 24 rounds up to 10');
	assert.strictEqual(game.ticks, ticks + 1);
	assert.strictEqual(game.sp, 16);
	const fight = orcFight('cleric');
	fight.hp = 5;
	run(fight, '1');                               // heals to 15; the orc then misses (default dice)
	assert.strictEqual(fight.hp, 15);
	assert.ok(fight.fight);
});

test('Ranger: Aimed Shot hits a monster in line before it reaches you', () => {
	const game = setup({ content: blind(), monsters: [{ species: 'rat', col: 4 }], heroOver: { cls: 'ranger' } });
	game.dice.queue.push(...HIT);                  // 6 x 0.85 = 5.1; x 1.5 = 7.65 -> 8, the rat has 6
	const ticks = game.ticks;
	run(game, '1');
	assert.strictEqual(game.kills, 1);
	assert.strictEqual(game.sp, 16);
	assert.strictEqual(game.ticks, ticks + 1);
	assert.strictEqual(game.act('1').reason, 'nothing in line to shoot');
	const far = setup({ content: blind(), monsters: [{ species: 'rat', col: 9 }], heroOver: { cls: 'ranger' } });
	assert.strictEqual(far.act('1').reason, 'nothing in line to shoot', 'out of range (6 cells)');
});

test('Ranger: a monster that survives the shot comes for the hero', () => {
	const game = setup({ content: blind(), monsters: [{ species: 'orc', col: 4 }], heroOver: { cls: 'ranger' } });
	game.dice.queue.push(...HIT);
	run(game, '1');
	assert.strictEqual(game.monsters[0].state, 'chase');
	assert.ok(game.monsters[0].hp < 28);
});

test('Monk: Flurry is three hits at half damage', () => {
	const game = orcFight('monk');
	game.dice.queue.push(...HIT, ...HIT, ...HIT);  // 5 x 0.85 - 2 = 2.25; x 0.5 = 1.1 -> 1 each
	run(game, '1');
	assert.strictEqual(game.monsters[0].hp, 28 - 3);
	assert.strictEqual(game.counts.hits, 3);
	assert.strictEqual(game.sp, 14);
});

test('skills used out of turn are refused and change nothing', () => {
	const game = setup({ content: pinned() });
	const reason = game.act('1').reason;
	assert.strictEqual(reason, 'Power Strike is used in a fight');
	assert.strictEqual(game.sp, 12);
	assert.strictEqual(game.actions, '');
});

test('potions and skills replay: the same letters give the same run', () => {
	for (const cls of ['warrior', 'rogue', 'mage', 'cleric', 'ranger', 'monk']) {
		const { maze, dungeon } = buildDungeon(202601018);
		const live = new DungeonGame(maze, dungeon, hero({ cls, potions: [0.25] }), 'n', {});
		for (let i = 0; i < 600 && !live.outcome; ++i) {
			const wanted = live.fight ? (live.hp < live.stats.maxHp * 0.5 ? 'I' : i % 2 ? '1' : 'A') : (i % 15 == 0 ? '1' : botAction(live));
			if (!live.act(wanted).ok) live.act(live.fight ? 'A' : botAction(live));
		}
		assert.ok(live.counts.skills > 0 || live.outcome, `${cls} used a skill or finished`);
		if (live.outcome) {
			const again = replayDungeon(maze, dungeon, hero({ cls, potions: [0.25] }), 'n', live.actions);
			assert.strictEqual(again.valid, true, cls + ': ' + again.reason);
			assert.strictEqual(again.xp, live.xp);
			assert.strictEqual(again.hp, live.hp);
			assert.strictEqual(again.ticks, live.ticks);
		}
	}
});


test('SP potions restore a share of max SP, and I picks the potion that helps', () => {
	const game = setup({ content: pinned(), potions: [{ col: 1, sp: 0.5 }, { col: 2 }], heroOver: { cls: 'mage' } });
	run(game, 'FF');
	assert.strictEqual(game.bag.length, 2);
	assert.strictEqual(game.act('I').reason, 'no potion would help', 'full HP and full SP');
	game.sp = 4;
	const ticks = game.ticks;
	run(game, 'I');
	assert.strictEqual(game.sp, 4 + 16, 'half of 32 SP');
	assert.strictEqual(game.ticks, ticks + 1);
	assert.strictEqual(game.bag.length, 1, 'the HP potion stays in the bag');
	game.hp = 5;
	game.sp = 10;
	run(game, 'I');
	assert.ok(game.hp > 5 && game.sp == 10, 'now the HP potion is the one that helps');
	assert.strictEqual(game.bag.length, 0);
});

test('with both kinds in the bag, I skips an SP potion when only HP is low', () => {
	const game = setup({ content: pinned(), heroOver: { cls: 'mage', potions: [{ sp: 0.25 }, 0.25] } });
	game.hp = 10;
	run(game, 'I');
	assert.strictEqual(game.hp, 14, 'the HP potion (25% of 16) was drunk, not the older SP one');
	assert.strictEqual(game.bag.length, 1);
	assert.strictEqual(game.bag[0].sp, 0.25, 'the older SP potion is still in the bag');
	assert.throws(() => setup({ heroOver: { potions: [{ sp: 2 }] } }), /shares/);
	assert.throws(() => setup({ heroOver: { potions: [{ heal: 0.5 }] } }), /shares/);
});

test('SP potions share the eight-slot bag with HP potions', () => {
	const game = setup({ content: pinned(), potions: [{ col: 1, sp: 0.5 }], heroOver: { potions: Array(8).fill(0.25) } });
	run(game, 'F');
	assert.strictEqual(game.bag.length, 8);
	assert.strictEqual(game.potionAt.size, 1, 'no room, so it stays on the floor');
});

test('a Mage can drink SP potions mid-fight to keep casting Firebolt', () => {
	const game = setup({ content: pinned(), monsters: [{ species: 'orc', col: 1 }], heroOver: { cls: 'mage', potions: [{ sp: 0.5 }] } });
	run(game, 'F');
	game.sp = 0;
	assert.strictEqual(game.act('1').reason, 'not enough SP for Firebolt');
	run(game, 'I');
	assert.strictEqual(game.sp, 16);
	game.dice.queue.push(0.5);
	run(game, '1');
	assert.strictEqual(game.monsters[0].hp, 28 - 9);
});


// ---------------------------------------------------------------- charms

test('Feather Charm: a fall does no damage and the charm is used up', () => {
	for (const letters of ['FD', 'F']) {          // a chosen drop at a seen hole, and an unseen pit
		const game = setup({ maze: holeMaze(letters == 'F'), content: blind(), heroOver: { potions: ['feather'] } });
		run(game, letters);
		assert.strictEqual(game.player.z, 0, 'the hero still fell');
		assert.strictEqual(game.hp, 30, 'unhurt');
		assert.strictEqual(game.bag.length, 0, 'the charm is gone');
		assert.ok(game.events.some(e => e.type == 'charm' && e.charm == 'feather') || letters == 'FD');
	}
	const bare = setup({ maze: holeMaze(false), content: blind() });
	run(bare, 'FD');
	assert.strictEqual(bare.hp, 27, 'without the charm a fall still costs 10%');
});

test('Anchor Charm: an unseen pit does not drop you, is revealed, and the charm is used up', () => {
	const game = setup({ maze: holeMaze(true), content: blind(), heroOver: { potions: ['hold'] } });
	run(game, 'F');
	assert.strictEqual(game.player.z, 1, 'still on the top floor');
	assert.strictEqual(game.hp, 30);
	assert.strictEqual(game.bag.length, 0);
	assert.ok(game.events.some(e => e.type == 'charm' && e.charm == 'hold'));
	run(game, 'F');                                // walks on across the revealed hole
	assert.strictEqual(game.player.z, 1);
	assert.strictEqual(game.player.revealedPits.has(`${game.maze.cell(0, 1).loc}`), true);
});

test('Anchor Charm does not stop a drop the hero chose, and Feather then takes the damage', () => {
	const game = setup({ maze: holeMaze(false), content: blind(), heroOver: { potions: ['hold', 'feather'] } });
	run(game, 'FD');
	assert.strictEqual(game.player.z, 0, 'D is a choice, not an accident');
	assert.strictEqual(game.hp, 30, 'the Feather Charm covered the fall');
	assert.deepStrictEqual(game.bag.map(x => x.charm), ['hold'], 'the Anchor Charm is kept');
});

test('both charms on a pit: the Anchor Charm saves the fall and the Feather Charm waits', () => {
	const game = setup({ maze: holeMaze(true), content: blind(), heroOver: { potions: ['feather', 'hold'] } });
	run(game, 'F');
	assert.strictEqual(game.player.z, 1);
	assert.deepStrictEqual(game.bag.map(x => x.charm), ['feather']);
});

test('charms lie on the floor, take a bag slot, and are not drunk by I', () => {
	const maze = corridor(12);
	const game = setup({ maze, content: pinned() });
	game.charmAt.set(maze.cell(0, 1), { cell: maze.cell(0, 1), charm: 'hold' });
	run(game, 'F');
	assert.strictEqual(game.bag.length, 1);
	assert.ok(game.events.some(e => e.type == 'charm-found'));
	game.hp = 10;
	assert.strictEqual(game.act('I').reason, 'no potion to drink', 'a charm is not a potion');
	assert.strictEqual(game.summary().charmsLeft, 1);
	const full = setup({ maze, content: pinned(), heroOver: { potions: Array(8).fill('feather') } });
	full.charmAt.set(maze.cell(0, 1), { cell: maze.cell(0, 1), charm: 'hold' });
	run(full, 'F');
	assert.strictEqual(full.bag.length, 8, 'no room');
	assert.throws(() => setup({ heroOver: { potions: ['wings'] } }), /charm name/);
});

test('a maze has 0 to 2 floor charms, away from holes, the start and each other', () => {
	const counts = new Set();
	for (let day = 1; day <= 60; ++day) {
		const { dungeon } = buildDungeon(202601000 + day);
		const cells = new Set(dungeon.potions.map(x => x.cell));
		assert.ok(dungeon.charms.length <= DUNGEON_CONTENT.floorCharms);
		counts.add(dungeon.charms.length);
		for (const c of dungeon.charms) {
			assert.ok(c.charm in DUNGEON_CONTENT.charms);
			assert.ok(!c.cell.data.hole && !cells.has(c.cell) && !dungeon.entranceSet.has(c.cell) && dungeon.dist.get(c.cell) > 3);
			cells.add(c.cell);
		}
	}
	assert.deepStrictEqual([...counts].sort(), [0, 1, 2], 'all three counts turn up over 60 days');
});

// ---------------------------------------------------------------- Mage Bolt elements (design 16)
// Letters 5 6 7 8 choose Fire, Frost, Earth, Storm. Out of a fight a choice switches the element for a tick and no SP;
// in a fight it casts a bolt in that element, 50% more SP when it is not the current element.

const mageOrcFight = () => {
	const game = setup({ content: pinned(), monsters: [{ species: 'orc', col: 1 }], heroOver: { cls: 'mage' } });
	run(game, 'F');                                // walks into the orc: first strike for the hero
	game.monsters[0].element = 'neutral';          // so element damage never changes the numbers in the SP tests
	return game;
};

test('Bolt element: out of a fight a choice switches the element, costs a tick and no SP', () => {
	const game = setup({ content: blind(), heroOver: { cls: 'mage' } });
	assert.strictEqual(game.element, 'fire', 'a run starts on Fire');
	const ticks = game.ticks, sp = game.sp;
	const result = game.act('6');
	assert.ok(result.ok);
	assert.deepStrictEqual(plain(result.events), [{ type: 'element', element: 'frost' }]);
	assert.strictEqual(game.element, 'frost');
	assert.strictEqual(game.ticks, ticks + 1);
	assert.strictEqual(game.sp, sp);
	assert.strictEqual(game.actions, '6', 'the choice is its own recorded action');
});

test('Bolt element: choosing the element you already have is refused and changes nothing', () => {
	const game = setup({ content: blind(), heroOver: { cls: 'mage' } });
	const ticks = game.ticks;
	assert.strictEqual(game.act('5').reason, 'the Bolt is already fire');
	assert.strictEqual(game.ticks, ticks);
	assert.strictEqual(game.actions, '');
});

test('Bolt element: in a fight a different element casts for 50% more SP (4 -> 6), the same again at normal cost', () => {
	const game = mageOrcFight();
	game.dice.queue.push(0.5);                     // spell 9 x 1.0 = 9 damage, no to-hit roll
	const result = game.act('6');                  // Frost while the current element is Fire
	assert.ok(result.ok);
	assert.strictEqual(game.sp, 32 - 6);
	assert.strictEqual(game.monsters[0].hp, 28 - 9);
	assert.strictEqual(game.element, 'frost', 'the cast makes Frost the current element');
	const skill = plain(result.events).find(e => e.type == 'skill');
	assert.deepStrictEqual(skill, { type: 'skill', skill: 'firebolt', element: 'frost', cost: 6 });
	run(game, '6');                                // Frost again
	assert.strictEqual(game.sp, 32 - 6 - 4, 'the same element is normal cost');
	assert.strictEqual(game.counts.skills, 2);
});

test('Bolt element: key 1 casts in the current element at normal cost', () => {
	const game = mageOrcFight();
	run(game, '7');                                // Earth, 6 SP
	run(game, '1');
	assert.strictEqual(game.sp, 32 - 6 - 4);
	assert.strictEqual(game.element, 'earth');
});

test('Bolt element: not enough SP is refused using the real cost, and the same element still works', () => {
	const game = mageOrcFight();
	game.sp = 5;                                   // enough for a Firebolt (4), not for a switch (6)
	assert.strictEqual(game.act('6').reason, 'not enough SP for Frostbolt (6)');
	assert.strictEqual(game.sp, 5);
	assert.strictEqual(game.element, 'fire');
	assert.strictEqual(game.actions, 'F');
	assert.ok(game.act('5').ok, 'Fire is the current element, so 4 SP is enough');
	assert.strictEqual(game.sp, 1);
});

test('Bolt element: it carries over between fights, and a bolt out of a fight uses it', () => {
	const game = setup({ content: blind(), monsters: [{ species: 'rat', col: 1 }, { species: 'rat', col: 4 }], heroOver: { cls: 'mage' } });
	run(game, 'F');                                // first strike on the first rat
	game.dice.queue.push(0.5);
	run(game, '8');                                // Storm kills it (9 damage against 6 HP)
	assert.strictEqual(game.fight, null, 'the fight is over');
	assert.strictEqual(game.kills, 1);
	assert.strictEqual(game.element, 'storm', 'the element survives the end of the fight');
	run(game, 'FF');                               // now one cell from the second rat
	game.dice.queue.push(0.5);
	const result = game.act('1');                  // burns the next cell's rat with the current element
	assert.ok(result.ok, result.reason);
	assert.strictEqual(plain(result.events).find(e => e.type == 'hero-attack').element, 'storm');
});

test('Bolt element: only the Mage has the letters', () => {
	for (const cls of ['warrior', 'rogue', 'cleric', 'ranger', 'monk']) {
		const out = setup({ content: blind(), heroOver: { cls } });
		assert.strictEqual(out.act('6').reason, 'only the Mage knows the Bolt elements', cls);
		const fight = setup({ content: pinned(), monsters: [{ species: 'orc', col: 1 }], heroOver: { cls } });
		run(fight, 'F');
		assert.strictEqual(fight.act('6').reason, 'only the Mage knows the Bolt elements', cls);
		assert.strictEqual(fight.sp, fight.stats.maxSp);
	}
});

test('Bolt element: the damage multiplier is one seam, so the element loop can plug in', () => {
	const game = mageOrcFight();
	assert.strictEqual(game.elementMultiplier('fire', game.monsters[0]), 1, 'plain damage until the element loop lands');
	game.elementMultiplier = () => 1.25;
	game.dice.queue.push(0.5);                     // 9 x 1.25 = 11.25 -> 11
	run(game, '5');
	assert.strictEqual(game.monsters[0].hp, 28 - 11);
});

test('Bolt element: a run with element choices replays to the same result', () => {
	const { maze, dungeon } = buildDungeon(202601018);
	const mage = () => hero({ cls: 'mage', potions: [0.25] });
	const live = new DungeonGame(maze, dungeon, mage(), 'n', {});
	for (let i = 0; i < 800 && !live.outcome; ++i) {
		const pick = '5678'[i % 4];
		const wanted = live.fight ? (live.hp < live.stats.maxHp * 0.5 ? 'I' : i % 3 == 0 ? pick : 'A') : (i % 11 == 0 ? pick : botAction(live));
		if (!live.act(wanted).ok) live.act(live.fight ? 'A' : botAction(live));
	}
	assert.ok(/[5-8]/.test(live.actions), 'the run used element letters');
	assert.ok(live.outcome, 'the run ended');
	const again = replayDungeon(maze, dungeon, mage(), 'n', live.actions);
	assert.strictEqual(again.valid, true, again.reason);
	assert.strictEqual(again.xp, live.xp);
	assert.strictEqual(again.sp, live.sp);
	assert.strictEqual(again.element, live.element);
});

test('Bolt element: a record that gives a Warrior an element letter is invalid', () => {
	const { maze, dungeon } = buildDungeon(202601018);
	const result = replayDungeon(maze, dungeon, hero({ cls: 'warrior' }), 'n', '5');
	assert.strictEqual(result.valid, false);
	assert.match(result.reason, /only the Mage knows the Bolt elements/);
});

// Needs dungeonElementMultiplier from the monster elements change; skipped until that is in this branch.
const hasElementLoop = vm.runInContext("typeof dungeonElementMultiplier == 'function'", ctx);
test('Bolt element: bolts use the element loop against the monster element', { skip: !hasElementLoop && 'monster elements are not in this branch yet' }, () => {
	const cast = (monsterElement, letter) => {
		const game = mageOrcFight();
		game.monsters[0].element = monsterElement;   // overrides the neutral default
		game.dice.queue.push(0.5);                 // base spell damage 9
		run(game, letter);
		return 28 - game.monsters[0].hp;
	};
	assert.strictEqual(cast('frost', '5'), 11, 'Fire beats Frost: 9 x 1.25');
	assert.strictEqual(cast('fire', '6'), 7, 'Frost against Fire: 9 x 0.75');
	assert.strictEqual(cast('neutral', '7'), 9, 'Neutral changes nothing');
});

test('starting HP: Mage 70-80, Warrior 115, and no more than 45 between the lowest and the highest class', () => {
	const hp = Object.fromEntries(Object.keys(DUNGEON_CONTENT.classes).map(c => [c, dungeonHeroStats(DUNGEON_CONTENT, c, 1).maxHp]));
	assert.deepStrictEqual(hp, { warrior: 115, rogue: 85, mage: 75, cleric: 93, ranger: 93, monk: 98 });
	assert.ok(Math.max(...Object.values(hp)) - Math.min(...Object.values(hp)) <= 45);
});
