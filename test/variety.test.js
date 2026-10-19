// Tests for the look variety helpers in ui/mazehtml.js: they must be deterministic and spread the looks out.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// mazehtml.js is a browser script. Its top level only declares things, so it loads fine without a page.
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../ui/mazehtml.js'), 'utf8'), ctx, { filename: 'mazehtml.js' });
const { varietyRoll, varietyPick, varietyDeal, MazeHtml } = vm.runInContext('({varietyRoll, varietyPick, varietyDeal, MazeHtml})', ctx);

// A MazeHtml with just what wallTile and floorTile read, built without a page.
function lookups(walls, seed = 'seed', floors = 2) {
	const m = Object.create(MazeHtml.prototype);
	m.seed = seed;
	m.walls = walls;
	m.variety = { wall: { patch: 3, baseShare: 0.6 }, floor: { patch: 2, baseShare: 0.6 } };
	const wallOnly = walls.filter(w => w.tags.includes('wall'));
	m.wallTiles = [...Array(floors)].map((_, f) => wallOnly.length ? `wall_${wallOnly[f % wallOnly.length].name}` : '');
	m.floorBase = [...Array(floors)].map((_, f) => Math.floor(varietyRoll(seed, 'floorbase', f) * 4294967296));
	return m;
}
const img = (name, ...tags) => ({ name, css: '', tags });

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

test('varietyPick uses the main look about baseShare of the time and the others evenly', () => {
	const choices = ['a', 'b', 'c', 'd'];
	const counts = {};
	for (let i = 0; i < 20000; ++i) {
		const pick = varietyPick(choices, 1, 0.6, 'seed', i);
		counts[pick] = (counts[pick] || 0) + 1;
	}
	assert.ok(Math.abs(counts.b / 20000 - 0.6) < 0.02);
	for (const other of ['a', 'c', 'd']) assert.ok(Math.abs(counts[other] / 20000 - 0.4 / 3) < 0.02, other);
});

test('varietyPick with one choice returns it, and with none returns undefined', () => {
	assert.strictEqual(varietyPick(['only'], 0, 0.6, 1), 'only');
	assert.strictEqual(varietyPick([], 0, 0.6, 1), undefined);
});

test('varietyPick with baseShare 1 always gives the main look', () => {
	for (let i = 0; i < 200; ++i) assert.strictEqual(varietyPick(['a', 'b', 'c'], 2, 1, i), 'c');
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

test('wallTile: one wall image gives every cell that image', () => {
	const m = lookups([img('a', 'wall')]);
	for (let r = 0; r < 10; ++r) for (let c = 0; c < 10; ++c) assert.strictEqual(m.wallTile(0, r, c), 'wall_a');
});

test('wallTile: the same maze always looks the same, and a patch is one look', () => {
	const walls = [img('a', 'wall'), img('b', 'wall'), img('c', 'wall')];
	const m = lookups(walls);
	const again = lookups(walls);
	for (let r = 0; r < 12; ++r) for (let c = 0; c < 12; ++c) {
		assert.strictEqual(m.wallTile(0, r, c), again.wallTile(0, r, c));
		// Cells in the same 3 by 3 patch match.
		assert.strictEqual(m.wallTile(0, r, c), m.wallTile(0, r - r % 3, c - c % 3));
	}
});

test('wallTile: a floor uses several looks and leans to its main one', () => {
	const walls = [img('a', 'wall'), img('b', 'wall'), img('c', 'wall'), img('d', 'wall')];
	const m = lookups(walls);
	const counts = {};
	for (let r = 0; r < 60; r += 3) for (let c = 0; c < 60; c += 3) {
		const t = m.wallTile(0, r, c);
		counts[t] = (counts[t] || 0) + 1;
	}
	assert.strictEqual(Object.keys(counts).length, 4);
	assert.ok(counts[m.wallTiles[0]] > 400 * 0.45, 'main look is most common');
});

test('wallTile: different seeds give different layouts', () => {
	const walls = [img('a', 'wall'), img('b', 'wall'), img('c', 'wall')];
	const a = lookups(walls, 'one'), b = lookups(walls, 'two');
	let different = 0;
	for (let r = 0; r < 30; r += 3) for (let c = 0; c < 30; c += 3) different += a.wallTile(0, r, c) != b.wallTile(0, r, c);
	assert.ok(different > 10);
});

test('wallTile ignores images that are only for floors', () => {
	const m = lookups([img('a', 'wall'), img('b', 'wall'), img('grass', 'floor')]);
	for (let r = 0; r < 30; ++r) for (let c = 0; c < 30; ++c) assert.notStrictEqual(m.wallTile(0, r, c), 'wall_grass');
});

test('floorTile: no floor images gives no class, so the old colour stays', () => {
	assert.strictEqual(lookups([img('a', 'wall')]).floorTile(0, 3, 3), '');
});

test('floorTile: varies in 2 by 2 patches, uses only floor images, and is repeatable', () => {
	const walls = [img('a', 'wall'), img('f1', 'floor'), img('f2', 'floor'), img('f3', 'floor', 'wall')];
	const m = lookups(walls);
	const seen = new Set();
	for (let r = 0; r < 40; ++r) for (let c = 0; c < 40; ++c) {
		const t = m.floorTile(1, r, c);
		seen.add(t);
		assert.ok(t.startsWith('floor_') && t != 'floor_a');
		assert.strictEqual(t, m.floorTile(1, r - r % 2, c - c % 2));
		assert.strictEqual(t, lookups(walls).floorTile(1, r, c));
	}
	assert.strictEqual(seen.size, 3);
});
