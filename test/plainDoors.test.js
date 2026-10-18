const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const { generate, ctx } = require('./helpers.js');
const { solve } = require('../tools/check_mazes_lib.js');

const replayInContext = vm.runInContext('replayGame', ctx);
const MazePlayer = vm.runInContext('MazePlayer', ctx);
const SIDES = ['N', 'S', 'E', 'W', 'U', 'D'];

// Every wall, door and key of a maze as one string, to compare two mazes.
const layout = (maze) => maze.cellList.map(c => `${SIDES.map(d => c.data[d]).join(',')}|${c.data.item.key || ''}`).join(';');
const plainDoorSides = (maze) => maze.cellList.flatMap(c => SIDES.filter(d => c.data[d] === 1).map(d => [c, d]));

test('plain doors are added without moving anything else', () => {
	for (const [type, seed] of [[0, 1], [1, 2], [2, 3], [3, 202601017]]) {
		const before = generate(type, seed).maze;
		const after = generate(type, seed).maze;
		const placed = after.generatePlainDoors(6);
		assert.strictEqual(placed, 6, `type ${type} seed ${seed} has room for 6 doors`);
		// Each door is two sides (one from each cell), and each was an open passage before.
		const sides = plainDoorSides(after);
		assert.strictEqual(sides.length, 12);
		for (const [cell, dir] of sides) {
			const [f, r, c] = cell.loc;
			assert.strictEqual(before.grid[f][r][c].data[dir], null, 'a plain door replaces an open passage');
		}
		// Put the passages back, and the maze is exactly the one built without plain doors.
		for (const [cell, dir] of sides) cell.data[dir] = null;
		assert.strictEqual(layout(after), layout(before));
	}
});

test('the same seed always places the same plain doors', () => {
	const a = generate(2, 99).maze;
	const b = generate(2, 99).maze;
	a.generatePlainDoors(5);
	b.generatePlainDoors(5);
	assert.strictEqual(layout(a), layout(b));
});

test('plain doors stay off entrance cells and one-way walls', () => {
	for (let seed = 1; seed <= 20; ++seed) {
		const maze = generate(0, seed).maze;
		maze.generatePlainDoors(1000);
		const entrances = new Set(maze.entranceList.map(e => e.cell));
		for (const [cell, dir] of plainDoorSides(maze)) {
			assert.ok(!entrances.has(cell), `seed ${seed}: no plain door on an entrance cell`);
			assert.strictEqual(maze.getNextCell(cell, dir).data[{ N: 'S', S: 'N', E: 'W', W: 'E' }[dir]], 1,
				`seed ${seed}: both sides of a plain door are doors`);
		}
	}
});

test('asking for more doors than there are passages places as many as fit', () => {
	const maze = generate(1, 7).maze;
	const placed = maze.generatePlainDoors(100000);
	assert.ok(placed > 0 && placed < 100000);
	assert.strictEqual(plainDoorSides(maze).length, placed * 2);
	assert.strictEqual(maze.generatePlainDoors(5), 0, 'nothing left to turn into a door');
});

test('mazes with plain doors can still always be won', () => {
	for (const type of [0, 1, 2, 3]) {
		for (const seed of [1, 2, 3, 4, 5]) {
			const maze = generate(type, seed).maze;
			maze.generatePlainDoors(1000);
			const result = maze.findTraps(maze.entranceList[0].cell, maze.entranceList[maze.entrances - 1].cell);
			assert.ok(result.solvable, `type ${type} seed ${seed} is solvable`);
			assert.strictEqual(result.trapped, 0, `type ${type} seed ${seed} can't trap the player`);
		}
	}
});

test('a plain door opens with one move and no key', () => {
	const maze = generate(0, 1).maze;
	maze.generatePlainDoors(1000);
	// Stand the player right in front of a plain door.
	const [cell, dir] = plainDoorSides(maze)[0];
	const player = new MazePlayer(maze);
	[player.z, player.y, player.x] = cell.loc;
	player.dir = dir;
	assert.strictEqual(player.act('F').type, 'door', 'facing the door, F opens it');
	assert.strictEqual(player.act('F').type, 'move', 'then F walks through');
	assert.strictEqual(player.moves, 2);
	assert.deepStrictEqual([...player.keys], [1], 'no key was needed');
});

test('a game through plain doors replays on the server', () => {
	// A real winning route through a maze full of plain doors, the way a player would walk it.
	const maze = generate(1, 3).maze;
	maze.generatePlainDoors(1000);
	const actions = solve(maze);
	assert.ok(actions, 'the maze has a route');
	const result = { ...replayInContext(maze, actions) };
	assert.strictEqual(result.valid, true, result.reason);
	// And the route really went through plain doors.
	const player = new MazePlayer(maze);
	const plainOpened = [...actions].filter(a => player.act(a)?.type == 'door').length;
	assert.ok(plainOpened > 0, 'the route opened at least one plain door');
});
