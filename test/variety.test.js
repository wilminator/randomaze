// Tests for the look variety helpers in ui/mazehtml.js: they must be deterministic and spread the looks out.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// mazehtml.js is a browser script. Its top level only declares things, so it loads fine without a page.
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../ui/mazehtml.js'), 'utf8'), ctx, { filename: 'mazehtml.js' });
const { varietyRoll, varietyDeal, lookRegions, lookAssign, visibleCells, MazeHtml } = vm.runInContext('({varietyRoll, varietyDeal, lookRegions, lookAssign, visibleCells, MazeHtml})', ctx);
const { generate } = require('./helpers.js');


test('varietyRoll is the same for the same input and stays in [0, 1)', () => {
	assert.strictEqual(varietyRoll('a', 1, 2), varietyRoll('a', 1, 2));
	assert.notStrictEqual(varietyRoll('a', 1, 2), varietyRoll('a', 2, 1));
	for (let i = 0; i < 2000; ++i) {
		const r = varietyRoll('x', i);
		assert.ok(r >= 0 && r < 1);
	}
});

test('varietyRoll is spread evenly enough to trust as a dice roll', () => {
	const buckets = Array(10).fill(0);
	for (let i = 0; i < 10000; ++i) buckets[Math.floor(varietyRoll('seed', 'wall', 0, i, i % 7) * 10)]++;
	for (const b of buckets) assert.ok(b > 800 && b < 1200, `bucket of ${b}`);
});

test('varietyDeal uses every index before repeating and never repeats back to back', () => {
	for (const size of [1, 2, 3, 5]) {
		for (let seed = 0; seed < 50; ++seed) {
			const dealt = varietyDeal(size, size * 4, 'seed', seed);
			assert.strictEqual(dealt.length, size * 4);
			for (let round = 0; round < 4; ++round) {
				const hand = dealt.slice(round * size, (round + 1) * size);
				assert.deepStrictEqual([...hand].sort(), [...Array(size).keys()]);
			}
			if (size > 1) dealt.slice(1).forEach((d, i) => assert.notStrictEqual(d, dealt[i]));
		}
	}
});

test('varietyDeal is repeatable, handles a partial hand and an empty pool', () => {
	assert.deepStrictEqual([...varietyDeal(4, 3, 's')], [...varietyDeal(4, 3, 's')]);
	assert.strictEqual(varietyDeal(4, 3, 's').length, 3);
	assert.deepStrictEqual([...varietyDeal(0, 5, 's')], []);
});


// A one-floor maze built by hand. `open` lists [row, column, dir] passages and `doors` the same for doors;
// every other wall is solid.
const opp = { N: 'S', S: 'N', W: 'E', E: 'W' };
const step = { N: [-1, 0], S: [1, 0], W: [0, -1], E: [0, 1] };
function handMaze(rows, columns, open, doors = []) {
	const grid = [[...Array(rows)].map(() => [...Array(columns)].map(() => ({ data: { N: 0, S: 0, E: 0, W: 0 } })))];
	const link = (list, value) => list.forEach(([r, c, dir]) => {
		grid[0][r][c].data[dir] = value;
		grid[0][r + step[dir][0]][c + step[dir][1]].data[opp[dir]] = value;
	});
	link(open, null);
	link(doors, 2);
	return { floors: 1, rows, columns, grid };
}
// A fully open room.
function room(rows, columns, doors = []) {
	const open = [];
	for (let r = 0; r < rows; ++r) for (let c = 0; c < columns; ++c) {
		if (c + 1 < columns) open.push([r, c, 'E']);
		if (r + 1 < rows) open.push([r, c, 'S']);
	}
	return handMaze(rows, columns, open.filter(([r, c, d]) => !doors.some(x => x[0] == r && x[1] == c && x[2] == d)), doors);
}
const plain = x => JSON.parse(JSON.stringify(x));
const sizesOf = grid => {
	const sizes = {};
	grid.flat().forEach(n => sizes[n] = (sizes[n] || 0) + 1);
	return sizes;
};

