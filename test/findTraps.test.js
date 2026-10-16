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