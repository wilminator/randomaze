// Test helpers: load the browser maze code into Node and build tiny mazes by hand.
const vm = require('vm');
const path = require('path');
const { load } = require('../tools/check_mazes_lib.js');

const ctx = load(path.join(__dirname, '..'));
// `class Maze` is not a property of the context, so fetch it by evaluating its name.
const Maze = vm.runInContext('Maze', ctx);

/*
Build a single-floor maze with every wall closed, so a test can open exactly the
walls it cares about. Cells are addressed as cell(row, column).
*/
function emptyMaze(rows, columns) {
	const maze = new Maze('test', 1, columns, rows, 0, 2, 0);
	maze.cell = (r, c) => maze.grid[0][r][c];
	return maze;
}

// Open a wall in both directions, like a normal passage.
function openBoth(maze, cell, dir, value = null) {
	maze.setWall(cell, dir, value);
	maze.setWall(maze.getNextCell(cell, dir), maze.opposite[dir], value);
}

// Open a wall from `cell` towards `dir` only: a one-way wall.
function openOneWay(maze, cell, dir) {
	maze.setWall(cell, dir, null);
}

const opposite = vm.runInContext('opposite', ctx);
Maze.prototype.opposite = opposite;

// Generate a full maze the same way the game does, for a game type and seed.
function generate(type, seed, features = {}) {
	const [params, maze] = vm.runInContext(`build(${type}, ${seed}, ${JSON.stringify(features)})`, ctx, { timeout: 5000 });
	return { params, maze };
}

// Build only the game parameters (no maze) for a game type and seed. Leave seed out for today's maze.
// JSON round-trips the result into a plain object from this realm, so deepStrictEqual works on it.
// `features` is passed as the third argument only when given, so the default call stays the two-argument one.
function params(type, seed = null, features) {
	const args = features === undefined ? '' : `, ${JSON.stringify(features)}`;
	return JSON.parse(vm.runInContext(`JSON.stringify(new MazeParameters(${type}, ${seed}${args}))`, ctx));
}

const dailySeed = vm.runInContext('dailySeed', ctx);

module.exports = { ctx, Maze, emptyMaze, openBoth, openOneWay, opposite, generate, params, dailySeed };