// True when the cells of every region can reach each other without leaving the region.
function regionsAreConnected(maze, grid) {
	const seen = new Set();
	const regionCount = Math.max(...grid.flat()) + 1;
	const found = new Set();
	for (let r = 0; r < maze.rows; ++r) for (let c = 0; c < maze.columns; ++c) {
		if (seen.has(r * maze.columns + c)) continue;
		if (found.has(grid[r][c])) return false;
		found.add(grid[r][c]);
		const queue = [[r, c]];
		seen.add(r * maze.columns + c);
		for (let k = 0; k < queue.length; ++k) {
			const [qr, qc] = queue[k];
			for (const dir in step) {
				const nr = qr + step[dir][0], nc = qc + step[dir][1];
				if (nr < 0 || nc < 0 || nr >= maze.rows || nc >= maze.columns || seen.has(nr * maze.columns + nc)) continue;
				const a = maze.grid[0][qr][qc].data[dir], b = maze.grid[0][nr][nc].data[opp[dir]];
				if (grid[nr][nc] == grid[r][c] && (a === null || b === null) && !(a >= 1 || b >= 1)) {
					seen.add(nr * maze.columns + nc);
					queue.push([nr, nc]);
				}
			}
		}
	}
	return found.size == regionCount;
}

test('lookRegions: a small open area is one region', () => {
	const maze = room(6, 6);
	assert.deepStrictEqual(Object.keys(sizesOf(lookRegions(maze, 's')[0])), ['0']);
});

test('lookRegions: a door is a border, and the cells either side of it are different regions', () => {
	// A corridor of 30 cells with a door between column 14 and 15.
	const maze = room(1, 30, [[0, 14, 'E']]);
	const [grid] = lookRegions(maze, 's');
	assert.deepStrictEqual(plain(grid[0]), [...Array(15).fill(0), ...Array(15).fill(1)]);
});

test('lookRegions: a closet behind a door joins the region next to it', () => {
	// Rooms of 15 and 3 cells, with a door between them.
	const maze = room(1, 18, [[0, 14, 'E']]);
	assert.deepStrictEqual(Object.keys(sizesOf(lookRegions(maze, 's')[0])), ['0']);
	// Unless the minimum is lowered to let small rooms stand.
	assert.deepStrictEqual(Object.keys(sizesOf(lookRegions(maze, 's', {min: 3})[0])), ['0', '1']);
});

test('lookRegions: a door that does not cut the area off from itself is not a border', () => {
	// A ring of cells with one door on it: both sides are still joined the other way round.
	const open = [[0, 0, 'E'], [0, 1, 'S'], [1, 1, 'W']];
	const maze = handMaze(2, 2, open, [[0, 0, 'S']]);
	assert.deepStrictEqual(Object.keys(sizesOf(lookRegions(maze, 's')[0])), ['0']);
});

test('lookRegions: a one-way wall joins the areas it connects', () => {
	const maze = handMaze(1, 4, [[0, 0, 'E'], [0, 2, 'E']]);
	maze.grid[0][0][1].data.E = null;     // open from the east side only
	maze.grid[0][0][2].data.W = 0;
	assert.deepStrictEqual(plain(lookRegions(maze, 's')[0][0]), [0, 0, 0, 0]);
});

test('lookRegions: a big door-free area is cut into several large connected regions', () => {
	const maze = room(20, 20);
	const [grid] = lookRegions(maze, 'big');
	const sizes = Object.values(sizesOf(grid));
	assert.ok(sizes.length >= 4 && sizes.length <= 12, `${sizes.length} regions`);
	assert.ok(Math.min(...sizes) >= 12, `smallest region is ${Math.min(...sizes)} cells`);
	assert.ok(regionsAreConnected(maze, grid));
});

test('lookRegions: same maze and seed give the same regions, other seeds give other cuts', () => {
	const maze = room(20, 20);
	const a = plain(lookRegions(maze, 'one')), b = plain(lookRegions(maze, 'one')), c = plain(lookRegions(maze, 'two'));
	assert.deepStrictEqual(a, b);
	assert.notDeepStrictEqual(a, c);
});

