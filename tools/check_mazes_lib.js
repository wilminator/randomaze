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
for (const f of ['mazeutil.js', 'mazegen.js', 'mazeparams.js'].map(name => `${dir}/${name}`)) {
	vm.runInContext(fs.readFileSync(path.join(rootDir, f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(`
function build(type, seed) {
	const p = new MazeParameters(type, seed);
	const m = new Maze(p.mazeSeed, p.floors, p.columns, p.rows, p.doorTypes, p.entrances, p.oneWayWalls);
	m.generateMaze();
	m.generateDoors();
	return [p, m];
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

module.exports = { load, countTraps };
