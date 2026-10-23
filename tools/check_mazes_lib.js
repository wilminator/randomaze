// Shared loader and stuck-player checker used by check_mazes.js.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const seedrandom = require('seedrandom');


// The generator lives in js/generator/ on the site and in generator/ in the open-source repo.
// Looking for both lets the same tests run unchanged in either place.
function generatorDir(rootDir) {
	for (const d of ['js/generator', 'generator']) {
		if (fs.existsSync(path.join(rootDir, d, 'mazegen.js'))) return d;
	}
	throw new Error(`No maze generator found under ${rootDir}`);
}

function load(rootDir) {
const ctx = { Math: Object.create(Math), console: { log() {} } };
ctx.Math.seedrandom = seedrandom;
vm.createContext(ctx);
const dir = generatorDir(rootDir);
// gamelayer.js is newer than the rest; a copy of the engine from before it existed does not have it.
const files = ['mazeutil.js', 'mazegen.js', 'mazeparams.js', 'mazeplayer.js', 'gamelayer.js'].map(name => `${dir}/${name}`);
for (const f of files.filter(f => fs.existsSync(path.join(rootDir, f)))) {
	vm.runInContext(fs.readFileSync(path.join(rootDir, f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(`
function build(type, seed, features = {}) {
	const p = new MazeParameters(type, seed, features);
	return [p, buildMaze(p)];
}`, ctx);
return ctx;
}

const DIRS = ['N', 'S', 'E', 'W', 'U', 'D'];

// Exact check using the game's movement rules: a state is (cell, keys held).
// Returns how many reachable states can no longer reach the exit.
function countTraps(maze) {
	const cells = maze.cellList;
	const idx = new Map(cells.map((c, i) => [c, i]));
	const start = maze.entranceList[0].cell;
	const exit = maze.entranceList[maze.entranceList.length - 1].cell;
	const keyBit = k => 1n << BigInt(k);
	const pickup = (cell, keys) => cell.data.item.key ? keys | keyBit(cell.data.item.key) : keys;
	const id = (c, k) => idx.get(c) + ':' + k;

	const states = new Map(); // id -> {cell, keys, preds:[]}
	const s0 = { cell: start, keys: pickup(start, 0n), preds: [] };
	states.set(id(s0.cell, s0.keys), s0);
	const queue = [s0];
	while (queue.length) {
		const s = queue.shift();
		if (s.cell === exit) continue; // player walks out and wins
		for (const dir of DIRS) {
			// An unseen pit drops you the moment you step on it, so you never walk on from it.
			if (s.cell.data.pit && dir != 'U' && dir != 'D') continue;
			const v = s.cell.data[dir];
			const next = maze.getNextCell(s.cell, dir);
			if (!next || !(v === null || v === 1 || (v > 1 && (s.keys & keyBit(v))))) continue;
			const keys = pickup(next, s.keys);
			const k = id(next, keys);
			let t = states.get(k);
			if (!t) { t = { cell: next, keys, preds: [] }; states.set(k, t); queue.push(t); }
			t.preds.push(s);
		}
	}
	// Walk backwards from every winning state.
	const good = new Set();
	const back = [...states.values()].filter(s => s.cell === exit);
	back.forEach(s => good.add(s));
	while (back.length) {
		for (const p of back.pop().preds) if (!good.has(p)) { good.add(p); back.push(p); }
	}
	return { states: states.size, trapped: states.size - good.size, solvable: good.has(s0) };
}

const turnRight = { N: 'E', E: 'S', S: 'W', W: 'N' };
const turnLeft = { N: 'W', W: 'S', S: 'E', E: 'N' };
const opposite = { N: 'S', S: 'N', E: 'W', W: 'E', U: 'D', D: 'U' };

/*
Finds a winning action string for a maze (see generator/mazeplayer.js), for tests.
A shortest path over (cell, keys held), then the turns and door openings along it.
Not always the fewest moves, since turning costs moves too.
*/
function solve(maze) {
	const start = maze.entranceList[0], exit = maze.entranceList[maze.entranceList.length - 1];
	const keyBit = k => 1n << BigInt(k);
	const pickup = (cell, keys) => cell.data.item.key ? keys | keyBit(cell.data.item.key) : keys;
	// The start cell's key is picked up on the first move, turn or door, before it can matter.
	const s0 = { cell: start.cell, keys: pickup(start.cell, keyBit(1)), prev: null, dir: null };
	const seen = new Set([start.cell.loc + ':' + s0.keys]);
	const queue = [s0];
	let end = null;
	while (queue.length) {
		const s = queue.shift();
		if (s.cell === exit.cell) { end = s; break; }
		for (const dir of DIRS) {
			// An unseen pit drops you the moment you step on it, so you never walk on from it.
			if (s.cell.data.pit && dir != 'U' && dir != 'D') continue;
			const v = s.cell.data[dir];
			const next = maze.getNextCell(s.cell, dir);
			if (!next || !(v === null || (v > 0 && (s.keys & keyBit(v))))) continue;
			const keys = pickup(next, s.keys);
			const id = next.loc + ':' + keys;
			if (!seen.has(id)) { seen.add(id); queue.push({ cell: next, keys, prev: s, dir }); }
		}
	}
	if (!end) return null;
	const steps = [];
	for (let s = end; s.prev; s = s.prev) steps.unshift(s);
	steps.push({ dir: exit.dir, cell: null });
	let facing = opposite[start.dir], from = start.cell, out = '';
	const opened = new Set();
	for (const step of steps) {
		if (step.dir === 'U' || step.dir === 'D') { out += step.dir; from = step.cell; continue; }
		if (turnLeft[facing] === step.dir) { out += 'L'; facing = step.dir; }
		while (facing !== step.dir) { out += 'R'; facing = turnRight[facing]; }
		// A closed door takes one action to open, then one to walk through. It stays open.
		if (from.data[step.dir] > 0 && !opened.has(from.loc + step.dir)) {
			out += 'F';
			opened.add(from.loc + step.dir);
			opened.add(step.cell.loc + opposite[step.dir]);
		}
		out += 'F';
		from = step.cell;
	}
	return out;
}

module.exports = { load, countTraps, solve };
