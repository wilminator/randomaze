const test = require('node:test');
const assert = require('node:assert');
const { params, dailySeed } = require('./helpers.js');

test('every game type always gets at least one floor', () => {
	// Type 0 used to ask for 0 floors on about 2.5% of seeds, and building the maze crashed.
	for (let type = 0; type < 4; type++) {
		for (let seed = 1; seed <= 2000; seed++) {
			const { floors } = params(type, seed);
			assert.ok(floors >= 1, `type ${type} seed ${seed} has ${floors} floors`);
		}
	}
});

test('a seed that used to give 0 floors now gives 1', () => {
	assert.strictEqual(params(0, 78).floors, 1);
});

/*
Seeds must keep producing the same mazes, so a seed players share or a stats record
still points at the same maze. These values were recorded from main before the
0-floors fix; if this test fails, a change altered existing mazes.
*/
test('known seeds keep their parameters', () => {
	const recorded = {
		'0:1':   [1599992113203115, 2, 8, 7, 11, 3, 1],
		'0:500': [1357533827587815, 3, 7, 7, 11, 4, 0],
		'1:2':   [3343330970282759, 1, 7, 7, 4, 2, 0],
		'2:1':   [1599992113203115, 2, 9, 8, 9, 3, 1],
		'3:500': [1357533827587815, 4, 11, 9, 18, 5, 1],
	};
	for (const [key, expected] of Object.entries(recorded)) {
		const [type, seed] = key.split(':').map(Number);
		const p = params(type, seed);
		const actual = [p.mazeSeed, p.floors, p.columns, p.rows, p.doorTypes, p.entrances, p.oneWayWalls];
		assert.deepStrictEqual(actual, expected, `parameters changed for type ${type} seed ${seed}`);
	}
});

test('the same seed always gives the same parameters', () => {
	assert.deepStrictEqual(params(3, 42), params(3, 42));
});

test('dailySeed encodes year, month and day of the month', () => {
	// Months are 0-based in JavaScript: 9 is October.
	assert.strictEqual(dailySeed(new Date(2026, 9, 15)), 202601015);
	assert.strictEqual(dailySeed(new Date(2026, 0, 1)), 202600101);
	assert.strictEqual(dailySeed(new Date(2026, 11, 31)), 202601231);
});

test('dailySeed ignores the time of day', () => {
	assert.strictEqual(dailySeed(new Date(2026, 9, 15, 0, 0, 0)), dailySeed(new Date(2026, 9, 15, 23, 59, 59)));
});

test('two Tuesdays in the same month get different daily mazes', () => {
	// The old code used getDay() (day of the week), so Oct 6 and Oct 13, 2026 shared a seed.
	assert.notStrictEqual(dailySeed(new Date(2026, 9, 6)), dailySeed(new Date(2026, 9, 13)));
});

test('every day of a year gets its own daily seed', () => {
	const seeds = new Set();
	for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 1)) {
		seeds.add(dailySeed(d));
	}
	assert.strictEqual(seeds.size, 365);
});

test('leaving the seed out builds today\'s maze', () => {
	// Read the date on both sides of the call, in case the test runs across midnight.
	const before = dailySeed();
	const today = params(2);
	const after = dailySeed();
	assert.ok(
		[before, after].some(seed => JSON.stringify(params(2, seed)) === JSON.stringify(today)),
		'MazeParameters without a seed should match dailySeed()');
});

test('the dungeon type has its own extras, and the classic types have none', () => {
	for (let type = 0; type < 4; type++) {
		const p = params(type, 7);
		assert.deepStrictEqual([p.plainDoors, p.holes, p.pits], [0, 0, 0], `type ${type}`);
	}
	let withHoles = 0;
	for (let seed = 1; seed <= 300; seed++) {
		const p = params(4, seed);
		assert.ok(p.floors >= 1 && p.columns >= 8 && p.rows >= 8, `seed ${seed} is a real maze`);
		assert.ok(p.plainDoors >= 8, `seed ${seed} has plain doors`);
		assert.ok(p.pits <= p.holes, `seed ${seed}: pits are holes`);
		if (p.floors == 1) assert.strictEqual(p.holes, 0, 'no holes on a one-floor maze');
		if (p.holes > 0) ++withHoles;
		assert.deepStrictEqual(params(4, seed), p, 'the same seed gives the same parameters');
	}
	assert.ok(withHoles > 200, 'most dungeon mazes have holes');
});
