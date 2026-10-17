const test = require('node:test');
const assert = require('node:assert');
const { emptyMaze, openBoth, openOneWay, generate } = require('./helpers.js');

// Test helpers
function assertNoTraps(type, seed) {
	const { maze } = generate(type, seed);
	const result = maze.findTraps(maze.entranceList[0].cell, maze.entranceList.at(-1).cell);
	assert.strictEqual(result.solvable, true, `type ${type} seed ${seed} should be solvable`);
	assert.strictEqual(result.trapped, 0, `type ${type} seed ${seed} should have no traps`);
	return maze;
}

/*
Worked example. Maps are drawn with S = start, X = exit, and arrows for one-way walls.

    S - B - X      a plain corridor: nothing can go wrong
*/
test('a two-way corridor has no traps', () => {
	const maze = emptyMaze(1, 3);
	openBoth(maze, maze.cell(0, 0), 'E');
	openBoth(maze, maze.cell(0, 1), 'E');

	const result = maze.findTraps(maze.cell(0, 0), maze.cell(0, 2));

	assert.strictEqual(result.solvable, true);
	assert.strictEqual(result.trapped, 0);
});

/*
    S - B - X
        ↓          B can drop into P, but P has no way back out
        P
*/
test('a one-way wall into a dead end is a trap', () => {
	const maze = emptyMaze(2, 3);
	openBoth(maze, maze.cell(0, 0), 'E');
	openBoth(maze, maze.cell(0, 1), 'E');
	openOneWay(maze, maze.cell(0, 1), 'S');

	const result = maze.findTraps(maze.cell(0, 0), maze.cell(0, 2));

	assert.strictEqual(result.solvable, true);
	assert.strictEqual(result.trapped, 1);
	// The point of no return is stepping south out of B.
	// Array.from and [...] copy arrays out of the vm sandbox, so deepStrictEqual compares values only.
	assert.deepStrictEqual(Array.from(result.exits, ([cell, dir]) => [[...cell.loc], dir]), [[[0, 0, 1], 'S']]);
});

/* Take 2: test removeOneWayTraps.
    S - B - X
        ↓          B can drop into P, but P has no way back out
        P
*/
test('removeOneWayTraps opens the dead-end wall both ways', () => {
	const maze = emptyMaze(2, 3);
	openBoth(maze, maze.cell(0, 0), 'E');
	openBoth(maze, maze.cell(0, 1), 'E');
	openOneWay(maze, maze.cell(0, 1), 'S');

	// Confirm the one-way wall is open south but closed north.
	assert.strictEqual(maze.cell(0, 1).data.S, null);
	assert.strictEqual(maze.cell(1, 1).data.N, 0);
	
	// Run the test and confirm the trap is there.
	const before = maze.findTraps(maze.cell(0, 0), maze.cell(0, 2));
	assert.strictEqual(before.trapped, 1);

	// Remove the trap and confirm the one-way wall is now open both ways.
	maze.removeOneWayTraps(maze.cell(0, 0), maze.cell(0, 2));
	assert.strictEqual(maze.cell(0, 1).data.S, null);
	assert.strictEqual(maze.cell(1, 1).data.N, null);

	// Run the test again and confirm the trap is gone.
	const after = maze.findTraps(maze.cell(0, 0), maze.cell(0, 2));
	assert.strictEqual(after.trapped, 0);
});