test('lookRegions: on real mazes no region is a small outcrop', () => {
	let regionTotal = 0;
	for (let type = 0; type < 4; ++type) for (let seed = 1; seed <= 8; ++seed) {
		const { maze } = generate(type, seed);
		const regions = lookRegions(maze, `${type}-${seed}`);
		for (let f = 0; f < maze.floors; ++f) {
			const sizes = Object.values(sizesOf(regions[f]));
			regionTotal += sizes.length;
			for (const size of sizes) assert.ok(size >= 12, `type ${type} seed ${seed} floor ${f}: a ${size}-cell region`);
		}
	}
	assert.ok(regionTotal > 32, 'the mazes have more than one region each overall');
});

const looksList = [
	{ wall: 'wall_a', floor: 'floor_x', ceiling: '' },
	{ wall: 'wall_a', floor: 'floor_y', ceiling: '' },
	{ wall: 'wall_b', floor: 'floor_x', ceiling: '' },
	{ wall: 'wall_c', floor: 'floor_z', ceiling: '' },
];

test('lookAssign: every region gets one of the looks, repeatably', () => {
	const maze = room(1, 10, [[0, 2, 'E'], [0, 5, 'E']]);
	const regions = lookRegions(maze, 's', {min: 1});
	const a = lookAssign(maze, regions, looksList, 's');
	assert.strictEqual(a[0].length, 3);
	for (const look of a[0]) assert.ok(looksList.includes(look));
	assert.deepStrictEqual(plain(a), plain(lookAssign(maze, regions, looksList, 's')));
});

test('lookAssign: touching regions never share a look, and avoid a shared wall or floor when they can', () => {
	// Eight rooms in a row, separated by doors.
	const doors = [1, 3, 5, 7, 9, 11, 13].map(c => [0, c, 'E']);
	const maze = room(1, 16, doors);
	for (let seed = 0; seed < 40; ++seed) {
		const [grid] = lookRegions(maze, seed, {min: 1});
		const [assigned] = lookAssign(maze, [grid], looksList, seed);
		for (let r = 0; r + 1 < assigned.length; ++r) {
			assert.notStrictEqual(assigned[r], assigned[r + 1]);
			assert.ok(assigned[r].wall != assigned[r + 1].wall || assigned[r].floor != assigned[r + 1].floor);
		}
		// Four looks, so a row of eight uses them all.
		assert.strictEqual(new Set(assigned).size, 4);
	}
});

test('lookAssign: a single look is used everywhere', () => {
	const maze = room(1, 10, [[0, 4, 'E']]);
	const [assigned] = lookAssign(maze, lookRegions(maze, 's', {min: 1}), [looksList[0]], 's');
	assert.deepStrictEqual(plain(assigned), plain([looksList[0], looksList[0]]));
});

// A MazeHtml with just what the look lookups read, built without a page.
function htmlWith(walls, looks = []) {
	const m = Object.create(MazeHtml.prototype);
	m.walls = walls;
	m.looks = looks;
	return m;
}
const img = (name, ...tags) => ({ name, css: '', tags });

test('availableLooks: loaded pairs are used exactly, and a wall or floor may be in many pairs', () => {
	const walls = [img('a', 'wall'), img('b', 'wall'), img('x', 'floor'), img('y', 'floor')];
	const m = htmlWith(walls, [{ wall: 'a', floor: 'x' }, { wall: 'a', floor: 'y' }, { wall: 'b', floor: 'y' }]);
	assert.deepStrictEqual(plain(m.availableLooks()), [
		{ wall: 'wall_a', floor: 'floor_x', ceiling: '' },
		{ wall: 'wall_a', floor: 'floor_y', ceiling: '' },
		{ wall: 'wall_b', floor: 'floor_y', ceiling: '' },
	]);
});

test('availableLooks: with no pairs loaded every wall goes with every floor, or with no floor image', () => {
	const both = htmlWith([img('a', 'wall'), img('b', 'wall'), img('x', 'floor'), img('y', 'floor')]);
	assert.strictEqual(both.availableLooks().length, 4);
	const wallsOnly = htmlWith([img('a', 'wall'), img('b', 'wall')]);
	assert.deepStrictEqual(plain(wallsOnly.availableLooks().map(l => l.floor)), ['', '']);
});

