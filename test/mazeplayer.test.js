const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const { emptyMaze, openBoth, generate, ctx } = require('./helpers.js');
const { solve } = require('../tools/check_mazes_lib.js');

const MazePlayer = vm.runInContext('MazePlayer', ctx);
// Copy each result into this realm, so deepStrictEqual can compare it with a plain object.
const replayInContext = vm.runInContext('replayGame', ctx);
const replayGame = (maze, actions) => ({ ...replayInContext(maze, actions) });

/*
A one-row corridor of three cells. The player starts in the west cell facing east and
leaves by the east end:  start -> [0] [1] [2] -> exit
`between` is what separates cells 1 and 2: null (open) or a door number.
*/
function corridor({ between = null, keyAt = null, key = 2 } = {}) {
	const maze = emptyMaze(1, 3);
	const [a, b, c] = [maze.cell(0, 0), maze.cell(0, 1), maze.cell(0, 2)];
	openBoth(maze, a, 'E');
	openBoth(maze, b, 'E', between);
	a.data.W = null;
	c.data.E = null;
	maze.entranceList = [{ cell: a, dir: 'W' }, { cell: c, dir: 'E' }];
	if (keyAt !== null) maze.cell(0, keyAt).data.item.key = key;
	return maze;
}

test('walking straight out of the exit wins, and the last step counts', () => {
	assert.deepStrictEqual(replayGame(corridor(), 'FFF'), { valid: true, moves: 3 });
});

test('turning counts as a move', () => {
	assert.deepStrictEqual(replayGame(corridor(), 'LRFFF'), { valid: true, moves: 5 });
	assert.deepStrictEqual(replayGame(corridor(), 'RRRRFFF'), { valid: true, moves: 7 });
});

test('bumping into a wall does nothing, so a game that contains a bump is not a real recording', () => {
	const player = new MazePlayer(corridor());
	// Behind the player is the way in, which acts as a wall.
	assert.strictEqual(player.act('B'), null);
	assert.strictEqual(player.act('U'), null, 'no ladder here');
	assert.strictEqual(player.moves, 0);
	assert.match(replayGame(corridor(), 'BFFF').reason, /action 0 \(B\) does nothing/);
});

test('opening a door is its own move and needs the key', () => {
	// The key lies in the middle cell, so walking there picks it up.
	assert.deepStrictEqual(replayGame(corridor({ between: 2, keyAt: 1 }), 'FFFF'), { valid: true, moves: 4 });
	// No key anywhere: the door stays shut.
	assert.match(replayGame(corridor({ between: 2 }), 'FFFF').reason, /action 1 \(F\) does nothing/);
	// A plain door (number 1) needs no key, but opening it is still a move.
	assert.deepStrictEqual(replayGame(corridor({ between: 1 }), 'FFFF'), { valid: true, moves: 4 });
});

test('a key on the start cell is picked up by the first turn, not before', () => {
	const maze = corridor({ keyAt: 0 });
	maze.cell(0, 0).data.E = 2;
	maze.cell(0, 1).data.W = 2;
	const player = new MazePlayer(maze);
	assert.strictEqual(player.act('F'), null, 'the door is locked at the start');
	const turn = player.act('L');
	assert.strictEqual(turn.pickedUp, 2);
	assert.deepStrictEqual(replayGame(maze, 'LRFFFF'), { valid: true, moves: 6 });
});

test('walking out of an entrance that is not the exit drops its wall, once', () => {
	const maze = corridor();
	// A third entrance above the middle cell.
	maze.cell(0, 1).data.N = null;
	maze.entrances = 3;
	maze.entranceList.splice(1, 0, { cell: maze.cell(0, 1), dir: 'N' });
	const player = new MazePlayer(maze);
	player.act('F');
	player.act('L');
	assert.strictEqual(player.act('F').type, 'trap');
	assert.strictEqual(player.act('F'), null, 'after that it is a wall');
	assert.strictEqual(player.moves, 3);
	assert.deepStrictEqual(replayGame(maze, 'FLFRFF'), { valid: true, moves: 6 });
});

test('a game must end exactly when the player walks out', () => {
	assert.match(replayGame(corridor(), 'FF').reason, /never left/);
	assert.match(replayGame(corridor(), 'FFFL').reason, /after the win/);
	assert.match(replayGame(corridor(), '').reason, /no actions/);
	assert.match(replayGame(corridor(), 'FFX').reason, /\(X\) does nothing/);
	assert.match(replayGame(corridor(), null).reason, /no actions/);
});

test('generated mazes of every type can be replayed, and replaying leaves the maze unchanged', () => {
	for (const type of [0, 1, 2, 3]) {
		for (const seed of [1, 2, 3, 202601017]) {
			const { maze } = generate(type, seed);
			const actions = solve(maze);
			const first = replayGame(maze, actions);
			assert.deepStrictEqual(first, { valid: true, moves: actions.length }, `type ${type} seed ${seed}`);
			assert.deepStrictEqual(replayGame(maze, actions), first, 'the same maze replays the same way twice');
		}
	}
});