/* Confirm that one-way walls in a loop are not a trap.
	row 0   S - B - X
				↓   |
	row 1       P - Q
*/
test('one-way walls in a loop are not a trap', () => {
	const maze = emptyMaze(2, 3);
	openBoth(maze, maze.cell(0, 0), 'E');
	openBoth(maze, maze.cell(0, 1), 'E');
	openOneWay(maze, maze.cell(0, 1), 'S');
	openBoth(maze, maze.cell(1, 1), 'E');
	openBoth(maze, maze.cell(0, 2), 'S');

	// Confirm the one-way wall is open south but closed north.
	assert.strictEqual(maze.cell(0, 1).data.S, null);
	assert.strictEqual(maze.cell(1, 1).data.N, 0);
	
	// Run the test and confirm the trap is not a trap.
	const before = maze.findTraps(maze.cell(0, 0), maze.cell(0, 2));
	assert.strictEqual(before.solvable, true);
	assert.strictEqual(before.trapped, 0);

	// Run removeOneWayTraps to prove it does not change anything.
	maze.removeOneWayTraps(maze.cell(0, 0), maze.cell(0, 2));

	// Confirm the one-way wall is unaffected.
	assert.strictEqual(maze.cell(0, 1).data.S, null);
	assert.strictEqual(maze.cell(1, 1).data.N, 0);

	// Run the test again and confirm there are still no traps.
	const after = maze.findTraps(maze.cell(0, 0), maze.cell(0, 2));
	assert.strictEqual(after.trapped, 0);
});

/* A locked door behind a one-way wall is a trap.
	row 0   S - B - X
			|   ↓   |
	row 1   K   P=2=Q
*/
test('a locked door behind a one-way wall is a trap', () => {
	const maze = emptyMaze(2, 3);
	openBoth(maze, maze.cell(0, 0), 'E');
	openBoth(maze, maze.cell(0, 1), 'E');
	openOneWay(maze, maze.cell(0, 1), 'S');
	openBoth(maze, maze.cell(0, 2), 'S');
	// The door between P and Q
	openBoth(maze, maze.cell(1, 1), 'E', 2);

	// Add a key to the maze so that the locked door can be opened,
	// but place it somewhere the player does not have to go before
	// they get to the trap. The game autoaquires items when you 
	// enter the cell.
	openBoth(maze, maze.cell(0, 0), 'S');
	maze.cell(1, 0).data.item.key = 2;

	// Confirm the one-way wall is open south but closed north.
	assert.strictEqual(maze.cell(0, 1).data.S, null);
	assert.strictEqual(maze.cell(1, 1).data.N, 0);

	// Confirm the key exists in the out-of-the-way cell.
	assert.strictEqual(maze.cell(1, 0).data.item.key, 2);

	// Confirm the way out of the trap in 1,1 is locked.
	assert.strictEqual(maze.cell(1, 1).data.E, 2);

	// Run the test and confirm the trap is there.
	const before = maze.findTraps(maze.cell(0, 0), maze.cell(0, 2));
	assert.strictEqual(before.solvable, true);
	assert.strictEqual(before.trapped, 1);

	// Remove the trap and confirm the one-way wall is now open both ways.
	maze.removeOneWayTraps(maze.cell(0, 0), maze.cell(0, 2));
	assert.strictEqual(maze.cell(0, 1).data.S, null);
	assert.strictEqual(maze.cell(1, 1).data.N, null);

	// Run the test again and confirm the trap is gone.
	const after = maze.findTraps(maze.cell(0, 0), maze.cell(0, 2));
	assert.strictEqual(after.trapped, 0);
});

/* A locked door behind a one-way wall is not a trap if
   the key is on the way.
	row 0   S - K - X
			    ↓   |
	row 1       P=2=Q
*/
test('a locked door behind a one-way wall is not a trap if the key is on the way', () => {
	const maze = emptyMaze(2, 3);
	openBoth(maze, maze.cell(0, 0), 'E');
	openBoth(maze, maze.cell(0, 1), 'E');
	openOneWay(maze, maze.cell(0, 1), 'S');
	openBoth(maze, maze.cell(0, 2), 'S');
	// The door between P and Q
	openBoth(maze, maze.cell(1, 1), 'E', 2);

	// Add a key needed somewhere the player MUST pass through to 
	// get to the trap, so that the trap is always solvable.
	maze.cell(0, 1).data.item.key = 2;

	// Confirm the one-way wall is open south but closed north.
	assert.strictEqual(maze.cell(0, 1).data.S, null);
	assert.strictEqual(maze.cell(1, 1).data.N, 0);

	// Confirm the key exists in the cell the player must pass 
	// through to get to the trap.
	assert.strictEqual(maze.cell(0, 1).data.item.key, 2);

	// Confirm the way out of the trap in 1,1 is locked.
	assert.strictEqual(maze.cell(1, 1).data.E, 2);

	// Run the test and confirm there is no trap.
	const before = maze.findTraps(maze.cell(0, 0), maze.cell(0, 2));
	assert.strictEqual(before.solvable, true);
	assert.strictEqual(before.trapped, 0);

	// Run removeOneWayTraps to prove it does not change anything.
	maze.removeOneWayTraps(maze.cell(0, 0), maze.cell(0, 2));

	// Confirm the one-way wall is unaffected.
	assert.strictEqual(maze.cell(0, 1).data.S, null);
	assert.strictEqual(maze.cell(1, 1).data.N, 0);

	// Run the test again and confirm there are still no traps.
	const after = maze.findTraps(maze.cell(0, 0), maze.cell(0, 2));
	assert.strictEqual(after.trapped, 0);
});

