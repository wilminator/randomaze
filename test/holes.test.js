const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const { Maze, generate, ctx, openBoth } = require('./helpers.js');
const { countTraps } = require('../tools/check_mazes_lib.js');

const MazePlayer = vm.runInContext('MazePlayer', ctx);
const replayInContext = vm.runInContext('replayGame', ctx);
const SIDES = ['N', 'S', 'E', 'W', 'U', 'D'];

/*
A two-floor maze made by hand: `rows` x 3 cells on each floor, every wall closed.
The player enters the top floor's west end (row 0) and leaves by its east end.
    top floor (z = 1):   S - b - X
    bottom floor (z = 0): a0  b0  c0   (separate cells; tests join them as they need)
*/
function twoFloors(rows = 1) {
	const maze = new Maze('holes', 2, 3, rows, 0, 2, 0);
	const top = (r, c) => maze.grid[1][r][c];
	const low = (r, c) => maze.grid[0][r][c];
	openBoth(maze, top(0, 0), 'E');
	openBoth(maze, top(0, 1), 'E');
	top(0, 0).data.W = null;
	top(0, 2).data.E = null;
	maze.entranceList = [{ cell: top(0, 0), dir: 'W' }, { cell: top(0, 2), dir: 'E' }];
	return { maze, top, low };
}

// A ladder: open at both ends.
function ladder(maze, upper, lower) {
	upper.data.D = null;
	lower.data.U = null;
}

const traps = (maze) => maze.findTraps(maze.entranceList[0].cell, maze.entranceList.at(-1).cell);
// Every wall, door and key as one string, ignoring the vertical sides that holes are allowed to change.
const flat = (maze) => maze.cellList.map(c => `${['N', 'S', 'E', 'W'].map(d => c.data[d]).join(',')}|${c.data.item.key || ''}`).join(';');

test('a hole is open going down and shut coming back up', () => {
	const { maze, top, low } = twoFloors();
	// The way back up from the lower floor, so the hole cannot strand anyone.
	openBoth(maze, low(0, 0), 'E');
	ladder(maze, top(0, 0), low(0, 0));
	assert.strictEqual(maze.generateHoles(1), 1);
	assert.strictEqual(top(0, 1).data.D, null);
	assert.strictEqual(top(0, 1).data.hole, true);
	assert.strictEqual(low(0, 1).data.U, 0, 'no way back up');
	assert.strictEqual(traps(maze).trapped, 0);
});

test('a hole that would strand the player is taken back', () => {
	const { maze, top, low } = twoFloors();
	// b0 is a closed room with no ladder: dropping in is forever.
	assert.strictEqual(maze.generateHoles(1), 0);
	assert.strictEqual(top(0, 1).data.D, 0);
	assert.strictEqual(top(0, 1).data.hole, undefined);
	assert.strictEqual(low(0, 1).data.U, 0);
	assert.strictEqual(traps(maze).trapped, 0);
});

test('a hole never goes where a ladder, key or entrance is', () => {
	const { maze, top, low } = twoFloors();
	openBoth(maze, low(0, 0), 'E');
	ladder(maze, top(0, 0), low(0, 0));
	top(0, 1).data.item.key = 2;
	// The entrance cells and the key cell are the only top-floor cells; nowhere is left.
	assert.strictEqual(maze.generateHoles(5), 0);
	// The bottom floor never gets holes either.
	assert.ok(maze.cellList.filter(c => c.loc[0] == 0).every(c => !c.data.hole));
});

test('holes change nothing but the floor', () => {
	for (const [type, seed] of [[0, 1], [1, 2], [2, 3], [3, 202601017]]) {
		const before = generate(type, seed).maze;
		const after = generate(type, seed).maze;
		after.generateHoles(8, 3);
		assert.strictEqual(flat(after), flat(before), `type ${type} seed ${seed}: walls, doors and keys stay`);
		for (const cell of after.cellList) {
			if (!cell.data.hole) {
				assert.strictEqual(cell.data.D, before.grid[cell.loc[0]][cell.loc[1]][cell.loc[2]].data.D);
			}
		}
	}
});

test('the same seed always cuts the same holes', () => {
	const holes = (maze) => maze.cellList.filter(c => c.data.hole).map(c => `${c.loc}${c.data.pit ? 'p' : ''}`).join(' ');
	const a = generate(2, 99).maze;
	const b = generate(2, 99).maze;
	a.generateHoles(6, 2);
	b.generateHoles(6, 2);
	assert.ok(holes(a).length > 0);
	assert.strictEqual(holes(a), holes(b));
});

