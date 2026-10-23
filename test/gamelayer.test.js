const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { emptyMaze, openBoth, generate, ctx } = require('./helpers.js');

const Dice = vm.runInContext('Dice', ctx);
const Contents = vm.runInContext('Contents', ctx);
const RuleGame = vm.runInContext('RuleGame', ctx);
const replayInContext = vm.runInContext('replayRun', ctx);
// Copy the result into this realm, so deepStrictEqual can compare it with a plain object.
const replayRun = (...args) => ({ ...replayInContext(...args) });

// The example ruleset is not part of the engine proper, so load it here.
const examplePath = path.join(__dirname, '..', 'examples', 'monsterhunt.js');
vm.runInContext(fs.readFileSync(examplePath, 'utf8'), ctx, { filename: examplePath });
const MONSTER_HUNT = vm.runInContext('MONSTER_HUNT', ctx);

// A corridor of `n` cells: the entrance is on the west of cell 0, the exit on the east of the last.
function corridor(n) {
	const maze = emptyMaze(1, n);
	for (let c = 0; c < n - 1; ++c) openBoth(maze, maze.cell(0, c), 'E');
	maze.cell(0, 0).data.W = null;
	maze.cell(0, n - 1).data.E = null;
	maze.entranceList = [{ cell: maze.cell(0, 0), dir: 'W' }, { cell: maze.cell(0, n - 1), dir: 'E' }];
	return maze;
}

// --- The dice and the contents ---

test('the dice repeat for the same seed and count their rolls', () => {
	const a = new Dice('seed'), b = new Dice('seed'), c = new Dice('other');
	const rolls = (d) => [d.int(100), d.int(100), d.next()];
	assert.deepStrictEqual(rolls(a), rolls(b));
	assert.notDeepStrictEqual(rolls(new Dice('seed')), rolls(c));
	assert.strictEqual(a.rolls, 3);
	for (let i = 0; i < 200; ++i) { const n = a.int(6); assert.ok(n >= 0 && n < 6); }
});

test('contents hand out ids in order and find things by cell and kind', () => {
	const maze = corridor(3);
	const [a, b] = [maze.cell(0, 0), maze.cell(0, 1)];
	const contents = new Contents([{ kind: 'gem', cell: a, value: 5 }, { kind: 'gem', cell: b }]);
	assert.deepStrictEqual([...contents.all().map(t => t.id)], [1, 2]);
	assert.strictEqual(contents.at(a)[0].value, 5);
	const bat = contents.spawn('bat', a, { hp: 2 });
	assert.strictEqual(bat.id, 3);
	assert.strictEqual(contents.at(a).length, 2);
	assert.strictEqual(contents.ofKind('gem').length, 2);
	contents.remove(bat);
	contents.remove(1);
	assert.deepStrictEqual([...contents.all().map(t => t.id)], [2]);
	assert.strictEqual(contents.get(1), null);
	assert.strictEqual(contents.spawn('x', a).id, 4, 'ids are never reused');
});

// --- The frame ---

test('a custom letter may not be one of the movement letters', () => {
	for (const letter of ['F', 'W', 'C', 'T', 'AB']) {
		assert.throws(() => new RuleGame(corridor(3), { actions: { [letter]: () => ({ ok: true }) } }), /cannot be a custom action letter/);
	}
});

test('with an empty ruleset a game is the classic game', () => {
	const game = new RuleGame(corridor(3), {});
	assert.strictEqual(game.act('F').type, 'move');
	assert.strictEqual(game.act('F').type, 'move');
	assert.strictEqual(game.act('F').type, 'win');
	assert.strictEqual(game.outcome, 'won');
	assert.strictEqual(game.actions, 'FFF');
	assert.strictEqual(game.ticks, 2, 'the win is not a tick');
	assert.deepStrictEqual({ ...game.act('F') }, { ok: false, reason: 'the game is over' });
});

