/*
Tests for the optional Bolt menu (ui/combat/boltmenu.js). The menu logic runs against a real DungeonGame;
the drawing is tested in a browser in test/ui/boltmenu.test.mjs. Core code must not need this file.
*/
const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { ctx } = require('./helpers.js');

vm.runInContext(fs.readFileSync(path.join(__dirname, '../ui/combat/boltmenu.js'), 'utf8'), ctx, { filename: 'ui/combat/boltmenu.js' });
const BoltMenu = vm.runInContext('BoltMenu', ctx);
const boltTint = vm.runInContext('boltTint', ctx);
const DungeonGame = vm.runInContext('DungeonGame', ctx);
const DUNGEON_CONTENT = vm.runInContext('DUNGEON_CONTENT', ctx);
const buildDungeon = vm.runInContext('buildDungeon', ctx);

const plain = (x) => JSON.parse(JSON.stringify(x));

function mageGame(cls = 'mage') {
	const { maze, dungeon } = buildDungeon(202601018);
	const hero = { cls, level: 1, xp: 0, safeShare: 1, xpTable: DUNGEON_CONTENT.xpTable, monsters: { first: 1, width: 0 } };
	return new DungeonGame(maze, dungeon, hero, 'n', { events: true });
}
// Puts the game in a fight with its first monster, as if the hero had walked into it with a first strike.
function intoFight(game) {
	game.startFight(game.monsters[0], true);
	return game;
}

test('the Mage has a Bolt menu and nobody else does', () => {
	assert.strictEqual(new BoltMenu(mageGame()).available, true);
	for (const cls of ['warrior', 'rogue', 'cleric', 'ranger', 'monk']) {
		const menu = new BoltMenu(mageGame(cls));
		assert.strictEqual(menu.available, false, cls);
		assert.strictEqual(menu.open(), false, cls);
		assert.strictEqual(menu.step, 'closed', cls);
	}
});

test('the element list opens on the current element', () => {
	const game = mageGame();
	const menu = new BoltMenu(game);
	menu.open();
	assert.strictEqual(menu.step, 'elements');
	assert.deepStrictEqual(plain(menu.entries()).map(e => e.element), ['fire', 'frost', 'earth', 'storm']);
	assert.strictEqual(menu.entries()[menu.cursor].element, 'fire');
	game.act('7');                                 // Earth
	menu.open();
	assert.strictEqual(menu.entries()[menu.cursor].element, 'earth');
});

test('the cursor wraps round the list', () => {
	const menu = new BoltMenu(mageGame());
	menu.open();
	menu.move(-1);
	assert.strictEqual(menu.entries()[menu.cursor].element, 'storm');
	menu.move(1);
	assert.strictEqual(menu.entries()[menu.cursor].element, 'fire');
});

test('out of a fight the rows say "switch, 1 tick, no SP" and choosing one switches the element', () => {
	const game = mageGame();
	const menu = new BoltMenu(game);
	menu.open();
	const rows = menu.entries();
	assert.strictEqual(rows[0].note, 'current');
	assert.strictEqual(rows[1].note, 'switch, 1 tick, no SP');
	assert.strictEqual(rows[1].cost, 0);
	const sp = game.sp;
	const result = menu.choose(1);
	assert.strictEqual(result.ok, true);
	assert.strictEqual(result.text, 'The Bolt is now Frost.');
	assert.strictEqual(game.element, 'frost');
	assert.strictEqual(game.sp, sp);
	assert.strictEqual(game.actions, '6');
	assert.strictEqual(menu.step, 'closed');
});

test('out of a fight, choosing the current element just closes the menu and records nothing', () => {
	const game = mageGame();
	const menu = new BoltMenu(game);
	menu.open();
	const result = menu.choose(0);
	assert.strictEqual(result.ok, true);
	assert.strictEqual(result.acted, false);
	assert.strictEqual(game.actions, '');
	assert.strictEqual(menu.step, 'closed');
});

test('in a fight the rows show the SP cost, 50% more for a different element', () => {
	const game = intoFight(mageGame());
	const menu = new BoltMenu(game);
	menu.open();
	const rows = menu.entries();
	assert.deepStrictEqual(plain(rows.map(r => r.cost)), [4, 6, 6, 6]);
	assert.strictEqual(rows[0].note, '4 SP');
	assert.strictEqual(rows[1].note, '6 SP (switching)');
	assert.ok(rows.every(r => r.enabled));
});

test('in a fight a choice casts the bolt and the menu says so', () => {
	const game = intoFight(mageGame());
	const menu = new BoltMenu(game);
	menu.open();
	const sp = game.sp;
	const result = menu.choose(3);                 // Storm
	assert.strictEqual(result.ok, true, result.text);
	assert.strictEqual(result.text, 'Stormbolt!');
	assert.strictEqual(game.sp, sp - 6);
	assert.strictEqual(game.element, 'storm');
});

test('rows the SP cannot pay for are disabled with a reason, and choosing one does nothing', () => {
	const game = intoFight(mageGame());
	game.sp = 5;                                   // a Firebolt (4) fits, a switch (6) does not
	const menu = new BoltMenu(game);
	menu.open();
	const rows = menu.entries();
	assert.deepStrictEqual(plain(rows.map(r => r.enabled)), [true, false, false, false]);
	assert.strictEqual(rows[1].reason, 'not enough SP for Frostbolt (6)');
	const result = menu.choose(1);
	assert.strictEqual(result.ok, false);
	assert.strictEqual(result.text, 'not enough SP for Frostbolt (6)');
	assert.strictEqual(game.sp, 5);
	assert.strictEqual(game.element, 'fire');
	assert.strictEqual(menu.step, 'elements', 'the menu stays open so the player can pick again');
});

test('every element has a distinct colour and a distinct shape', () => {
	const rows = new BoltMenu(mageGame()).entries();
	assert.strictEqual(new Set(rows.map(r => r.color)).size, 4);
	assert.strictEqual(new Set(rows.map(r => r.shape)).size, 4);
	assert.strictEqual(boltTint('frost'), rows[1].color);
	assert.strictEqual(boltTint('nothing'), '#ffffff');
});

test('the core engine does not load or mention the menu', () => {
	for (const file of ['generator/dungeon.js', 'generator/mazeplayer.js', 'ui/mazehtml.js']) {
		const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
		assert.ok(!/boltmenu|BoltMenu/.test(source), `${file} must not depend on the combat add-on`);
	}
});
