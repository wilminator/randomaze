const test = require('node:test');
const seedrandom = require('seedrandom');
const assert = require('node:assert');
const vm = require('vm');
const { ctx } = require('./helpers.js');

const DUNGEON_CONTENT = vm.runInContext('DUNGEON_CONTENT', ctx);
const dungeonElementMultiplier = vm.runInContext('dungeonElementMultiplier', ctx);
const dungeonArmorMultiplier = vm.runInContext('dungeonArmorMultiplier', ctx);
const dungeonRollElement = vm.runInContext('dungeonRollElement', ctx);
const dungeonOffElementChance = vm.runInContext('dungeonOffElementChance', ctx);
const buildDungeon = vm.runInContext('buildDungeon', ctx);
const DungeonGame = vm.runInContext('DungeonGame', ctx);

const mult = (a, d) => dungeonElementMultiplier(DUNGEON_CONTENT, a, d);

test('the loop: each of Fire, Frost, Earth, Storm hits the next for +25% and the previous for -25%', () => {
	const loop = ['fire', 'frost', 'earth', 'storm'];
	loop.forEach((el, i) => {
		const beaten = loop[(i + 1) % 4], beater = loop[(i + 3) % 4];
		assert.strictEqual(mult(el, beaten), 1.25, `${el} on ${beaten}`);
		assert.strictEqual(mult(el, beater), 0.75, `${el} on ${beater}`);
		assert.strictEqual(mult(el, el), 1, `${el} on itself`);
		assert.strictEqual(mult(el, loop[(i + 2) % 4]), 1, `${el} on the opposite element`);
	});
});

test('Fire > Frost > Earth > Storm > Fire, spelled out', () => {
	assert.strictEqual(mult('fire', 'frost'), 1.25);
	assert.strictEqual(mult('frost', 'earth'), 1.25);
	assert.strictEqual(mult('earth', 'storm'), 1.25);
	assert.strictEqual(mult('storm', 'fire'), 1.25);
});

test('Light is +25% against Dark and has no downside', () => {
	assert.strictEqual(mult('light', 'dark'), 1.25);
	assert.strictEqual(mult('dark', 'light'), 1);
	assert.strictEqual(mult('light', 'fire'), 1);
	assert.strictEqual(mult('fire', 'light'), 1);
	assert.strictEqual(mult('dark', 'fire'), 1);
	assert.strictEqual(mult('fire', 'dark'), 1);
});

test('neutral, missing and unknown elements change nothing', () => {
	for (const el of ['fire', 'frost', 'earth', 'storm', 'light', 'dark', 'neutral', undefined, 'plasma']) {
		assert.strictEqual(mult('neutral', el), 1);
		assert.strictEqual(mult(el, 'neutral'), 1);
		assert.strictEqual(mult(undefined, el), 1);
		assert.strictEqual(mult(el, undefined), 1);
		assert.strictEqual(mult('plasma', el), 1);
	}
});

test('the bonus comes from content, so the balance bot can tune it', () => {
	const content = { ...DUNGEON_CONTENT, elements: { ...DUNGEON_CONTENT.elements, bonus: 0.5 } };
	assert.strictEqual(dungeonElementMultiplier(content, 'fire', 'frost'), 1.5);
	assert.strictEqual(dungeonElementMultiplier(content, 'frost', 'fire'), 0.5);
	assert.strictEqual(dungeonElementMultiplier(content, 'light', 'dark'), 1.5);
});

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.0006, `${a} is not ${b}`);
const armor = (pieces, attacker) => dungeonArmorMultiplier(DUNGEON_CONTENT, pieces, attacker);

test('armor: pieces that counter the attacker take 16 / 29.4 / 40.7 / 50.2% off, compounding', () => {
	const counters = 'frost';          // Frost beats Earth, so Frost armor counters an Earth attacker
	near(armor([counters], 'earth'), 0.84);
	near(armor([counters, counters], 'earth'), 1 - 0.294);
	near(armor([counters, counters, counters], 'earth'), 1 - 0.407);
	near(armor([counters, counters, counters, counters], 'earth'), 1 - 0.502);
});

test('armor: a weakness mirrors it, four weak pieces take +50.2%, not +81%', () => {
	const weak = 'earth';             // an Earth piece loses to a Frost attacker
	near(armor([weak], 'frost'), 1.16);
	near(armor([weak, weak], 'frost'), 1.294);
	near(armor([weak, weak, weak], 'frost'), 1.407);
	near(armor([weak, weak, weak, weak], 'frost'), 1.502);
});

test('armor: unrelated, neutral and empty pieces count for nothing, good and weak cancel', () => {
	assert.strictEqual(armor([], 'fire'), 1);
	assert.strictEqual(armor([null, 'neutral', undefined], 'fire'), 1);
	assert.strictEqual(armor(['fire', 'fire'], 'earth'), 1);     // the opposite element: no relation
	assert.strictEqual(armor(['fire'], 'fire'), 1);
	assert.strictEqual(armor(['frost', 'storm'], 'earth'), 1);   // Frost counters Earth, Storm loses to Earth
	near(armor(['frost', 'frost', 'storm'], 'earth'), 0.84);     // net one good piece
});