test('refused actions change nothing and are not recorded', () => {
	const game = new RuleGame(corridor(3), { allows: (g, letter) => letter == 'L' ? 'no turning' : null });
	assert.deepStrictEqual({ ...game.act('B') }, { ok: false, reason: 'that does nothing right now' });
	assert.deepStrictEqual({ ...game.act('L') }, { ok: false, reason: 'no turning' });
	assert.deepStrictEqual({ ...game.act('Z') }, { ok: false, reason: 'Z is not an action' });
	assert.deepStrictEqual({ ...game.act('') }, { ok: false, reason: ' is not an action' });
	assert.strictEqual(game.actions, '');
	assert.strictEqual(game.ticks, 0);
});

test('a move arrives first, then its tick; turns and waits tick by the policy', () => {
	const log = [];
	const game = new RuleGame(corridor(4), {
		extraActions: true,
		tickPolicy: { move: true, wait: true },
		onArrive: (g, action, result) => log.push(`arrive ${action}:${result.type} t${g.ticks}`),
		onTick: (g, tick, action) => log.push(`tick ${tick} ${action}`),
	});
	'FLRW'.split('').forEach(letter => game.act(letter));
	assert.deepStrictEqual([...log], [
		'arrive F:move t0', 'tick 1 F',
		'arrive L:turn t1',
		'arrive R:turn t1',
		'arrive W:wait t1', 'tick 2 W',
	]);
});

test('a custom action runs the ruleset and is recorded', () => {
	const game = new RuleGame(corridor(3), {
		actions: { H: (g) => (g.shouted = (g.shouted ?? 0) + 1, { ok: true, said: 'hello' }) },
	});
	assert.deepStrictEqual({ ...game.act('H') }, { ok: true, said: 'hello' });
	assert.strictEqual(game.shouted, 1);
	assert.strictEqual(game.actions, 'H');
});

test('a custom action can refuse, and nothing is recorded', () => {
	const game = new RuleGame(corridor(3), { actions: { H: () => ({ ok: false, reason: 'not now' }), J: () => null } });
	assert.deepStrictEqual({ ...game.act('H') }, { ok: false, reason: 'not now' });
	assert.deepStrictEqual({ ...game.act('J') }, { ok: false, reason: 'refused' });
	assert.strictEqual(game.actions, '');
});

test('game.end finishes a game from the rules', () => {
	const game = new RuleGame(corridor(5), { onArrive: (g, a, r) => { if (g.player.x == 2) g.end('lost'); } });
	game.act('F'); game.act('F');
	assert.strictEqual(game.outcome, 'lost');
	game.end('won');
	assert.strictEqual(game.outcome, 'lost', 'the first ending stands');
	assert.strictEqual(game.act('F').ok, false);
});

test('the summary has the frame fields and the ruleset fields', () => {
	const game = new RuleGame(corridor(3), { summary: (g) => ({ extra: 7 }) });
	['F', 'F', 'F'].forEach(l => game.act(l));
	const summary = game.summary();
	assert.strictEqual(summary.outcome, 'won');
	assert.strictEqual(summary.moves, 3);
	assert.strictEqual(summary.extra, 7);
	assert.strictEqual(summary.rolls, 0);
});

// --- The movement hook ---

test('moveTo puts the player somewhere else and runs onArrive for the new cell', () => {
	const maze = corridor(5);
	const seen = [];
	const game = new RuleGame(maze, {
		onArrive(g, action, result) {
			seen.push(`${action}:${result.type}@${g.player.x}`);
			if (action == 'F' && g.player.x == 1) g.moveTo(maze.cell(0, 3));
		},
		onTick: (g, tick) => seen.push(`tick ${tick}@${g.player.x}`),
	}, {}, 1, 1, { events: true });
	game.act('F');
	assert.deepStrictEqual(seen, ['F:move@1', 'teleport:teleport@3', 'tick 1@3']);
	assert.strictEqual(game.player.x, 3);
	assert.strictEqual(game.player.moves, 1, 'only the F is a recorded action');
	assert.deepStrictEqual([...game.events.map(e => e.type)], ['teleport']);
	assert.strictEqual(game.events[0].from, maze.cell(0, 1));
});