test('wallTile, floorTile and ceilingTile read the look of the cell\'s region', () => {
	const m = htmlWith([]);
	const a = { wall: 'wall_a', floor: 'floor_x', ceiling: 'ceiling_q' }, b = { wall: 'wall_b', floor: '', ceiling: '' };
	m.regions = [[[0, 0, 1], [0, 0, 1]]];
	m.regionLooks = [[a, b]];
	assert.strictEqual(m.wallTile(0, 1, 1), 'wall_a');
	assert.strictEqual(m.floorTile(0, 0, 0), 'floor_x');
	assert.strictEqual(m.ceilingTile(0, 0, 1), 'ceiling_q');
	assert.strictEqual(m.wallTile(0, 1, 2), 'wall_b');
	assert.strictEqual(m.floorTile(0, 0, 2), '');
});


const cellsOf = set => [...set].sort((a, b) => a - b);

test('visibleCells: in an open room it sees every cell within the range, as steps', () => {
	const maze = room(5, 5);
	// Steps count along passages, so the corners of a diamond are reached but not cells 3 steps away at range 2.
	assert.deepStrictEqual(cellsOf(visibleCells(maze, 0, 2, 2, 1)), [7, 11, 12, 13, 17]);
	assert.strictEqual(visibleCells(maze, 0, 2, 2, 0).size, 1);
	assert.strictEqual(visibleCells(maze, 0, 2, 2, 10).size, 25);
});

test('visibleCells: walls block the view, so a closed-off room is not drawn', () => {
	const maze = handMaze(1, 4, [[0, 0, 'E'], [0, 2, 'E']]);   // wall between columns 1 and 2
	assert.deepStrictEqual(cellsOf(visibleCells(maze, 0, 0, 0, 5)), [0, 1]);
	assert.deepStrictEqual(cellsOf(visibleCells(maze, 0, 0, 3, 5)), [2, 3]);
});

test('visibleCells: a door blocks the view until it is opened, from either side', () => {
	const maze = handMaze(1, 3, [[0, 0, 'E']], [[0, 1, 'E']]);
	assert.deepStrictEqual(cellsOf(visibleCells(maze, 0, 0, 0, 5)), [0, 1]);
	maze.grid[0][0][1].play = { E: true };
	assert.deepStrictEqual(cellsOf(visibleCells(maze, 0, 0, 0, 5)), [0, 1, 2]);
	// Opening it marks the cell on the other side too; either mark is enough.
	delete maze.grid[0][0][1].play;
	maze.grid[0][0][2].play = { W: true };
	assert.deepStrictEqual(cellsOf(visibleCells(maze, 0, 0, 0, 5)), [0, 1, 2]);
});

test('visibleCells: a one-way wall is not an opening from the closed side', () => {
	const maze = handMaze(1, 2, [[0, 0, 'E']]);
	maze.grid[0][0][0].data.E = 0;     // only the east cell thinks it is open
	assert.strictEqual(visibleCells(maze, 0, 0, 1, 5).size, 2);
});

test('visibleCells: on real mazes it is far smaller than the old square window and always includes the player', () => {
	let seen = 0, square = 0;
	for (const type of [0, 1, 2, 3]) for (let seed = 1; seed <= 3; ++seed) {
		const { maze } = generate(type, seed);
		for (let r = 0; r < maze.rows; r += 3) for (let c = 0; c < maze.columns; c += 3) {
			const v = visibleCells(maze, 0, r, c, 5);
			assert.ok(v.has(r * maze.columns + c));
			seen += v.size;
			square += (Math.min(maze.rows - 1, r + 5) - Math.max(0, r - 5) + 1) * (Math.min(maze.columns - 1, c + 5) - Math.max(0, c - 5) + 1);
		}
	}
	assert.ok(seen < square / 2, `${seen} visible against ${square} in the square`);
});
