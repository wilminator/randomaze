const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const { emptyMaze, openBoth, generate, ctx } = require('./helpers.js');
const { solve } = require('../tools/check_mazes_lib.js');

const MazePlayer = vm.runInContext('MazePlayer', ctx);
const TickLayer = vm.runInContext('TickLayer', ctx);
const replayInContext = vm.runInContext('replayGame', ctx);
// Copy each result into this realm, so deepStrictEqual can compare it with a plain object.
const replayGame = (maze, actions, options) => ({ ...replayInContext(maze, actions, options) });

// The same three-cell corridor as mazeplayer.test.js: start -> [0] [1] [2] -> exit.
// `between` is what separates cells 1 and 2: null (open) or a door number (1 is a plain door).
function corridor(between = null) {
	const maze = emptyMaze(1, 3);
	const [a, b, c] = [maze.cell(0, 0), maze.cell(0, 1), maze.cell(0, 2)];
	openBoth(maze, a, 'E');
	openBoth(maze, b, 'E', between);
	a.data.W = null;
	c.data.E = null;
	maze.entranceList = [{ cell: a, dir: 'W' }, { cell: c, dir: 'E' }];
	return maze;
}

test('the move hook sees every move that counts, and nothing else', () => {
	const seen = [];
	const player = new MazePlayer(corridor());
	player.onMove = (action, result) => seen.push(`${action}:${result.type}`);
	player.act('B');                  // a bump: free, no hook
	player.act('F'); player.act('L'); player.act('R'); player.act('F');
	assert.deepStrictEqual(seen, ['F:move', 'L:turn', 'R:turn', 'F:move']);
	assert.strictEqual(player.moves, 4);
});

test('with no hook installed (classic play) nothing changes', () => {
	const player = new MazePlayer(corridor());
	assert.strictEqual(player.onMove, null);
	assert.deepStrictEqual({ ...player.act('F') }, { type: 'move' });
});

test('C and W exist only in a dungeon', () => {
	const classic = new MazePlayer(corridor(1));
	classic.act('F');
	assert.strictEqual(classic.act('W'), null);
	classic.act('F');                     // opens the plain door ahead
	assert.strictEqual(classic.act('C'), null, 'classic doors stay open');
	assert.match(replayGame(corridor(1), 'FFCFF').reason, /action 2 \(C\) does nothing/);

	const dungeon = new MazePlayer(corridor(1), false, true);
	assert.deepStrictEqual({ ...dungeon.act('W') }, { type: 'wait' });
	assert.strictEqual(dungeon.moves, 1, 'waiting is a recorded move');
});

test('C closes the open door ahead, and F opens it again', () => {
	const player = new MazePlayer(corridor(1), false, true);
	player.act('F');                      // to the middle cell
	assert.strictEqual(player.act('C'), null, 'the door is still shut');
	assert.deepStrictEqual({ ...player.act('F') }, { type: 'door', key: 1 });
	assert.strictEqual(player.canWalk(player.cell(), player.dir), true);
	assert.deepStrictEqual({ ...player.act('C') }, { type: 'close', key: 1 });
	assert.strictEqual(player.canWalk(player.cell(), player.dir), false, 'closed behind');
	// The other side of the same door is closed too.
	const next = player.maze.getNextCell(player.cell(), player.dir);
	assert.strictEqual(player.canWalk(next, 'W'), false);
	assert.strictEqual(player.act('C'), null, 'already closed');
	player.act('F');                      // reopen
	player.act('F');                      // walk through
	player.act('F');                      // out of the exit
	assert.strictEqual(player.won, true);
});

test('C does nothing at an open passage or a wall', () => {
	const player = new MazePlayer(corridor(), false, true);
	assert.strictEqual(player.act('C'), null, 'an opening is not a door');
	player.act('L');
	assert.strictEqual(player.act('C'), null, 'a wall is not a door');
});

test('a locked door can be closed again, and the player keeps the key', () => {
	const maze = corridor(2);
	maze.cell(0, 1).data.item.key = 2;
	const player = new MazePlayer(maze, false, true);
	player.act('F');                      // picks up the key
	assert.deepStrictEqual({ ...player.act('F') }, { type: 'door', key: 2 });
	assert.deepStrictEqual({ ...player.act('C') }, { type: 'close', key: 2 });
	assert.ok(player.keys.includes(2));
	assert.deepStrictEqual({ ...player.act('F') }, { type: 'door', key: 2 }, 'reopens with the same key');
});

test('the tick layer counts moves by the policy', () => {
	const player = new MazePlayer(corridor(1), false, true);
	const ticks = [];
	const layer = new TickLayer(player, (n, action, result) => ticks.push(`${n}${action}`));
	'FWLRFCFF'.split('').forEach(a => player.act(a));
	assert.strictEqual(layer.ticks, player.moves);
	assert.strictEqual(ticks.length, player.moves);
	assert.strictEqual(ticks[0], '1F');
});

test('the policy decides which moves cost a tick', () => {
	// F move, L R turns, W wait, F opens the door, C closes it, F opens it, F move, F walks out.
	const actions = 'FLRWFCFFF';
	const policy = { move: true, door: true };    // turns, waits, closes and the win are free
	const player = new MazePlayer(corridor(1), false, true);
	const layer = new TickLayer(player, null, policy);
	actions.split('').forEach(a => player.act(a));
	assert.strictEqual(player.moves, 9);
	assert.strictEqual(layer.ticks, 4, 'move, door, door, move');
	// The server's replay installs the same layer and gets the same ticks.
	assert.deepStrictEqual(replayGame(corridor(1), actions, { dungeon: true, tickPolicy: policy }),
		{ valid: true, moves: 9, ticks: 4 });
});

test('replayGame in a dungeon allows C and W and counts ticks; classic output is unchanged', () => {
	// F to the middle, F opens the door, C closes it, F opens it, W waits, F through, F out.
	// The winning step is not a tick, so six of the seven moves tick.
	assert.deepStrictEqual(replayGame(corridor(1), 'FFCFWFF', { dungeon: true }), { valid: true, moves: 7, ticks: 6 });
	assert.deepStrictEqual(replayGame(corridor(1), 'FFFF'), { valid: true, moves: 4 });
	assert.deepStrictEqual(replayGame(corridor(1), 'FFFF', { dungeon: true }), { valid: true, moves: 4, ticks: 3 });
});

test('a dungeon game on a generated maze replays to the same ticks as the live player', () => {
	const { maze } = generate(1, 202601015);
	const solution = solve(maze);
	// Wait once at the entrance (a recorded move), then play the real solution.
	const actions = 'W' + solution;
	const live = [];
	const result = replayGame(maze, actions, { dungeon: true, onTick: (n, a) => live.push(a) });
	assert.strictEqual(result.valid, true);
	assert.strictEqual(result.moves, actions.length);
	assert.strictEqual(live.join(''), actions.slice(0, -1), 'every move but the winning step ticks');
});