test('moveTo can turn the player and picks up a key where it lands', () => {
	const maze = corridor(4);
	maze.cell(0, 2).data.item.key = 4;
	const game = new RuleGame(maze, { onArrive: (g, a) => { if (a == 'F') g.moveTo(maze.cell(0, 2), 'W'); } });
	game.act('F');
	assert.strictEqual(game.player.dir, 'W');
	assert.ok(game.player.keys.includes(4));
});

test('teleporters that send you in a circle are an error, not a freeze', () => {
	const maze = corridor(3);
	const game = new RuleGame(maze, { onArrive: (g) => g.moveTo(maze.cell(0, 1)) });
	assert.throws(() => game.act('F'), /do the teleporters form a loop/);
});

// --- Replay ---

// A ruleset that rolls the dice on every move, so a replay shows whether the dice agree.
const gambler = {
	onArrive: (g, action, result) => { if (result.type == 'move') g.total = (g.total ?? 0) + g.dice.int(1000); },
	summary: (g) => ({ total: g.total }),
};

test('a replay with the same seed and nonce gets the same result; another nonce differs', () => {
	const maze = corridor(6);
	const a = replayRun(maze, gambler, {}, 77, 1, 'FFFFFF');
	const b = replayRun(maze, gambler, {}, 77, 1, 'FFFFFF');
	const c = replayRun(maze, gambler, {}, 77, 2, 'FFFFFF');
	assert.strictEqual(a.valid, true);
	assert.deepStrictEqual(a, b);
	assert.strictEqual(a.rolls, 5);
	assert.notStrictEqual(a.total, c.total);
	assert.strictEqual(a.outcome, 'won');
});

test('replayRun says why a record is invalid', () => {
	const maze = corridor(3);
	assert.deepStrictEqual(replayRun(maze, {}, {}, 1, 1, ''), { valid: false, reason: 'no actions' });
	assert.match(replayRun(maze, {}, {}, 1, 1, 'BFF').reason, /^action 0 \(B\): that does nothing/);
	assert.match(replayRun(maze, {}, {}, 1, 1, 'FF').reason, /never ended/);
	assert.match(replayRun(maze, {}, {}, 1, 1, 'FFFF').reason, /continue after the game ended at 3/);
});

test('a cached placement gives the same game as placing again', () => {
	const maze = corridor(5);
	let calls = 0;
	const rules = {
		place: (m, seed, dice) => (++calls, [{ kind: 'gem', cell: m.cell(0, dice.int(5)) }]),
		summary: (g) => ({ gemCell: g.contents.ofKind('gem')[0].cell.loc.join() }),
	};
	const placed = RuleGame.place(maze, rules, 5);
	const cached = replayRun(maze, rules, {}, 5, 1, 'FFFFF', { placed });
	const fresh = replayRun(maze, rules, {}, 5, 1, 'FFFFF');
	assert.deepStrictEqual(cached, fresh);
	assert.strictEqual(calls, 2, 'the cached replay did not place again');
});

test('placing uses its own dice, so it never moves the game dice', () => {
	const maze = corridor(5);
	const quiet = replayRun(maze, gambler, {}, 9, 1, 'FFFFF');
	const placing = replayRun(maze, { ...gambler, place: (m, s, dice) => { dice.next(); dice.next(); return []; } }, {}, 9, 1, 'FFFFF');
	assert.strictEqual(placing.total, quiet.total);
});

// --- The example: monster hunt ---

// A monster hunt on a corridor with the monster, and optionally pads, put exactly where the test says.
function hunt(maze, { monster, pads = null, ...numbers } = {}) {
	return {
		...MONSTER_HUNT, ...numbers,
		place: (m) => [
			{ kind: 'monster', cell: m.cell(0, monster), hp: MONSTER_HUNT.monsterHp },
			...(pads ? [{ kind: 'pad', cell: m.cell(0, pads[0]), to: m.cell(0, pads[1]) }, { kind: 'pad', cell: m.cell(0, pads[1]), to: m.cell(0, pads[0]) }] : []),
		],
	};
}

// Plays: walk to the monster, attack until the fight ends, then the given finish.
function playHunt(maze, rules, seed, nonce, finish) {
	const game = new RuleGame(maze, rules, {}, seed, nonce);
	while (!game.fighting && !game.outcome) game.act('F');
	while (game.fighting && !game.outcome) game.act('A');
	for (const letter of finish) game.act(letter);
	return game;
}