test('holes follow the placement rules in real mazes', () => {
	let total = 0;
	for (const type of [0, 1, 2, 3]) {
		for (let seed = 1; seed <= 12; ++seed) {
			const maze = generate(type, seed).maze;
			maze.generateHoles(10, 4);
			const entrances = new Set(maze.entranceList.map(e => e.cell));
			const holes = maze.cellList.filter(c => c.data.hole);
			total += holes.length;
			for (const cell of holes) {
				const below = maze.getNextCell(cell, 'D');
				assert.ok(cell.loc[0] > 0, 'not on the bottom floor');
				assert.ok(!entrances.has(cell) && !entrances.has(below), 'not at an entrance');
				assert.ok(!cell.data.item.key, 'not on a key');
				assert.strictEqual(cell.data.D, null);
				assert.strictEqual(cell.data.U, 0, 'no ladder up from a hole');
				assert.strictEqual(below.data.U, 0, 'shut ceiling below');
			}
			// A cell with a ladder is never a hole, so every hole is a new, separate opening.
			assert.ok(maze.cellList.filter(c => c.data.pit).every(c => c.data.hole), 'a pit is a hole');
			assert.ok(maze.cellList.filter(c => c.data.pit).length <= 4);
		}
	}
	assert.ok(total > 100, 'the mazes had room for holes');
});

test('mazes with holes and pits can still always be won', () => {
	// countTraps is the independent checker; it also treats a pit as a cell you can't walk on from.
	for (const type of [0, 1, 2, 3]) {
		for (let seed = 1; seed <= 25; ++seed) {
			const maze = generate(type, seed).maze;
			maze.generateHoles(12, 5);
			const result = countTraps(maze);
			assert.ok(result.solvable, `type ${type} seed ${seed} is solvable`);
			assert.strictEqual(result.trapped, 0, `type ${type} seed ${seed} can't trap the player`);
			const own = traps(maze);
			assert.strictEqual(own.trapped, 0, `type ${type} seed ${seed}: findTraps agrees`);
		}
	}
});

test('a pit that would cut the maze in two stays a plain hole', () => {
	const { maze, top, low } = twoFloors();
	openBoth(maze, low(0, 0), 'E');
	ladder(maze, top(0, 0), low(0, 0));
	// b is the only way along the top floor: falling in there can never lead on to the exit.
	assert.strictEqual(maze.generateHoles(1, 1), 1);
	assert.strictEqual(top(0, 1).data.hole, true);
	assert.ok(!top(0, 1).data.pit);
});

test('a pit goes where the maze can do without the cell', () => {
	const { maze, top, low } = twoFloors(2);
	// A second way round on row 1, so b is not the only road.
	openBoth(maze, top(0, 0), 'S');
	openBoth(maze, top(1, 0), 'E');
	openBoth(maze, top(1, 1), 'E');
	openBoth(maze, top(0, 2), 'S');
	openBoth(maze, low(0, 0), 'E');
	ladder(maze, top(0, 0), low(0, 0));
	// Which cell gets the hole is up to the dice; whichever it is, the pit is allowed to be a pit.
	assert.ok(maze.generateHoles(1, 1) >= 0);
	const pit = maze.cellList.find(c => c.data.pit);
	if (pit) {
		assert.strictEqual(pit.data.hole, true);
		assert.strictEqual(countTraps(maze).trapped, 0);
	}
});

// --- Playing with holes ---

// Row of three on the top floor with a hole or pit in the middle, and a ladder home from below.
function holeMaze({ pit = false } = {}) {
	const { maze, top, low } = twoFloors();
	openBoth(maze, low(0, 0), 'E');
	ladder(maze, top(0, 0), low(0, 0));
	const b = top(0, 1);
	b.data.D = null;
	b.data.hole = true;
	if (pit) b.data.pit = true;
	low(0, 1).data.item.key = 3;
	return { maze, top, low, b };
}

test('a hole you can see is walked across without falling', () => {
	const { maze, b } = holeMaze();
	const player = new MazePlayer(maze);
	[player.z, player.y, player.x] = [1, 0, 0];
	assert.deepStrictEqual({ ...player.act('F') }, { type: 'move' });
	assert.strictEqual(player.cell(), b);
	assert.strictEqual(player.z, 1);
});

test('D drops through a hole you can see, and it costs a fall', () => {
	const { maze, b, low } = holeMaze();
	const player = new MazePlayer(maze);
	[player.z, player.y, player.x] = [1, 0, 1];
	assert.deepStrictEqual({ ...player.act('D') }, { type: 'fall', via: 'drop', pickedUp: 3 });
	assert.strictEqual(player.cell(), low(0, 1));
	assert.strictEqual(player.moves, 1);
	assert.strictEqual(player.act('U'), null, 'there is no way back up');
	// A ladder is still a plain move.
	[player.z, player.y, player.x] = [1, 0, 0];
	assert.deepStrictEqual({ ...player.act('D') }, { type: 'move' });
});

