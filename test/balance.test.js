const test = require('node:test');
const assert = require('node:assert');
const m = require('../tools/balance/model.js');

test('a balance run is repeatable from its seed', () => {
	const cfg = { ...m.CONFIG, bandWidth: 4 };
	for (const cls of m.CLASS_NAMES) {
		const a = m.playRun(m.mulberry32(42), cls, 6, 1, cfg);
		const b = m.playRun(m.mulberry32(42), cls, 6, 1, cfg);
		assert.deepStrictEqual(a, b, cls);
	}
});

test('level bands: monsters come from your band, one up, or two up', () => {
	assert.strictEqual(m.bandOf(1, 5), 0);
	assert.strictEqual(m.bandOf(5, 5), 0);
	assert.strictEqual(m.bandOf(6, 5), 1);
	assert.strictEqual(m.bandFirstLevel(0, 5), 1);
	assert.strictEqual(m.bandFirstLevel(2, 5), 11);
});

test('death penalty share: (level - 1) x 3% + difficulty bands x 15%, capped at 100%', () => {
	assert.strictEqual(m.lossShare(1, 0), 0);
	assert.strictEqual(m.lossShare(1, 2), 0.3);
	assert.ok(Math.abs(m.lossShare(10, 1) - 0.42) < 1e-9);
	assert.ok(Math.abs(m.lossShare(20, 2) - 0.87) < 1e-9);
	assert.strictEqual(m.lossShare(40, 2), 1);
});

test('monster XP is 4 x tier^2 + HP/4 at level 1 and grows by the XP growth per level', () => {
	assert.strictEqual(m.baseMonsterXp('orc'), 4 * 9 + 28 / 4);
	assert.ok(Math.abs(m.monsterXp('orc', 3, { monsterXpGrowth: 1.5 }) - m.baseMonsterXp('orc') * 2.25) < 1e-9);
});
