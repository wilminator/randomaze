/*
Browser test for the optional Bolt menu drawing (ui/combat/boltmenu.js). It loads the engine and the add-on
into an empty page, so it also shows the add-on needs nothing from the core UI.

Run:  npx playwright install chromium   (once)
      npm run test:ui
*/
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file) => readFileSync(`${root}${file}`, 'utf8');
const scripts = [
	'node_modules/seedrandom/seedrandom.min.js',
	'generator/mazeutil.js', 'generator/mazegen.js', 'generator/mazeparams.js', 'generator/mazeplayer.js', 'generator/dungeon.js',
	'ui/combat/boltmenu.js',
].map(read);

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser?.close(); });

// An empty page with a mage in (or out of) a fight and a menu container.
async function openMenu({ inFight = false, sp = null } = {}) {
	const page = await browser.newPage();
	const errors = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.setContent('<body><div id="host"></div></body>');
	// One script per file: top-level `class` and `const` live in the page's shared script scope.
	for (const content of scripts) await page.addScriptTag({ content });
	await page.evaluate(({ inFight, sp }) => {
		const { maze, dungeon } = buildDungeon(202601018);
		const hero = { cls: 'mage', level: 1, xp: 0, safeShare: 1, xpTable: DUNGEON_CONTENT.xpTable, monsters: { first: 1, width: 0 } };
		window.game = new DungeonGame(maze, dungeon, hero, 'n', { events: true });
		if (inFight) window.game.startFight(window.game.monsters[0], true);
		if (sp !== null) window.game.sp = sp;
		window.menu = new BoltMenu(window.game);
		window.events = [];
		window.menu.open();
		window.close = renderBoltMenu(window.menu, document.getElementById('host'), {
			onDone: r => window.events.push(['done', r.text]),
			onClose: () => window.events.push(['close']),
		});
	}, { inFight, sp });
	return { page, errors };
}

test('the list opens on the current element, with a colour and a shape on every row', async () => {
	const { page, errors } = await openMenu();
	const rows = await page.$$eval('.bolt-row', rs => rs.map(r => ({
		element: r.dataset.element, shape: r.querySelector('.icon').textContent, color: r.querySelector('.icon').style.color,
		current: r.classList.contains('current'), cursor: r.classList.contains('cursor'), note: r.querySelector('.note').textContent,
	})));
	assert.deepStrictEqual(rows.map(r => r.element), ['fire', 'frost', 'earth', 'storm']);
	assert.strictEqual(new Set(rows.map(r => r.shape)).size, 4);
	assert.strictEqual(new Set(rows.map(r => r.color)).size, 4);
	assert.deepStrictEqual(rows.map(r => r.cursor), [true, false, false, false]);
	assert.deepStrictEqual(rows.map(r => r.current), [true, false, false, false]);
	assert.strictEqual(rows[1].note, 'switch, 1 tick, no SP');
	assert.strictEqual(await page.evaluate(() => document.activeElement.dataset.element), 'fire', 'focus starts on the current element');
	assert.deepStrictEqual(errors, []);
	await page.close();
});

test('arrow keys move, Enter chooses: out of a fight it switches the element', async () => {
	const { page, errors } = await openMenu();
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	assert.strictEqual(await page.evaluate(() => game.element), 'frost');
	assert.strictEqual(await page.evaluate(() => game.actions), '6');
	assert.deepStrictEqual(await page.evaluate(() => events), [['done', 'The Bolt is now Frost.']]);
	assert.strictEqual(await page.$('.bolt-menu'), null, 'the menu closes after a choice');
	assert.deepStrictEqual(errors, []);
	await page.close();
});

test('tapping a row in a fight casts the bolt for the shown SP', async () => {
	const { page } = await openMenu({ inFight: true });
	assert.strictEqual(await page.textContent('[data-element=storm] .note'), '6 SP (switching)');
	assert.strictEqual(await page.textContent('[data-element=fire] .note'), '4 SP');
	const sp = await page.evaluate(() => game.sp);
	await page.click('[data-element=storm]');
	assert.strictEqual(await page.evaluate(() => game.sp), sp - 6);
	assert.strictEqual(await page.evaluate(() => game.element), 'storm');
	assert.deepStrictEqual(await page.evaluate(() => events), [['done', 'Stormbolt!']]);
	await page.close();
});

test('Escape and Cancel close the menu without acting', async () => {
	for (const how of ['Escape', 'Cancel']) {
		const { page } = await openMenu();
		if (how == 'Escape') await page.keyboard.press('Escape');
		else await page.click('.bolt-cancel');
		assert.strictEqual(await page.$('.bolt-menu'), null, how);
		assert.deepStrictEqual(await page.evaluate(() => events), [['close']], how);
		assert.strictEqual(await page.evaluate(() => game.actions), '', how);
		await page.close();
	}
});

test('rows the SP cannot pay for are disabled and say why', async () => {
	const { page } = await openMenu({ inFight: true, sp: 5 });
	const disabled = await page.$$eval('.bolt-row', rs => rs.map(r => r.disabled));
	assert.deepStrictEqual(disabled, [false, true, true, true]);
	assert.strictEqual(await page.getAttribute('[data-element=frost]', 'title'), 'not enough SP for Frostbolt (6)');
	await page.close();
});