test('an unseen pit drops you the moment you step on it', () => {
	const { maze, low } = holeMaze({ pit: true });
	const player = new MazePlayer(maze);
	[player.z, player.y, player.x] = [1, 0, 0];
	player.dir = 'E';
	const result = player.act('F');
	assert.strictEqual(result.type, 'fall');
	assert.strictEqual(result.via, 'step');
	assert.strictEqual(player.cell(), low(0, 1), 'across and down in one action');
	assert.strictEqual(player.moves, 1);
});

test('a spotted pit is just a hole', () => {
	const { maze, b } = holeMaze({ pit: true });
	const player = new MazePlayer(maze);
	[player.z, player.y, player.x] = [1, 0, 0];
	player.dir = 'E';
	player.revealedPits.add(`${b.loc}`);
	assert.deepStrictEqual({ ...player.act('F') }, { type: 'move' });
	assert.strictEqual(player.z, 1);
	// And once someone has fallen in, it is known for the rest of the run.
	const second = new MazePlayer(maze);
	[second.z, second.y, second.x] = [1, 0, 0];
	second.dir = 'E';
	assert.strictEqual(second.act('F').type, 'fall');
	assert.ok(second.revealedPits.has(`${b.loc}`));
});

test('a rope makes a hole a safe way down and a way back up', () => {
	const { maze, b, low } = holeMaze();
	const player = new MazePlayer(maze);
	[player.z, player.y, player.x] = [1, 0, 1];
	assert.strictEqual(player.act('T'), null, 'no rope in the pack');
	player.ropes = 1;
	assert.deepStrictEqual({ ...player.act('T') }, { type: 'rope' });
	assert.strictEqual(player.ropes, 0, 'the rope is used up');
	assert.strictEqual(player.act('T'), null, 'already tied');
	assert.deepStrictEqual({ ...player.act('D') }, { type: 'move', pickedUp: 3 }, 'no fall with a rope');
	assert.strictEqual(player.cell(), low(0, 1));
	assert.deepStrictEqual({ ...player.act('U') }, { type: 'move' }, 'and the rope climbs back');
	assert.strictEqual(player.cell(), b);
	assert.strictEqual(player.z, 1);
});

test('a rope only goes on a hole', () => {
	const { maze } = holeMaze();
	const player = new MazePlayer(maze);
	[player.z, player.y, player.x] = [1, 0, 0];
	player.ropes = 3;
	assert.strictEqual(player.act('T'), null, 'cell a has a ladder, not a hole');
	assert.strictEqual(player.ropes, 3);
});

test('a game with a fall and a climb home replays on the server', () => {
	// Pit in the middle: F falls to b0, B walks west to a0, U climbs the ladder to a, then straight out.
	const { maze } = holeMaze({ pit: true });
	const result = { ...replayInContext(maze, 'FBUFFF') };
	assert.deepStrictEqual(result, { valid: true, moves: 6 });
	// Without the climb the same pit would just keep dropping you; U from the bottom floor does nothing.
	assert.strictEqual(replayInContext(maze, 'FUFFF').valid, false);
});

test('the default tick policy gives no free falls or ropes', () => {
	const TickLayer = vm.runInContext('TickLayer', ctx);
	const { maze } = holeMaze({ pit: true });
	const player = new MazePlayer(maze);
	[player.z, player.y, player.x] = [1, 0, 0];
	player.dir = 'E';
	player.ropes = 1;
	const seen = [];
	const layer = new TickLayer(player, (tick, action, result) => seen.push(`${tick}:${result.type}`));
	assert.strictEqual(player.act('F').type, 'fall');
	// Walk back to the ladder and climb home, then tie a rope on the now known hole.
	assert.strictEqual(player.act('B').type, 'move');
	assert.strictEqual(player.act('U').type, 'move');
	assert.strictEqual(player.act('F').type, 'move');
	assert.strictEqual(player.act('T').type, 'rope');
	assert.deepStrictEqual(seen, ['1:fall', '2:move', '3:move', '4:move', '5:rope']);
	assert.strictEqual(layer.ticks, 5);
});

test('buildMaze takes hole counts from whoever supplies the parameters', () => {
	const buildMaze = vm.runInContext('buildMaze', ctx);
	const base = JSON.parse(JSON.stringify(generate(2, 31).params));
	const holesIn = (maze) => maze.cellList.filter(c => c.data.hole).length;
	// No holes or pits in the parameters: the maze is the one every earlier version built.
	assert.strictEqual(holesIn(buildMaze(base)), 0);
	// A site (or any caller) writes the numbers itself; they need not come from MazeParameters.
	const own = { ...base, floors: 4, holes: 6, pits: 2 };
	const maze = buildMaze(own);
	const again = buildMaze(own);
	assert.ok(holesIn(maze) > 0 && holesIn(maze) <= 6);
	assert.ok(maze.cellList.filter(c => c.data.pit).length <= 2);
	assert.strictEqual(holesIn(maze), holesIn(again), 'the same parameters give the same holes');
	assert.strictEqual(countTraps(maze).trapped, 0);
});
