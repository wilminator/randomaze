const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const { emptyMaze, openBoth, generate, ctx, Maze } = require('./helpers.js');
const { solve } = require('../tools/check_mazes_lib.js');

const MazePlayer = vm.runInContext('MazePlayer', ctx);

// What the six touch buttons would show right now, as a string like 'FLR'.
const showing = player => [...'FBLRUD'].filter(a => player.canAct(a)).join('');

/*
A one-row corridor of three cells, like the one in mazeplayer.test.js. The player starts in
the west cell facing east. `between` is what separates cells 1 and 2 (null is open, a number is a door).
*/
function corridor({ between = null } = {}) {
	const maze = emptyMaze(1, 3);
	const [a, b, c] = [maze.cell(0, 0), maze.cell(0, 1), maze.cell(0, 2)];
	openBoth(maze, a, 'E');
	openBoth(maze, b, 'E', between);
	a.data.W = null;
	c.data.E = null;
	maze.entranceList = [{ cell: a, dir: 'W' }, { cell: c, dir: 'E' }];
	return maze;
}

test('at the start you can go forward and turn, but not back out of the entrance', () => {
	assert.strictEqual(showing(new MazePlayer(corridor())), 'FLR');
});

test('left and right are always offered, even facing a wall', () => {
	const player = new MazePlayer(corridor());
	player.act('L'); // now facing north, a wall
	assert.strictEqual(showing(player), 'LR');
});

test('a locked door shows Forward only when you hold its key', () => {
	const maze = corridor({ between: 2 });
	const player = new MazePlayer(maze);
	player.act('F'); // standing at the door, facing it
	assert.strictEqual(showing(player), 'BLR', 'no key: Forward hidden');
	player.keys.push(2);
	assert.strictEqual(showing(player), 'FBLR', 'with the key: Forward opens the door');
	player.act('F'); // the door opens
	assert.strictEqual(showing(player), 'FBLR', 'once open, Forward walks through');
});

test('a key for a different door does not show Forward', () => {
	const player = new MazePlayer(corridor({ between: 3 }));
	player.act('F');
	player.keys.push(2);
	assert.ok(!player.canAct('F'));
});

test('a closed door behind you hides Back even with the key; you must face a door to unlock it', () => {
	const player = new MazePlayer(corridor({ between: 2 }));
	player.keys.push(2);
	// Put the player in the middle of the corridor on the far side, door closed behind.
	player.x = 2;
	assert.strictEqual(showing(player), 'FLR', 'Back is hidden');
	player.act('L');
	player.act('L'); // turned round, now facing the door
	assert.ok(player.canAct('F'), 'facing it, Forward unlocks it');
	player.act('F');
	player.act('L');
	player.act('L'); // facing east again, the opened door is behind
	assert.ok(player.canAct('B'), 'an open door behind is walkable');
});

test('a wrong entrance shows Forward until its wall drops, then hides it', () => {
	const maze = corridor();
	maze.cell(0, 1).data.N = null;
	maze.entrances = 3;
	maze.entranceList.splice(1, 0, { cell: maze.cell(0, 1), dir: 'N' });
	const player = new MazePlayer(maze);
	player.act('F');
	player.act('L'); // facing the wrong entrance
	assert.ok(player.canAct('F'), 'it looks like a way out');
	assert.strictEqual(player.act('F').type, 'trap');
	assert.ok(!player.canAct('F'), 'the wall has dropped');
});

test('the real exit shows Forward', () => {
	const player = new MazePlayer(corridor());
	player.act('F');
	player.act('F');
	assert.ok(player.canAct('F'));
});

test('nothing is offered after the player has won', () => {
	const player = new MazePlayer(corridor());
	for (const a of 'FFF') player.act(a);
	assert.ok(player.won);
	assert.strictEqual(showing(player), '');
});

test('Up and Down show only where a ladder allows', () => {
	const maze = new Maze('test', 2, 2, 1, 0, 2, 0);
	const [a, b] = [maze.grid[0][0][0], maze.grid[0][0][1]];
	openBoth(maze, a, 'E');
	a.data.W = null;
	maze.grid[1][0][0].data.W = null;
	maze.grid[1][0][1].data.E = null;
	openBoth(maze, maze.grid[1][0][0], 'E');
	maze.entranceList = [{ cell: a, dir: 'W' }, { cell: maze.grid[1][0][1], dir: 'E' }];
	b.data.U = null;
	maze.grid[1][0][1].data.D = null;
	const player = new MazePlayer(maze);
	assert.strictEqual(showing(player), 'FLR', 'no ladder on the start cell');
	player.act('F');
	assert.strictEqual(showing(player), 'BLRU', 'a ladder up, and we are on the bottom floor');
	player.act('U');
	assert.strictEqual(showing(player), 'FBLRD', 'a ladder down, and we are on the top floor');
});

test('debug mode lets Forward through inner walls', () => {
	const maze = emptyMaze(2, 3);
	openBoth(maze, maze.cell(0, 0), 'E');
	maze.cell(0, 0).data.W = null;
	maze.cell(0, 2).data.E = null;
	maze.entranceList = [{ cell: maze.cell(0, 0), dir: 'W' }, { cell: maze.cell(0, 2), dir: 'E' }];
	const debug = new MazePlayer(maze, true);
	debug.act('R'); // facing south, a wall between this cell and the row below
	assert.ok(debug.canAct('F'), 'debug walks through the wall');
	assert.ok(!new MazePlayer(maze).canAct('B'), 'the way in is shut either way');
	const plain = new MazePlayer(maze);
	plain.act('R');
	assert.ok(!plain.canAct('F'), 'a normal player bumps the wall');
});

test('asking canAct changes nothing', () => {
	const maze = corridor({ between: 2 });
	maze.cell(0, 1).data.N = null;
	maze.entrances = 3;
	maze.entranceList.splice(1, 0, { cell: maze.cell(0, 1), dir: 'N' });
	const player = new MazePlayer(maze);
	player.keys.push(2);
	const snapshot = () => JSON.stringify([player.x, player.y, player.z, player.dir, player.actions, player.won,
		[...player.openDoors], [...player.fallenWalls], [...player.takenKeys], player.keys]);
	// Visit places where F opens a door, drops a wall, walks out and bumps.
	for (const step of ['', 'F', 'L', 'R', 'R', 'L', 'F', 'F']) {
		if (step) player.act(step);
		const before = snapshot();
		for (const a of 'FBLRUDX') player.canAct(a);
		assert.strictEqual(snapshot(), before, `after ${player.actions}`);
	}
});

test('canAct agrees with act on every action along a solved generated maze', () => {
	for (const [type, seed] of [[0, 1], [1, 2], [2, 3], [3, 202601017]]) {
		const { maze } = generate(type, seed);
		const solution = solve(maze);
		for (let i = 0; i < solution.length; ++i) {
			const player = new MazePlayer(maze);
			for (const a of solution.slice(0, i)) player.act(a);
			const predicted = [...'FBLRUDX'].map(a => player.canAct(a));
			const actual = [...'FBLRUDX'].map(a => {
				// A fresh replay for each action, since acting changes the player.
				const p = new MazePlayer(maze);
				for (const prior of solution.slice(0, i)) p.act(prior);
				return p.act(a) !== null;
			});
			assert.deepStrictEqual(predicted, actual, `type ${type} seed ${seed} after ${i} moves`);
		}
	}
});