test('monster hunt: walk in, fight, take the trophy and leave', () => {
	const maze = corridor(5);
	const rules = hunt(maze, { monster: 2, heroHp: 1000 });
	const game = playHunt(maze, rules, 3, 1, 'PFFF');
	assert.strictEqual(game.defeated, true);
	assert.strictEqual(game.trophy, true);
	assert.strictEqual(game.outcome, 'won');
	assert.strictEqual(game.contents.ofKind('monster').length, 0, 'the monster is removed');
	assert.strictEqual(game.contents.ofKind('trophy').length, 0, 'the trophy is taken');
	const summary = game.summary();
	assert.strictEqual(summary.victory, true);
	// The record replays to the same result.
	assert.deepStrictEqual(replayRun(maze, rules, {}, 3, 1, game.actions), { valid: true, ...summary });
});

test('monster hunt: you cannot walk away from a fight, or attack nothing', () => {
	const maze = corridor(4);
	const rules = hunt(maze, { monster: 1, heroHp: 1000, monsterHp: 1000 });
	const game = new RuleGame(maze, rules, {}, 1, 1);
	assert.deepStrictEqual({ ...game.act('A') }, { ok: false, reason: 'nothing to attack' });
	game.act('F');
	assert.ok(game.fighting);
	assert.match(game.act('B').reason, /in a fight/);
	assert.match(game.act('F').reason, /in a fight/);
	assert.strictEqual(game.act('A').ok, true);
	assert.strictEqual(game.actions, 'FA');
});

test('monster hunt: a weak hero dies, and dying ends the game', () => {
	const maze = corridor(4);
	const rules = hunt(maze, { monster: 1, heroHp: 1, monsterHp: 10000 });
	const game = playHunt(maze, rules, 4, 1, '');
	assert.strictEqual(game.outcome, 'died');
	assert.strictEqual(game.summary().victory, false);
	assert.strictEqual(replayRun(maze, rules, {}, 4, 1, game.actions).outcome, 'died');
});

test('monster hunt: leaving without the monster is not a victory', () => {
	const maze = corridor(5);
	const rules = hunt(maze, { monster: 3 });
	const game = new RuleGame(maze, rules, {}, 1, 1);
	['F', 'F'].forEach(l => game.act(l));         // cell 2, next to the monster
	assert.strictEqual(game.fighting, null);
	assert.strictEqual(game.act('P').ok, false, 'nothing to pick up');
	assert.strictEqual(game.act('A').ok, false);
});

test('monster hunt: pads send you across once, and arriving by pad does not send you back', () => {
	const maze = corridor(7);
	const rules = hunt(maze, { monster: 6, pads: [1, 4], heroHp: 1000 });
	const game = new RuleGame(maze, rules, {}, 1, 1, { events: true });
	game.act('F');                                 // onto the pad at 1
	assert.strictEqual(game.player.x, 4, 'sent to the other pad');
	game.act('B');                                 // off the pad
	assert.strictEqual(game.player.x, 3);
	game.act('F');                                 // back onto the pad at 4: sent to 1
	assert.strictEqual(game.player.x, 1);
	assert.deepStrictEqual([...game.events.map(e => e.type)], ['teleport', 'teleport']);
});

test('monster hunt on a real maze: placement is deterministic and well spread', () => {
	for (let seed = 1; seed <= 10; ++seed) {
		const { maze } = generate(2, seed);
		const a = RuleGame.place(maze, MONSTER_HUNT, seed);
		const b = RuleGame.place(maze, MONSTER_HUNT, seed);
		assert.deepStrictEqual(a.map(t => `${t.kind}${t.cell.loc}`), b.map(t => `${t.kind}${t.cell.loc}`));
		const cells = new Set(a.map(t => t.cell));
		assert.strictEqual(a.length, 3);
		assert.strictEqual(cells.size, 3, 'monster and the pads are in three different cells');
		const entrances = new Set(maze.entranceList.map(e => e.cell));
		assert.ok(a.every(t => !entrances.has(t.cell)), 'nothing on an entrance');
	}
});
