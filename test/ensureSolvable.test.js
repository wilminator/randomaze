const test = require('node:test');
const assert = require('node:assert');
const { emptyMaze, openBoth, openOneWay } = require('./helpers.js');

// ensureSolvable runs inside generateMaze, so it needs the generator's working data and entrances.
function withEntrances(maze, ...cells) {
	maze.generateWorkProperty({'dist': null, 'ent': null});
	maze.entranceList = cells.map(cell => ({cell}));
	return maze;
}

/*
    S ← X          X can step into S, but S has no way to X
*/
test('ensureSolvable opens the wall the player needs, from the start side', () => {
	const maze = emptyMaze(1, 2);
	const [start, exit] = [maze.cell(0, 0), maze.cell(0, 1)];
	openOneWay(maze, exit, 'W');
	withEntrances(maze, start, exit);

	// Before the fix this opened the exit's west wall again (already open) and retried
	// forever, until the call stack overflowed.
	const path = maze.ensureSolvable(0, 1);

	assert.strictEqual(path, 'E');
	assert.strictEqual(start.data.E, null, 'the start cell can now step east');
});

/*
    S - A ← B - X  A and B are only joined by a one-way wall from B to A,
    |   |          so the start side (S, A, C, D) cannot reach the exit side (B, X).
    C - D   E - F  E sits under B and only connects to F; F sits under X.
*/
test('ensureSolvable repairs a maze split by a one-way wall', () => {
	const maze = emptyMaze(2, 4);
	const c = maze.cell;
	openBoth(maze, c(0, 0), 'E');   // S - A
	openBoth(maze, c(0, 0), 'S');   // S - C
	openBoth(maze, c(0, 1), 'S');   // A - D
	openBoth(maze, c(1, 0), 'E');   // C - D
	openOneWay(maze, c(0, 2), 'W'); // B → A
	openBoth(maze, c(0, 2), 'E');   // B - X
	openBoth(maze, c(1, 2), 'E');   // E - F
	openBoth(maze, c(0, 3), 'S');   // X - F
	withEntrances(maze, c(0, 0), c(0, 3));

	assert.strictEqual(maze.pathfind(c(0, 0), c(0, 3)), null, 'the test maze starts out unsolvable');

	const path = maze.ensureSolvable(0, 1);

	assert.notStrictEqual(path, null);
	// The repair is a single new opening: from a cell the start can reach into one that reaches the exit.
	assert.strictEqual(maze.findTraps(c(0, 0), c(0, 3)).solvable, true);
});