test('armor: Light armor counters Dark, Dark armor is not hurt by Light attackers', () => {
	near(armor(['light'], 'dark'), 0.84);
	assert.strictEqual(armor(['dark'], 'light'), 1);
});

// ---- monster elements per band ----

const hero = (first) => ({ cls: 'warrior', level: 1, xp: 0, safeShare: 1, xpTable: DUNGEON_CONTENT.xpTable, monsters: { first, width: 0 } });
const elementsFor = (daySeed, first, content = DUNGEON_CONTENT) => {
	const { maze, dungeon } = buildDungeon(daySeed, content);
	return new DungeonGame(maze, dungeon, hero(first), 'n1').monsters.map(m => ({ species: m.species, element: m.element }));
};

test('undead are always Dark, in every band', () => {
	for (const first of [1, 5, 9, 13, 17]) {
		for (const day of [202601018, 202601019, 202601020]) {
			for (const m of elementsFor(day, first)) if (m.species == 'skeleton' || m.species == 'wraith') assert.strictEqual(m.element, 'dark');
		}
	}
});

test('band sets: the table from the design (band 1 Fire+Frost ... band 5 Fire+Earth+Dark)', () => {
	const b = DUNGEON_CONTENT.bandElements;
	assert.deepStrictEqual(plainList(b[1]), ['fire', 'frost']);
	assert.deepStrictEqual(plainList(b[2]), ['earth', 'storm']);
	assert.deepStrictEqual(plainList(b[3]), ['fire', 'earth']);
	assert.deepStrictEqual(plainList(b[4]), ['frost', 'storm', 'dark']);
	assert.deepStrictEqual(plainList(b[5]), ['fire', 'earth', 'dark']);
});
function plainList(x) { return JSON.parse(JSON.stringify(x)); }

test('with no off-element chance every non-undead monster has an element of its band', () => {
	const content = { ...DUNGEON_CONTENT, offElementChance: { min: 0, max: 0 } };
	const bands = { 1: 1, 4: 1, 5: 2, 8: 2, 9: 3, 12: 3, 13: 4, 16: 4, 17: 5, 20: 5, 30: 5 };   // first level -> band
	for (const [first, band] of Object.entries(bands)) {
		const set = DUNGEON_CONTENT.bandElements[band];
		const seen = new Set();
		for (const day of [202601018, 202601019, 202601020, 202601021]) {
			for (const m of elementsFor(day, Number(first), content)) {
				if (m.species == 'skeleton' || m.species == 'wraith') continue;
				assert.ok(set.includes(m.element), `level ${first} ${m.species} is ${m.element}`);
				seen.add(m.element);
			}
		}
		assert.deepStrictEqual([...seen].sort(), [...set].sort(), `every element of band ${band} shows up`);
	}
});

test('a board draws its off-element share between 5% and 15%, and not the same one every time', () => {
	const shares = [];
	for (let i = 0; i < 200; ++i) shares.push(dungeonOffElementChance(DUNGEON_CONTENT, seedrandom(`board${i}`)));
	assert.ok(shares.every(x => x >= 0.05 && x < 0.15), 'shares in range');
	assert.ok(Math.min(...shares) < 0.07 && Math.max(...shares) > 0.13, 'shares spread over the range');
	const flat = { ...DUNGEON_CONTENT, offElementChance: { min: 0.1, max: 0.1 } };
	assert.strictEqual(dungeonOffElementChance(flat, seedrandom('x')), 0.1);
});

test('monsters take an off-band element at the given share, outside the band set', () => {
	const set = DUNGEON_CONTENT.bandElements[1];
	for (const chance of [0.05, 0.15]) {
		let off = 0;
		const rng = seedrandom(`off-${chance}`);
		for (let i = 0; i < 20000; ++i) if (!set.includes(dungeonRollElement(DUNGEON_CONTENT, 'goblin', 1, rng, chance))) ++off;
		assert.ok(Math.abs(off / 20000 - chance) < 0.012, `share ${off / 20000} for ${chance}`);
	}
});

test('a fixed element ignores the band and the chance, but still uses its two draws', () => {
	const rng = seedrandom('x'), ref = seedrandom('x');
	assert.strictEqual(dungeonRollElement(DUNGEON_CONTENT, 'skeleton', 1, rng, 0.15), 'dark');
	ref(); ref();
	assert.strictEqual(rng(), ref());
});

test('elements are the same for everyone on a board, differ between boards, and never touch the dice', () => {
	assert.deepStrictEqual(elementsFor(202601018, 5), elementsFor(202601018, 5));
	assert.notDeepStrictEqual(elementsFor(202601018, 1).map(m => m.element), elementsFor(202601018, 9).map(m => m.element));
	const { maze, dungeon } = buildDungeon(202601018);
	const a = new DungeonGame(maze, dungeon, hero(1), 'n1'), b = new DungeonGame(maze, dungeon, hero(1), 'n1');
	assert.strictEqual(a.dice.rolls, 0);
	assert.strictEqual(b.dice.rolls, 0);
});
