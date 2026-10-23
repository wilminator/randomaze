const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const { ctx } = require('./helpers.js');

const DUNGEON_CONTENT = vm.runInContext('DUNGEON_CONTENT', ctx);
const dungeonElementMultiplier = vm.runInContext('dungeonElementMultiplier', ctx);
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

test('every species has a known element and none is Light yet', () => {
	const known = new Set([...DUNGEON_CONTENT.elements.loop, 'dark', 'neutral']);
	for (const [name, spec] of Object.entries(DUNGEON_CONTENT.monsters)) {
		assert.ok(known.has(spec.element ?? 'neutral'), `${name} has element ${spec.element}`);
		assert.notStrictEqual(spec.element, 'light', `${name} is Light`);
	}
});

test('monsters in a game carry their species element, neutral by default', () => {
	const { maze, dungeon } = buildDungeon(202601018);
	const hero = { cls: 'warrior', level: 1, xp: 0, safeShare: 1, xpTable: DUNGEON_CONTENT.xpTable, monsters: { first: 1, width: 0 } };
	const game = new DungeonGame(maze, dungeon, hero, 'n1');
	assert.ok(game.monsters.length > 0);
	for (const m of game.monsters) assert.strictEqual(m.element, DUNGEON_CONTENT.monsters[m.species].element ?? 'neutral');

	const content = JSON.parse(JSON.stringify(DUNGEON_CONTENT));
	delete content.monsters.rat.element;
	const b2 = buildDungeon(202601018, content);
	for (const m of new DungeonGame(b2.maze, b2.dungeon, hero, 'n1').monsters) if (m.species == 'rat') assert.strictEqual(m.element, 'neutral');
});