test('generated mazes never trap the player', () => {
	for (let seed = 1; seed <= 20; seed++) {
		assertNoTraps(3, seed);
	}
});

test('mazes that used to place two entrances at the same cell', () => {
	for (const [type, seed] of [[0,32], [1,32], [3,45]]) {
		const maze = assertNoTraps(type, seed);
		const cells = maze.entranceList.map(e => e.cell);
		assert.strictEqual(new Set(cells).size, cells.length, `entrances must be on different cells for type ${type} seed ${seed}`);
	}
});

test('mazes that used to place keys behind their doors', () => {
	for (const [type, seed] of [[2,8], [3,170]]) {
		assertNoTraps(type, seed);
	}
});
/*
findTraps keeps its states in arrays of numbers for speed. tools/check_mazes_lib.js has a
separate, plain version of the same search. Both must agree on every maze.
*/
test('findTraps agrees with the independent checker', () => {
	const { countTraps } = require('../tools/check_mazes_lib.js');
	let trapped = 0;
	for (let type = 0; type < 4; type++) {
		for (let seed = 1; seed <= 10; seed++) {
			const maze = generate(type, seed).maze;
			const start = maze.entranceList[0].cell, exit = maze.entranceList.at(-1).cell;
			// A finished maze has no traps, so make some: turn every 7th open east wall one-way.
			maze.cellList.forEach((cell, i) => { if (i % 7 == 0 && cell.data.E === null) { cell.data.E = 0; } });
			const expected = countTraps(maze);
			const result = maze.findTraps(start, exit);
			assert.strictEqual(result.solvable, expected.solvable, `type ${type} seed ${seed}`);
			assert.strictEqual(result.trapped, expected.trapped, `type ${type} seed ${seed}`);
			trapped += result.trapped;
		}
	}
	assert.ok(trapped > 0, 'some of the test mazes had traps');
});

/*
A set of keys is stored as the bits of one number, which only has room for 30 keys.
With more, findTraps switches to a BigInt. This corridor has 40 locked doors, each key
lying just before its door:  S - k3 | k4 | k5 | ... | k42 | X
*/
test('findTraps handles more keys than fit in a number', () => {
	const length = 42;
	const maze = emptyMaze(1, length);
	for (let c = 0; c < length - 1; ++c) {
		const key = c + 2;
		// Cell 0 is the start. Cell c (1 to 40) holds key c+2, and door c+2 is its east wall.
		openBoth(maze, maze.cell(0, c), 'E', c == 0 ? null : key);
		if (c > 0) { maze.cell(0, c).data.item.key = key; }
	}
	assert.deepStrictEqual(maze.findTraps(maze.cell(0, 0), maze.cell(0, length - 1)).solvable, true);
	// Move the last key to the exit, behind its own door: now that door can never open.
	// With too few bits, key 42 would share a bit with an earlier key and open anyway.
	delete maze.cell(0, length - 2).data.item.key;
	maze.cell(0, length - 1).data.item.key = length;
	assert.deepStrictEqual(maze.findTraps(maze.cell(0, 0), maze.cell(0, length - 1)).solvable, false);
});
