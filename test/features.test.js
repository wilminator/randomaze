const test = require('node:test');
const assert = require('node:assert');
const { generate, params } = require('./helpers.js');

/*
Maze features are optional extras, all off by default. The promise these tests keep:
asking for no features gives exactly the maze every earlier version gave, so a seed a
player shared, or a run a server replays, never changes under them.
*/

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1).concat([202601017, 202601231]);

// Every wall, door and key of a maze, as one string, to compare two mazes cell for cell.
function describe(maze) {
	return maze.cellList.map(cell => {
		const d = cell.data;
		return `${cell.loc}|${d.N},${d.S},${d.E},${d.W},${d.U},${d.D}|${d.item.key || ''}`;
	}).join(';') + JSON.stringify(maze.entranceList.map(e => [e.cell.loc, e.dir]));
}

test('no features, {} and an unset feature all give the same parameters', () => {
	for (let type = 0; type < 4; type++) {
		for (const seed of SEEDS) {
			const plain = params(type, seed);
			assert.deepStrictEqual(params(type, seed, {}), plain, `{} changed type ${type} seed ${seed}`);
			assert.deepStrictEqual(params(type, seed, { plainDoors: false }), plain, `false changed type ${type} seed ${seed}`);
			assert.deepStrictEqual(params(type, seed, { unknownFeature: true }), plain, `unknown key changed type ${type} seed ${seed}`);
			assert.strictEqual(plain.plainDoors, 0);
		}
	}
});

test('no features, {} and an unset feature all give the same maze', () => {
	for (let type = 0; type < 4; type++) {
		for (const seed of SEEDS.slice(0, 20)) {
			const plain = describe(generate(type, seed).maze);
			assert.strictEqual(describe(generate(type, seed, {}).maze), plain, `{} changed type ${type} seed ${seed}`);
			assert.strictEqual(describe(generate(type, seed, { plainDoors: false }).maze), plain, `false changed type ${type} seed ${seed}`);
		}
	}
});

test('plainDoors changes only the feature count, not a single classic number', () => {
	for (let type = 0; type < 4; type++) {
		for (const seed of SEEDS) {
			const { plainDoors, ...withFeature } = params(type, seed, { plainDoors: true });
			const { plainDoors: none, ...without } = params(type, seed);
			assert.deepStrictEqual(withFeature, without, `type ${type} seed ${seed}`);
			assert.ok(plainDoors > 0, `type ${type} seed ${seed} asked for no doors`);
		}
	}
});

test('plainDoors only adds doors: no wall, key or locked door moves', () => {
	for (let type = 0; type < 4; type++) {
		for (const seed of SEEDS.slice(0, 15)) {
			const before = generate(type, seed).maze;
			const after = generate(type, seed, { plainDoors: true }).maze;
			assert.strictEqual(after.cellList.length, before.cellList.length);
			let added = 0;
			after.cellList.forEach((cell, i) => {
				const was = before.cellList[i];
				assert.strictEqual(cell.data.item.key || '', was.data.item.key || '', 'a key moved');
				for (const dir of ['N', 'S', 'E', 'W', 'U', 'D']) {
					if (cell.data[dir] === was.data[dir]) continue;
					// The only allowed change: an open passage (null) became a plain door (1).
					assert.strictEqual(was.data[dir], null, `type ${type} seed ${seed}: a wall or locked door changed`);
					assert.strictEqual(cell.data[dir], 1);
					++added;
				}
			});
			assert.ok(added > 0, `type ${type} seed ${seed} got no doors`);
		}
	}
});

test('plainDoors is deterministic', () => {
	for (let type = 0; type < 4; type++) {
		for (const seed of SEEDS.slice(0, 10)) {
			const a = describe(generate(type, seed, { plainDoors: true }).maze);
			const b = describe(generate(type, seed, { plainDoors: true }).maze);
			assert.strictEqual(a, b);
			assert.notStrictEqual(a, describe(generate(type, seed).maze), 'the feature changed nothing');
		}
	}
});

test('a maze with plain doors can still be won', () => {
	const { countTraps } = require('../tools/check_mazes_lib.js');
	for (let type = 0; type < 4; type++) {
		for (const seed of SEEDS.slice(0, 8)) {
			const result = countTraps(generate(type, seed, { plainDoors: true }).maze);
			assert.ok(result.solvable, `type ${type} seed ${seed} cannot be won`);
			assert.strictEqual(result.trapped, 0, `type ${type} seed ${seed} can trap the player`);
		}
	}
});
