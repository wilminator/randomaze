const test = require('node:test');
const assert = require('node:assert');
const { generate } = require('./helpers.js');

// Build a maze and check the player can always finish it: solvable, and no one-way wall can strand them.
function assertPlayable(type, seed) {
	const { maze } = generate(type, seed);
	const result = maze.findTraps(maze.entranceList[0].cell, maze.entranceList.at(-1).cell);
	assert.strictEqual(result.solvable, true, `type ${type} seed ${seed} should be solvable`);
	assert.strictEqual(result.trapped, 0, `type ${type} seed ${seed} should have no traps`);
	return maze;
}

// Every door number (2 and up) in the maze, and every key lying in a cell.
function doorsAndKeys(maze) {
	const doors = new Set();
	const keys = [];
	for (const cell of maze.cellList) {
		for (const dir of ['N', 'S', 'E', 'W']) {
			if (cell.data[dir] > 1) { doors.add(cell.data[dir]); }
		}
		if (cell.data.item.key) { keys.push(cell.data.item.key); }
	}
	return { doors, keys };
}

/*
The repair step that frees a trapped key or door looks for a wall to knock down between
the trapped area and the rest of the maze. It skipped the stuck cell itself, so when the
trap was a single cell (a dead end entered through a one-way wall) it found nothing and crashed.
*/
test('a trap that is a single cell can be repaired', () => {
	for (const [type, seed] of [[0, 936], [3, 244], [3, 518], [3, 759]]) {
		assertPlayable(type, seed);
	}
});

/*
Sometimes no trapped cell touches a cell that can get back to the start at all: the one-way
wall into the trap comes from an area that is cut off too. The repair now opens every
one-way wall both ways, the same fix it already used when its two checks disagreed.
*/
test('a trap with no wall to knock down is repaired by opening one-way walls', () => {
	assertPlayable(3, 1714);
});

/*
When hiding a key behind a door, the generator picks a dead end to put it in.
If no dead end was left, it tried to use a cell that did not exist and crashed.
*/
test('hiding a key with no dead end left skips that door instead of crashing', () => {
	assertPlayable(0, 787);
});

/*
When the maze could not be solved, the repair step moved a key to a new dead end,
but that dead end could already hold another key. The other key was overwritten,
so its door could never be opened.
*/
test('moving a key never overwrites another key', () => {
	// 3:514 lost the key the exit needed and crashed. The others built, but left a door with no key.
	for (const [type, seed] of [[3, 514], [0, 866], [2, 8], [3, 128], [3, 342], [3, 773]]) {
		const maze = assertPlayable(type, seed);
		const { doors, keys } = doorsAndKeys(maze);
		for (const door of doors) {
			assert.ok(keys.includes(door), `type ${type} seed ${seed}: door ${door} has no key`);
		}
	}
});

test('every locked door has exactly one key', () => {
	for (let type = 0; type < 4; type++) {
		for (let seed = 1; seed <= 25; seed++) {
			const { doors, keys } = doorsAndKeys(assertPlayable(type, seed));
			for (const door of doors) {
				const count = keys.filter(key => key === door).length;
				assert.strictEqual(count, 1, `type ${type} seed ${seed}: door ${door} has ${count} keys`);
			}
		}
	}
});
