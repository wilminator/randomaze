/*
Browser tests for the UI. They open demo/index.html in headless Chromium.

Run:  npx playwright install chromium   (once)
      npm run test:ui

The page loads jQuery and seedrandom from a CDN. The tests answer those requests
with the copies in node_modules, so they run offline and always use the same versions.
*/
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);

const root = fileURLToPath(new URL('../../', import.meta.url));
const demoUrl = pathToFileURL(`${root}demo/index.html`).href;
const libs = {
	jquery: readFileSync(`${root}node_modules/jquery/dist/jquery.slim.min.js`),
	seedrandom: readFileSync(`${root}node_modules/seedrandom/seedrandom.min.js`),
};

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser?.close(); });

/*
Open the demo. With `script`, that code runs instead of demo.js, so a test can set the game
up its own way. Returns the page and a list that collects uncaught errors from the page.
*/
async function openDemo(query, script = null, pageOptions = {}) {
	const page = await browser.newPage(pageOptions);
	const errors = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.route('https://cdnjs.cloudflare.com/**', route => {
		const url = route.request().url();
		const lib = Object.keys(libs).find(name => url.includes(name));
		// Font Awesome's stylesheet is not needed for these tests.
		return route.fulfill(lib ? { body: libs[lib], contentType: 'text/javascript' } : { body: '', contentType: 'text/css' });
	});
	if (script) {
		await page.route('**/demo/demo.js', route => route.fulfill({ body: script, contentType: 'text/javascript' }));
	}
	await page.goto(`${demoUrl}${query}`);
	await page.waitForSelector('#moves');
	return { page, errors };
}

// A game set up like the demo, but with only `keyCount` key items and no menu callback.
// `plainDoors` asks the generator for that many keyless doors.
function gameScript(type, seed, keyCount, plainDoors = 0) {
	return `
		const params = new MazeParameters(${type}, ${seed});
		const maze = new Maze(params.mazeSeed, params.floors, params.columns, params.rows,
			params.doorTypes, params.entrances, params.oneWayWalls);
		const mazehtml = new MazeHtml(params.htmlSeed, maze);
		mazehtml.loadWall({name: 'plain', css: 'background: gray;', tags: ['wall']});
		mazehtml.loadDoor({css: 'background: brown;', tags: ['split']});
		for (let i = 0; i < ${keyCount}; ++i) {
			mazehtml.loadItem({name: 'Key ' + i, initials: 'K' + i, src: '', invsrc: '', css: '',
				tags: ['key'], doorcolor: '#FF0000'});
		}
		mazehtml.generateGameUi('gamewindow');
		maze.generateMaze();
		maze.generateDoors();
		maze.generatePlainDoors(${plainDoors});
		mazehtml.playGame();
		window.game = {maze, mazehtml};
	`;
}

// Type 3 seed 3 hides 19 keys, more than the 11 key colours the demo used to load.
test('the demo can play a large maze with many keys', async () => {
	const { page, errors } = await openDemo('?type=3&seed=3');
	assert.deepStrictEqual(errors, []);
	assert.ok(await page.locator('.tile').count() > 0, 'the maze was drawn');
	await page.close();
});

test('a game with fewer key items than keys reuses items instead of crashing', async () => {
	const { page, errors } = await openDemo('', gameScript(3, 3, 4));
	assert.deepStrictEqual(errors, []);
	const keys = await page.evaluate(() => game.maze.cellList.filter(cell => cell.data.item.key).length);
	assert.ok(keys > 4, `this maze needs more than 4 keys (it has ${keys})`);
	assert.ok(await page.locator('.door').count() > 0, 'the doors were drawn');
	await page.close();
});

test('switching away from the window lets go of held keys', async () => {
	const { page } = await openDemo('?type=1&seed=5');
	const moves = async () => Number((await page.locator('#moves').textContent()).match(/\d+/)[0]);
	// Hold the left arrow: the player keeps turning.
	await page.keyboard.down('ArrowLeft');
	await page.waitForFunction(() => /Moves: [1-9]/.test(document.querySelector('#moves').textContent));
	// Alt-Tab away. The browser sends no keyup to a page that has lost focus.
	await page.evaluate(() => window.dispatchEvent(new Event('blur')));
	// Let the turn in progress finish, then check that no more turns follow. A held key
	// turns the player about once a second, so five quiet seconds means it was let go.
	await page.waitForTimeout(1500);
	const before = await moves();
	await page.waitForTimeout(5000);
	assert.strictEqual(await moves(), before, 'the player stopped turning');
	await page.close();
});

/*
A phone can cancel a touch instead of ending it: a long press that opens the text menu, a
notification sliding in, a swipe the browser takes as a scroll. The page then gets touchcancel
and never touchend, so a button held at that moment used to stay pressed for good.
*/
test('a cancelled touch lets go of the touch button', async () => {
	const { page } = await openDemo('?type=1&seed=5', null, { hasTouch: true });
	const moves = async () => Number((await page.locator('#moves').textContent()).match(/\d+/)[0]);
	const touch = (type, id) => page.evaluate(([type, id]) => {
		const target = document.getElementById(id);
		const box = target.getBoundingClientRect();
		const point = new Touch({ identifier: 1, target, clientX: box.left + 5, clientY: box.top + 5 });
		const touches = type == 'touchstart' ? [point] : [];
		target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true,
			touches, targetTouches: touches, changedTouches: [point] }));
	}, [type, id]);
	// Hold Right: the player keeps turning.
	await touch('touchstart', 'touchRight');
	await page.waitForFunction(() => /Moves: [1-9]/.test(document.querySelector('#moves').textContent));
	await touch('touchcancel', 'touchRight');
	// Same timing as the blur test above: let the turn in progress finish, then expect quiet.
	await page.waitForTimeout(1500);
	const before = await moves();
	await page.waitForTimeout(5000);
	assert.strictEqual(await moves(), before, 'the player stopped turning');
	// And the other buttons still work: one stuck button used to block them all.
	await touch('touchstart', 'touchLeft');
	await page.waitForFunction(n => Number(document.querySelector('#moves').textContent.match(/\d+/)[0]) > n, before);
	await touch('touchend', 'touchLeft');
	await page.close();
});

/*
The touch buttons turn themselves on where the device has a touch screen, whichever way an
iPad is held. They always catch touches (so a tap on the maze works), and are drawn when the
screen is portrait or after Show, and not after Hide. A page can force them on or off; the
site's Settings does.
*/
const iPadSizes = { landscape: { width: 1180, height: 820 }, portrait: { width: 820, height: 1180 } };
const middle = { x: 590, y: 330 };   // inside the Forward box on the landscape size
// Do the buttons exist (they catch touches), and are they drawn? Playwright counts a see-through
// element as visible, so drawing is checked through the opacity.
const touchLive = page => page.locator('#touchNav').isVisible();
const touchDrawn = async page => await touchLive(page)
	&& await page.evaluate(() => getComputedStyle(document.getElementById('touchNav')).opacity == '1');
const pointId = (page, x, y) => page.evaluate(([x, y]) => document.elementFromPoint(x, y).id, [x, y]);

for (const [way, viewport] of Object.entries(iPadSizes)) {
	test(`a touch screen gets live touch buttons automatically (${way})`, async () => {
		const { page } = await openDemo('?type=1&seed=5', null, { hasTouch: true, viewport });
		assert.ok(await touchLive(page), 'the buttons are there');
		assert.ok((await pointId(page, viewport.width / 2, viewport.height * 0.4)).startsWith('touch'), 'a tap lands on a button');
		assert.strictEqual(await touchDrawn(page), way == 'portrait', 'drawn upright, invisible sideways');
		await page.close();
	});
}

test('a device without a touch screen gets no touch buttons, and the maze takes the pointer', async () => {
	const { page } = await openDemo('?type=1&seed=5', null, { viewport: iPadSizes.portrait });
	assert.ok(!await touchLive(page), 'the buttons are gone');
	assert.ok(!(await pointId(page, 410, 470)).startsWith('touch'), 'nothing invisible sits over the maze');
	await page.close();
});

test('the touch buttons can be forced off or on', async () => {
	const touch = await openDemo('', gameScript(1, 5, 4), { hasTouch: true });
	await touch.page.evaluate(() => game.mazehtml.setTouchControls('off'));
	assert.ok(!await touchLive(touch.page), 'off removes them on a touch screen');
	await touch.page.evaluate(() => game.mazehtml.setTouchControls('auto'));
	assert.ok(await touchLive(touch.page), 'auto brings them back');
	await touch.page.close();
	const plain = await openDemo('', gameScript(1, 5, 4));
	await plain.page.evaluate(() => game.mazehtml.setTouchControls('on'));
	assert.ok(await touchLive(plain.page), 'on adds them without a touch screen');
	await plain.page.close();
});

test('Hide stops drawing the touch buttons but they still catch taps, and Show draws them again', async () => {
	const { page } = await openDemo('?type=1&seed=5', null, { hasTouch: true, viewport: iPadSizes.portrait });
	// Upright, this demo page puts part of the overlay off the left edge, so send the touches
	// straight to the boxes instead of aiming at the screen.
	const forwardCentre = () => page.evaluate(() => {
		const box = document.getElementById('touchFwd').getBoundingClientRect();
		return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2).id;
	});
	assert.ok(await touchDrawn(page), 'drawn upright');
	await page.locator('#touchHide').dispatchEvent('touchstart');
	assert.ok(!await touchDrawn(page), 'no longer drawn');
	assert.ok(await touchLive(page), 'still there');
	assert.strictEqual(await forwardCentre(), 'touchFwd', 'still catching touches');
	await page.locator('#touchShow').dispatchEvent('touchstart');
	assert.ok(await touchDrawn(page), 'drawn again');
	await page.close();
});

test('sideways, the Show label draws the invisible touch buttons and Hide puts them away again', async () => {
	const { page } = await openDemo('?type=1&seed=5', null, { hasTouch: true, viewport: iPadSizes.landscape });
	assert.ok(!await touchDrawn(page), 'invisible to start with');
	// The label sits over the invisible Hide box, so the tap has to reach Show.
	await page.locator('#touchShow').tap();
	assert.ok(await touchDrawn(page), 'drawn after Show');
	await page.locator('#touchHide').tap();
	assert.ok(!await touchDrawn(page), 'invisible after Hide');
	assert.ok((await pointId(page, middle.x, middle.y)).startsWith('touch'), 'still catching touches');
	await page.close();
});

/*
A quick tap on a touch button can start and end between two of the game's ten-times-a-second
looks at the buttons. It used to be lost, which felt like the screen ignoring light taps.
*/
const movesNow = async page => Number((await page.locator('#moves').textContent()).match(/\d+/)[0]);

test('a tap on a touch button that ends before the next look still counts once', async () => {
	const { page } = await openDemo('?type=1&seed=5', null, { hasTouch: true });
	const before = await movesNow(page);
	// Press and let go inside one browser turn, so the game never sees the button held.
	await page.evaluate(() => {
		const target = document.getElementById('touchRight');
		const box = target.getBoundingClientRect();
		const point = new Touch({ identifier: 1, target, clientX: box.left + 5, clientY: box.top + 5 });
		target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true,
			touches: [point], targetTouches: [point], changedTouches: [point] }));
		target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true,
			touches: [], targetTouches: [], changedTouches: [point] }));
	});
	await page.waitForFunction(n => Number(document.querySelector('#moves').textContent.match(/\d+/)[0]) > n, before);
	// One tap is one turn: wait out the turn and check nothing more happens.
	await page.waitForTimeout(2500);
	assert.strictEqual(await movesNow(page), before + 1, 'exactly one turn');
	await page.close();
});

test('a cancelled touch is not counted as a tap', async () => {
	const { page } = await openDemo('?type=1&seed=5', null, { hasTouch: true });
	const before = await movesNow(page);
	await page.evaluate(() => {
		const target = document.getElementById('touchRight');
		const box = target.getBoundingClientRect();
		const point = new Touch({ identifier: 1, target, clientX: box.left + 5, clientY: box.top + 5 });
		target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true,
			touches: [point], targetTouches: [point], changedTouches: [point] }));
		target.dispatchEvent(new TouchEvent('touchcancel', { bubbles: true, cancelable: true,
			touches: [], targetTouches: [], changedTouches: [point] }));
	});
	await page.waitForTimeout(2500);
	assert.strictEqual(await movesNow(page), before, 'no turn');
	await page.close();
});

test('the game can clear itself away when no menu callback was given', async () => {
	const { page, errors } = await openDemo('', gameScript(1, 5, 11));
	await page.evaluate(() => game.mazehtml.removeGameUi({state: 'win'}));
	assert.deepStrictEqual(errors, []);
	assert.strictEqual(await page.locator('#maze').count(), 0, 'the game UI is gone');
	await page.close();
});

// A tenth of a second of silence as a WAV file, so a test can load real sounds.
function silentWav() {
	const samples = 800;
	const buffer = Buffer.alloc(44 + samples);
	buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + samples, 4); buffer.write('WAVE', 8);
	buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
	buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(8000, 28); buffer.writeUInt16LE(1, 32); buffer.writeUInt16LE(8, 34);
	buffer.write('data', 36); buffer.writeUInt32LE(samples, 40); buffer.fill(128, 44);
	return `data:audio/wav;base64,${buffer.toString('base64')}`;
}

/*
Browsers refuse to start sound before the player has clicked or pressed a key. play() reports
that by rejecting its promise, which try/catch cannot see, so it showed up as an uncaught error.
*/
test('music that the browser will not autoplay does not raise an error', async () => {
	const script = `setAudioState(true);\n${gameScript(1, 5, 11)}`
		.replace("mazehtml.generateGameUi", `mazehtml.loadClip({url: '${silentWav()}', tags: ['maze']});\n\t\tmazehtml.generateGameUi`);
	const { page, errors } = await openDemo('', script);
	await page.waitForTimeout(500);
	assert.deepStrictEqual(errors, []);
	assert.strictEqual(await page.evaluate(() => currentmusic.paused), true, 'the browser held the music back');
	// The first key press counts as the player interacting, so the music can start now.
	await page.keyboard.press('Shift');
	await page.waitForFunction(() => !currentmusic.paused);
	assert.deepStrictEqual(errors, []);
	await page.close();
});

/*
Press keys in the real game and check it records exactly what the rules say, so a server
replaying the recording gets the same result. `keys` is a string of actions (F B L R U D);
bumps are pressed too, and must not be recorded.
*/
const pressFor = {F: 'ArrowUp', B: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight', U: 'PageUp', D: 'PageDown'};
async function playKeys(page, keys) {
	const idle = () => page.waitForFunction(() => !game.mazehtml.isBusy(), null, {polling: 10});
	for (const key of keys) {
		await idle();
		const before = await page.evaluate(() => game.mazehtml.player.moves);
		await page.keyboard.down(pressFor[key]);
		// Hold the key until the game takes it, or briefly for a bump.
		await page.waitForFunction(n => game.mazehtml.isBusy() || game.mazehtml.player.moves != n, before, {polling: 10, timeout: 300}).catch(() => {});
		await page.keyboard.up(pressFor[key]);
		if (await page.evaluate(() => game.mazehtml.player.won)) break;
	}
	// After a win the game stays busy until it clears itself away.
	if (!await page.evaluate(() => game.mazehtml.player.won)) await idle();
	return page.evaluate(() => ({actions: game.mazehtml.player.actions, times: game.mazehtml.player.times, won: game.mazehtml.player.won,
		shown: document.querySelector('#moves').textContent}));
}

test('the game records every move, and the recording replays to the same result', async () => {
	const { solve, load } = require('../../tools/check_mazes_lib.js');
	const ctx = load(root);
	const [type, seed] = [1, 202601015];
	const [, maze] = vm.runInContext(`build(${type}, ${seed})`, ctx);
	const player = new (vm.runInContext('MazePlayer', ctx))(maze);
	// Wander about: turns, bumps into walls and locked doors, backing into the way in.
	let wander = '', n = 7;
	for (let i = 0; i < 40; ++i) { n = (n * 48271) % 2147483647; wander += 'FFFBLRUD'[n % 8]; }
	for (const key of wander) player.act(key);

	const { page, errors } = await openDemo('', gameScript(type, seed, 11));
	const wandered = await playKeys(page, wander);
	assert.strictEqual(wandered.actions, player.actions, 'the page recorded what the rules allow');
	assert.strictEqual(wandered.shown, `Moves: ${player.moves}`);
	await page.close();

	// A full game from the start: the page wins, and the server-side replay agrees.
	const solution = solve(maze);
	const { page: page2 } = await openDemo('', gameScript(type, seed, 11));
	const won = await playKeys(page2, solution);
	assert.strictEqual(won.won, true);
	assert.strictEqual(won.actions, solution);
	assert.strictEqual(won.times.length, solution.length, 'every move has a time');
	assert.ok(won.times.every((t, i) => i == 0 || t >= won.times[i - 1]), 'times only go forward');
	const replay = vm.runInContext('replayGame', ctx)(maze, won.actions);
	assert.strictEqual(replay.valid, true);
	assert.strictEqual(replay.moves, solution.length);
	assert.deepStrictEqual(errors, []);
	await page2.close();
});

/*
Plain doors need no key. The UI only made door styles for keys lying in the maze, and no cell
holds key 1, so drawing a plain door used to crash. Play a full game through plain doors.
*/
test('a maze with plain doors draws, and a game through them wins', async () => {
	const { solve, load } = require('../../tools/check_mazes_lib.js');
	const ctx = load(root);
	const [type, seed, plainDoors] = [1, 3, 1000];
	const [, maze] = vm.runInContext(`build(${type}, ${seed})`, ctx);
	maze.generatePlainDoors(plainDoors);
	const solution = solve(maze);

	const { page, errors } = await openDemo('', gameScript(type, seed, 11, plainDoors));
	assert.deepStrictEqual(errors, []);
	assert.ok(await page.locator('.door_1').count() > 0, 'plain doors were drawn');
	const won = await playKeys(page, solution);
	assert.strictEqual(won.won, true);
	assert.strictEqual(won.actions, solution);
	assert.deepStrictEqual(errors, []);
	await page.close();
});

// A game with several wall, floor and door images loaded, to see how they are spread over the maze.
function lookScript(type, seed, floorImages, ceilingImages = 0) {
	return `
		const params = new MazeParameters(${type}, ${seed});
		const maze = new Maze(params.mazeSeed, params.floors, params.columns, params.rows,
			params.doorTypes, params.entrances, params.oneWayWalls);
		const mazehtml = new MazeHtml(params.htmlSeed, maze);
		for (const n of ['w1', 'w2', 'w3']) mazehtml.loadWall({name: n, css: 'background: gray;', tags: ['wall']});
		for (let i = 0; i < ${floorImages}; ++i) mazehtml.loadWall({name: 'f' + i, css: 'background: tan;', tags: ['floor']});
		for (let i = 0; i < ${ceilingImages}; ++i) mazehtml.loadWall({name: 'c' + i, css: 'background: silver;', tags: ['ceiling']});
		for (const c of ['red', 'blue', 'green']) mazehtml.loadDoor({css: 'background: ' + c + ';', tags: ['split']});
		for (let i = 0; i < 24; ++i) {
			mazehtml.loadItem({name: 'Key ' + i, initials: 'K' + i, src: '', invsrc: '', css: '', tags: ['key'], doorcolor: '#FF0000'});
		}
		mazehtml.generateGameUi('gamewindow');
		maze.generateMaze();
		maze.generateDoors();
		mazehtml.playGame();
		window.game = {maze, mazehtml};
	`;
}

// Classes of every cell face and floor tile, as one string per kind, to compare between page loads.
async function looks(page) {
	return page.evaluate(() => ({
		walls: [...document.querySelectorAll('.tile')].map(e => [...e.classList].filter(c => c.startsWith('wall_')).join()).join(';'),
		ceilings: [...document.querySelectorAll('.ceiling:not(.outside)')].map(e => [...e.classList].filter(c => c.startsWith('ceiling_')).join()).join(';'),
		floors: [...document.querySelectorAll('.floor:not(.outside)')].map(e => [...e.classList].filter(c => c.startsWith('floor_')).join()).join(';'),
	}));
}

test('walls and floors vary within a maze, and look the same when it is reloaded', async () => {
	const first = await openDemo('', lookScript(1, 11, 3, 3));
	assert.deepStrictEqual(first.errors, []);
	const a = await looks(first.page);
	const used = text => new Set(text.split(';').flatMap(x => x.split(',')).filter(Boolean));
	assert.ok(used(a.walls).size > 1, 'more than one wall image is used');
	assert.ok(used(a.floors).size > 1, 'more than one floor image is used');
	assert.ok(used(a.ceilings).size > 1, 'more than one ceiling image is used');
	const second = await openDemo('', lookScript(1, 11, 3, 3));
	assert.deepStrictEqual(await looks(second.page), a);
});

test('walls and floors come in loaded pairs, and a cell never mixes them up', async () => {
	// Three floor images, but only these pairs are allowed (the second wall goes with two floors).
	const pairs = [['w1', 'f0'], ['w2', 'f1'], ['w2', 'f2']];
	const script = lookScript(1, 11, 3).replace('mazehtml.generateGameUi', `
		for (const [wall, floor] of ${JSON.stringify(pairs)}) mazehtml.loadLook({wall, floor});
		mazehtml.generateGameUi`);
	const { page, errors } = await openDemo('', script);
	assert.deepStrictEqual(errors, []);
	// For each cell, its floor tile and its wall tiles must come from one of the pairs.
	const seen = await page.evaluate(() => {
		const found = new Set();
		const {maze, mazehtml} = game;
		for (let f = 0; f < maze.floors; ++f) for (let r = 0; r < maze.rows; ++r) for (let c = 0; c < maze.columns; ++c) {
			found.add(mazehtml.wallTile(f, r, c) + ' ' + mazehtml.floorTile(f, r, c));
		}
		return [...found];
	});
	const allowed = pairs.map(([w, f]) => `wall_${w} floor_${f}`);
	assert.ok(seen.length > 1, 'more than one pair is used');
	for (const look of seen) assert.ok(allowed.includes(look), look);
	// And the cells the page drew carry the pair classes.
	const drawn = await looks(page);
	assert.ok(drawn.walls.includes('wall_w'));
	assert.ok(drawn.floors.includes('floor_f'));
	await page.close();
});

test('only ground near the player carries its image, and the range can be changed', async () => {
	const near = (script, range) => script.replace('mazehtml.playGame();', `${range === undefined ? '' : `mazehtml.textureRange = ${range};`} mazehtml.playGame();`);
	// For every floor tile in view, its distance in cells from the start and whether it dropped its image.
	const tiles = page => page.evaluate(() => {
		const {maze} = game, [f, r, c] = maze.entranceList[0].cell.loc, out = [];
		for (let y = 0; y < maze.rows; ++y) for (let x = 0; x < maze.columns; ++x) {
			const html = maze.grid[f][y][x].html;
			if (html.floor.css('display') == 'none') continue;
			out.push({d: Math.max(Math.abs(x - c), Math.abs(y - r)), far: html.floor.hasClass('far') && html.ceiling.hasClass('far')});
		}
		return out;
	});
	const first = await openDemo('', near(lookScript(1, 11, 3, 3)));
	assert.deepStrictEqual(first.errors, []);
	const a = await tiles(first.page);
	assert.ok(a.some(t => t.d <= 1) && a.some(t => t.d > 1), 'the view has near and far ground');
	for (const t of a) assert.strictEqual(t.far, t.d > 1, `ground ${t.d} cells away`);
	await first.page.close();
	// A range of 99 textures everything in view.
	const all = await openDemo('', near(lookScript(1, 11, 3, 3), 99));
	assert.ok((await tiles(all.page)).every(t => !t.far));
	await all.page.close();
});

test('only cells you can see through openings are drawn', async () => {
	const { page, errors } = await openDemo('', lookScript(1, 11, 3, 3));
	assert.deepStrictEqual(errors, []);
	const drawn = await page.evaluate(() => {
		const {maze} = game, [f] = maze.entranceList[0].cell.loc;
		const shown = el => el.css('display') != 'none';
		let cells = 0, layers = 0, total = maze.rows * maze.columns * 6;
		for (let y = 0; y < maze.rows; ++y) for (let x = 0; x < maze.columns; ++x) {
			const html = maze.grid[f][y][x].html;
			if (shown(html.floor)) ++cells;
			layers += Object.values(html).filter(shown).length;
		}
		return {cells, layers, total, all: maze.rows * maze.columns};
	});
	assert.ok(drawn.cells > 0, 'something is drawn');
	assert.ok(drawn.cells < drawn.all / 2, `${drawn.cells} of ${drawn.all} cells drawn`);
	assert.ok(drawn.layers < drawn.total / 2, `${drawn.layers} of ${drawn.total} layers drawn`);
	await page.close();
});

test('with no floor or ceiling images they keep their plain colour', async () => {
	const { page, errors } = await openDemo('', lookScript(1, 11, 0));
	assert.deepStrictEqual(errors, []);
	assert.deepStrictEqual((await looks(page)).floors.replaceAll(';', ''), '');
	assert.deepStrictEqual((await looks(page)).ceilings.replaceAll(';', ''), '');
	assert.ok(await page.locator('.floor').count() > 0);
});

test('every lock gets a different door look while there are looks left', async () => {
	const { page, errors } = await openDemo('', lookScript(3, 3, 1));
	assert.deepStrictEqual(errors, []);
	// Each lock number has a css rule named door_<lock>; read the background of each.
	const colours = await page.evaluate(() => Object.entries(game.mazehtml.cssRules)
		.filter(([name]) => /^door_\d+$/.test(name)).map(([, rule]) => rule.style.backgroundColor));
	assert.ok(colours.length >= 3, 'the maze has at least three locks');
	assert.strictEqual(new Set(colours.slice(0, 3)).size, 3, 'the first three locks use the three door looks');
});

/*
Slow motion. The animations get longer by 1 / speed, speed never goes above 1 (the server counts
moves quicker than the usual animations as impossible), and the default pace does not change.
*/
const durations = page => page.evaluate(() => ['#mazeRotate', '#mazeTranslate'].map(id =>
	getComputedStyle(document.querySelector(id)).transitionDuration));

test('animation speed stretches the animations, and the default pace is unchanged', async () => {
	const { page, errors } = await openDemo('', gameScript(1, 5, 11));
	assert.deepStrictEqual(await durations(page), ['0.5s', '0.5s'], 'normal pace before any setting');

	await page.evaluate(() => game.mazehtml.setAnimationSpeed(0.5));
	assert.deepStrictEqual(await durations(page), ['1s', '1s'], 'half speed takes twice as long');
	// Time a real turn: at normal pace it takes about 500 ms, at half speed about 1000 ms.
	const timeTurn = async () => {
		const start = Date.now();
		await page.keyboard.down('ArrowLeft');
		await page.waitForFunction(() => game.mazehtml.isBusy(), null, {polling: 10});
		await page.keyboard.up('ArrowLeft');
		await page.waitForFunction(() => !game.mazehtml.isBusy(), null, {polling: 10});
		return Date.now() - start;
	};
	assert.ok(await timeTurn() >= 900, 'a turn at half speed lasts about a second');

	await page.evaluate(() => game.mazehtml.setAnimationSpeed(1));
	assert.deepStrictEqual(await durations(page), ['0.5s', '0.5s'], 'back to normal');
	assert.ok(await timeTurn() < 800, 'a turn at normal speed is quicker');
	assert.deepStrictEqual(errors, []);
	await page.close();
});

test('animation speed is kept between a quarter and normal pace, and junk means normal', async () => {
	const { page } = await openDemo('', gameScript(1, 5, 11));
	const factor = async speed => page.evaluate(s => { game.mazehtml.setAnimationSpeed(s); return game.mazehtml.slowFactor; }, speed);
	assert.strictEqual(await factor(0.25), 4);
	assert.strictEqual(await factor(0.01), 4, 'slower than a quarter is held at a quarter');
	assert.strictEqual(await factor(3), 1, 'faster than normal is held at normal');
	assert.strictEqual(await factor('abc'), 1);
	assert.strictEqual(await factor(undefined), 1);
	await page.close();
});

/*
High contrast mode. The look itself is css, so these tests read computed styles in a real browser:
walls lose their picture and turn solid, and every key shares one color-and-pattern look with its door.
*/
test('high contrast turns walls solid and back again', async () => {
	const { page, errors } = await openDemo('', gameScript(1, 5, 11));
	const wall = () => page.evaluate(() => {
		const style = getComputedStyle(document.querySelector('.tile[class*="wall_"]'));
		return {image: style.backgroundImage, color: style.backgroundColor};
	});
	// gameScript's wall is `background: gray`, so it has no picture; give it one to prove the mode removes it.
	await page.evaluate(() => {
		for (const rule of game.mazehtml.styleSheet.cssRules) {
			if (rule.selectorText && rule.selectorText.startsWith('.wall_')) rule.style.backgroundImage = 'linear-gradient(red, blue)';
		}
	});
	assert.match((await wall()).image, /gradient/, 'the normal look has a picture');
	await page.evaluate(() => game.mazehtml.setHighContrast(true));
	assert.strictEqual(await page.evaluate(() => document.documentElement.classList.contains('highContrast')), true);
	assert.deepStrictEqual(await wall(), {image: 'none', color: 'rgb(0, 0, 0)'}, 'walls are solid black');
	const floor = await page.evaluate(() => getComputedStyle(document.querySelector('.floor:not(.outside)')).backgroundColor);
	assert.strictEqual(floor, 'rgb(255, 255, 255)', 'floors are solid white');
	await page.evaluate(() => game.mazehtml.setHighContrast(false));
	assert.match((await wall()).image, /gradient/, 'turning it off brings the picture back');
	assert.deepStrictEqual(errors, []);
	await page.close();
});

test('high contrast gives each lock its own color and pattern, shared by door and key', async () => {
	const { page, errors } = await openDemo('', gameScript(3, 3, 19));
	await page.evaluate(() => game.mazehtml.setHighContrast(true));
	// The maze draws only some of its doors and keys on the floor shown, so read what is there.
	const found = await page.evaluate(() => {
		const look = style => `${style.backgroundColor}|${style.backgroundImage}`;
		const doors = {}, keys = {};
		for (const door of document.querySelectorAll('.door')) {
			doors[door.className.match(/door_(\d+)/)[1]] = look(getComputedStyle(door));
		}
		for (const key of document.querySelectorAll('.item.key')) {
			keys[key.className.match(/key_(\d+)/)[1]] = look(getComputedStyle(key, '::after'));
		}
		return {doors, keys};
	});
	const locks = {...found.doors, ...found.keys};
	assert.ok(Object.keys(locks).length > 3, `the maze shows several locks (${Object.keys(locks).length})`);
	for (const lock of Object.keys(found.doors).filter(n => n in found.keys)) {
		assert.strictEqual(found.doors[lock], found.keys[lock], `lock ${lock}: door and key disc match`);
	}
	for (const look of Object.values(locks)) {
		assert.notStrictEqual(look.split('|')[0], 'rgba(0, 0, 0, 0)', 'every lock has a color');
	}
	// Color or pattern tells locks apart: no two locks share both.
	assert.strictEqual(new Set(Object.values(locks)).size, Object.keys(locks).length, 'every lock looks different');
	// The look table itself: 20 locks all differ, and the 21st reuses the first.
	const table = await page.evaluate(() => Array.from({length: 21}, (_, i) => { const l = highContrastLook(i + 2); return `${l.color}|${l.image}`; }));
	assert.strictEqual(new Set(table.slice(0, 20)).size, 20);
	assert.strictEqual(table[20], table[0]);
	assert.deepStrictEqual(errors, []);
	await page.close();
});

test('high contrast key letters show on the key and a keyless door stays plain', async () => {
	const { page } = await openDemo('', gameScript(3, 3, 19, 4));
	await page.evaluate(() => game.mazehtml.setHighContrast(true));
	const info = await page.evaluate(() => {
		const key = document.querySelector('.item.key');
		const plain = document.querySelector('.door_1');
		return {letters: getComputedStyle(key, '::after').content, label: key.dataset.initials, plain: plain && getComputedStyle(plain).backgroundImage};
	});
	assert.strictEqual(info.letters, `"${info.label}"`, 'the key shows its letters');
	assert.strictEqual(info.plain, 'none', 'a plain door has no pattern');
	await page.close();
});

test('high contrast redraws the map in black and white', async () => {
	const { page } = await openDemo('', gameScript(1, 5, 11));
	const cell = () => page.evaluate(() => {
		const visited = game.maze.cellList.find(c => c.play.visited);
		return getComputedStyle(visited.map[0]).backgroundColor;
	});
	assert.strictEqual(await cell(), 'rgb(255, 255, 255)');
	await page.evaluate(() => game.mazehtml.setHighContrast(true));
	assert.strictEqual(await cell(), 'rgb(0, 0, 0)');
	await page.evaluate(() => game.mazehtml.setHighContrast(false));
	assert.strictEqual(await cell(), 'rgb(255, 255, 255)');
	await page.close();
});

/*
A touch button is drawn only when pressing it would do something. Left and right always
work. A hidden button still catches taps (it only stops being drawn), so a tap on a wall
bumps as before.
*/
test('touch buttons for moves that would only bump are hidden, and come back when the move works', async () => {
	const { page } = await openDemo('', gameScript(1, 2, 4), { hasTouch: true, viewport: iPadSizes.portrait });
	const drawn = id => page.evaluate(id => getComputedStyle(document.getElementById(id)).opacity == '1', id);
	const shown = async () => ({
		fwd: await drawn('touchFwd'), back: await drawn('touchBack'), left: await drawn('touchLeft'),
		right: await drawn('touchRight'), up: await drawn('touchUp'), down: await drawn('touchDown'),
	});
	// What the rules say, for comparison: the buttons must match canAct for every move.
	const rules = () => page.evaluate(() => {
		const p = game.mazehtml.player;
		return { fwd: p.canAct('F'), back: p.canAct('B'), left: true, right: true, up: p.canAct('U'), down: p.canAct('D') };
	});
	const idle = () => page.waitForFunction(() => !game.mazehtml.isBusy());
	await idle();
	let state = await shown();
	assert.deepStrictEqual(state, await rules(), 'at the start');
	assert.ok(state.fwd && state.left && state.right, 'forward and the turns show');
	assert.ok(!state.back, 'the way in is shut, so Back is hidden');
	// Turn until Forward would bump a wall (this maze's start cell has walls east and west), then the Forward box must go.
	let turns = 0;
	while (await page.evaluate(() => game.mazehtml.player.canAct('F')) && turns++ < 8) {
		// One quick tap on the Left box turns exactly once (a held key could turn twice).
		await page.locator('#touchLeft').dispatchEvent('touchstart');
		await page.locator('#touchLeft').dispatchEvent('touchend');
		await page.waitForFunction(n => game.mazehtml.player.moves >= n, turns);
		await idle();
		assert.deepStrictEqual(await shown(), await rules(), `after ${turns} turn(s)`);
	}
	assert.ok(turns > 0 && turns <= 8, 'found a wall to face');
	assert.ok(!(await shown()).fwd, 'Forward is hidden facing a wall');
	assert.ok((await shown()).left, 'Left is still shown');
	assert.ok(await page.locator('#touchFwd').isVisible(), 'the hidden box is still there to catch taps');
	await page.close();
});

/*
Swipes. A finger on the touch buttons is read as a tap or a swipe according to the touch
style: 'taps' (the default, acts at once), 'swipes' (only swipes act) or 'both' (a tap acts as
the finger lifts, a swipe as soon as it is clear, a finger held still walks). To see which
action each gesture asks for without waiting on animations, the tests swap the rules'
act() and canAct() for spies; `log` is every action the game then asked for.
*/
async function swipeGame(options = {}) {
	const { page } = await openDemo('', gameScript(1, 5, 4), { hasTouch: true, viewport: iPadSizes.landscape });
	await page.evaluate(opts => {
		const mazehtml = game.mazehtml;
		if (opts.style) mazehtml.setTouchStyle(opts.style);
		if (opts.direction) mazehtml.setSwipeDirection(opts.direction);
		if (opts.side) mazehtml.setScrollSide(opts.side);
		window.log = [];
		window.blocked = new Set();
		const player = mazehtml.player;
		player.canAct = action => !window.blocked.has(action);
		player.act = action => { window.log.push(action); return null; };
	}, options);
	return page;
}

// Fire one touch event at a box, `dx`/`dy` pixels from its middle. Returns true when the page
// called preventDefault (which is how a touch is kept from scrolling the page).
const touchAt = (page, id, type, dx = 0, dy = 0, identifier = 1) => page.evaluate(([id, type, dx, dy, identifier]) => {
	const target = document.getElementById(id);
	const box = target.getBoundingClientRect();
	const point = new Touch({ identifier, target, clientX: box.left + box.width / 2 + dx, clientY: box.top + box.height / 2 + dy });
	const touches = type == 'touchend' || type == 'touchcancel' ? [] : [point];
	const event = new TouchEvent(type, { bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: [point] });
	target.dispatchEvent(event);
	return event.defaultPrevented;
}, [id, type, dx, dy, identifier]);
// Swipe: touch down, move to (dx, dy), lift.
async function swipe(page, id, dx, dy, { hold = 0 } = {}) {
	await touchAt(page, id, 'touchstart');
	await touchAt(page, id, 'touchmove', dx / 2, dy / 2);
	await touchAt(page, id, 'touchmove', dx, dy);
	if (hold) await page.waitForTimeout(hold);
	await touchAt(page, id, 'touchend', dx, dy);
}
const actions = async page => {
	// The game looks at the buttons ten times a second, so give it a few looks.
	await page.waitForTimeout(450);
	return page.evaluate(() => window.log);
};
const firstActions = async page => [...new Set(await actions(page))];
const FAR = 120;

test('taps: a touch acts at once, and a swipe is nothing special', async () => {
	const page = await swipeGame();
	await touchAt(page, 'touchRight', 'touchstart');
	assert.deepStrictEqual(await firstActions(page), ['R'], 'acted before the finger lifted');
	await touchAt(page, 'touchRight', 'touchend');
	await page.close();
});

test('swipes only: taps are ignored; a swipe in the middle turns, walks forward and walks back', async () => {
	const page = await swipeGame({ style: 'swipes' });
	await touchAt(page, 'touchRight', 'touchstart');
	await touchAt(page, 'touchRight', 'touchend');
	await touchAt(page, 'touchFwd', 'touchstart');
	await page.waitForTimeout(400);
	await touchAt(page, 'touchFwd', 'touchend');
	assert.deepStrictEqual(await actions(page), [], 'taps and a still hold do nothing');
	const cases = [['left', -FAR, 0, 'L'], ['right', FAR, 0, 'R'], ['up', 0, -FAR, 'F'], ['down', 0, FAR, 'B']];
	for (const [name, dx, dy, action] of cases) {
		await page.evaluate(() => { window.log = []; });
		await swipe(page, 'touchFwd', dx, dy);
		assert.deepStrictEqual(await firstActions(page), [action], `swipe ${name}`);
	}
	await page.close();
});

test('swipes: a swipe keeps walking while the finger stays down, and stops when it lifts', async () => {
	const page = await swipeGame({ style: 'swipes' });
	await touchAt(page, 'touchFwd', 'touchstart');
	await touchAt(page, 'touchFwd', 'touchmove', 0, -FAR);
	await page.waitForTimeout(550);
	const walking = await page.evaluate(() => window.log.length);
	assert.ok(walking >= 3, `kept walking (${walking} steps)`);
	await touchAt(page, 'touchFwd', 'touchend', 0, -FAR);
	await page.waitForTimeout(300);
	const after = await page.evaluate(() => window.log.length);
	await page.waitForTimeout(500);
	assert.strictEqual(await page.evaluate(() => window.log.length), after, 'quiet after the lift');
	await page.close();
});

test('swipes: the Point and Drag directions are opposites', async () => {
	const cases = [[-FAR, 0], [FAR, 0], [0, -FAR], [0, FAR]];
	const point = { '-120,0': 'L', '120,0': 'R', '0,-120': 'F', '0,120': 'B' };
	const drag = { '-120,0': 'R', '120,0': 'L', '0,-120': 'B', '0,120': 'F' };
	for (const [direction, expected] of [['point', point], ['drag', drag]]) {
		const page = await swipeGame({ style: 'swipes', direction });
		for (const [dx, dy] of cases) {
			await page.evaluate(() => { window.log = []; });
			await swipe(page, 'touchFwd', dx, dy);
			assert.deepStrictEqual(await firstActions(page), [expected[`${dx},${dy}`]], `${direction} ${dx},${dy}`);
		}
		await page.close();
	}
});

test('swipes: a blocked or crooked swipe does nothing', async () => {
	const page = await swipeGame({ style: 'swipes' });
	await page.evaluate(() => window.blocked.add('F'));
	await swipe(page, 'touchFwd', 0, -FAR);
	assert.deepStrictEqual(await actions(page), [], 'forward into a wall');
	await swipe(page, 'touchFwd', FAR, -FAR);
	assert.deepStrictEqual(await actions(page), [], 'a diagonal is ambiguous');
	await swipe(page, 'touchFwd', 15, -15);
	assert.deepStrictEqual(await actions(page), [], 'too short');
	// And what is not blocked still works afterwards.
	await swipe(page, 'touchFwd', FAR, 0);
	assert.deepStrictEqual(await firstActions(page), ['R']);
	await page.close();
});

test('swipes: a vertical swipe on a side strip climbs, in Drag it flips, and it is blocked without a ladder', async () => {
	// Landscape: no page scrolling, so both strips climb.
	for (const strip of ['touchLeft', 'touchRight']) {
		const page = await swipeGame({ style: 'swipes' });
		await swipe(page, strip, 0, -FAR);
		assert.deepStrictEqual(await firstActions(page), ['U'], `${strip} up`);
		await page.evaluate(() => { window.log = []; });
		await swipe(page, strip, 0, FAR);
		assert.deepStrictEqual(await firstActions(page), ['D'], `${strip} down`);
		await page.evaluate(() => { window.log = []; window.blocked.add('U'); });
		await swipe(page, strip, 0, -FAR);
		assert.deepStrictEqual(await actions(page), [], `${strip}: no ladder up`);
		await page.evaluate(() => { window.log = []; });
		await swipe(page, strip, FAR, 0);
		assert.deepStrictEqual(await actions(page), [], `${strip}: a sideways swipe on a strip is nothing`);
		await page.close();
	}
	const dragging = await swipeGame({ style: 'swipes', direction: 'drag' });
	await swipe(dragging, 'touchLeft', 0, FAR);
	assert.deepStrictEqual(await firstActions(dragging), ['U'], 'dragging down climbs up');
	await dragging.close();
});

test('taps and swipes: a tap acts as the finger lifts, a held finger walks, a swipe acts', async () => {
	const page = await swipeGame({ style: 'both' });
	await touchAt(page, 'touchRight', 'touchstart');
	await page.waitForTimeout(150);
	assert.deepStrictEqual(await page.evaluate(() => window.log), [], 'nothing before the lift');
	await touchAt(page, 'touchRight', 'touchend');
	assert.deepStrictEqual(await firstActions(page), ['R'], 'acted on lift');
	// Held still past the hold time: walks until the lift.
	await page.evaluate(() => { window.log = []; });
	await touchAt(page, 'touchFwd', 'touchstart');
	await page.waitForTimeout(900);
	const held = await page.evaluate(() => window.log.length);
	assert.ok(held >= 3, `held finger kept walking (${held})`);
	await touchAt(page, 'touchFwd', 'touchend');
	await page.waitForTimeout(300);
	const after = await page.evaluate(() => window.log.length);
	await page.waitForTimeout(400);
	assert.strictEqual(await page.evaluate(() => window.log.length), after, 'stopped on lift');
	assert.ok(after <= held + 2, 'a held finger does not also tap on lift');
	// A swipe still acts, once, and a cancelled touch is nothing.
	await page.evaluate(() => { window.log = []; });
	await swipe(page, 'touchFwd', -FAR, 0);
	assert.deepStrictEqual(await firstActions(page), ['L']);
	await page.evaluate(() => { window.log = []; });
	await touchAt(page, 'touchLeft', 'touchstart');
	await touchAt(page, 'touchLeft', 'touchcancel');
	assert.deepStrictEqual(await actions(page), [], 'cancel is not a tap');
	await page.close();
});

/*
The page-scroll strip. With the map below the maze (a narrow or tall window) the page can
scroll, so one side strip is left to the browser for it: the player picks the side. Its
taps act as the Left/Right turn but on lift, the browser owns its vertical drags, and the
other strip climbs ladders by swipe, in every touch style.
*/
const touchAction = (page, id) => page.evaluate(id => getComputedStyle(document.getElementById(id)).touchAction, id);

test('with the map below the maze one side strip scrolls the page, and the player picks which', async () => {
	const { page } = await openDemo('', gameScript(1, 5, 4), { hasTouch: true, viewport: iPadSizes.portrait });
	assert.strictEqual(await touchAction(page, 'touchRight'), 'pan-y', 'the right strip scrolls by default');
	assert.strictEqual(await touchAction(page, 'touchLeft'), 'none');
	assert.strictEqual(await touchAction(page, 'touchFwd'), 'none');
	await page.evaluate(() => game.mazehtml.setScrollSide('left'));
	assert.strictEqual(await touchAction(page, 'touchLeft'), 'pan-y');
	assert.strictEqual(await touchAction(page, 'touchRight'), 'none');
	await page.close();
});

test('with the map beside the maze nothing scrolls, so neither strip is left to the browser', async () => {
	const { page } = await openDemo('?type=1&seed=5', null, { hasTouch: true, viewport: iPadSizes.landscape });
	assert.strictEqual(await touchAction(page, 'touchRight'), 'none');
	assert.strictEqual(await touchAction(page, 'touchLeft'), 'none');
	await page.close();
});

for (const style of ['taps', 'both']) {
	test(`scroll strip (${style}): the browser may scroll under it; a tap acts on lift; the other strip climbs`, async () => {
		const page = await swipeGame({ style });
		// swipeGame uses landscape; the strips only scroll with the map below the maze.
		await page.setViewportSize(iPadSizes.portrait);
		await page.evaluate(() => game.mazehtml.setScrollSide('right'));
		assert.strictEqual(await touchAt(page, 'touchRight', 'touchstart'), false, 'touchstart is not cancelled, so the page can scroll');
		await page.waitForTimeout(150);
		assert.deepStrictEqual(await page.evaluate(() => window.log), [], 'a tap waits for the lift');
		await touchAt(page, 'touchRight', 'touchend');
		assert.deepStrictEqual(await firstActions(page), ['R'], 'and then turns');
		// A drag the browser takes as a scroll ends in touchcancel and acts as nothing.
		await page.evaluate(() => { window.log = []; });
		await touchAt(page, 'touchRight', 'touchstart');
		await touchAt(page, 'touchRight', 'touchmove', 0, -FAR);
		await touchAt(page, 'touchRight', 'touchcancel', 0, -FAR);
		assert.deepStrictEqual(await actions(page), [], 'a scroll does not turn or climb');
		// The other strip: touches are kept from scrolling, and a vertical swipe climbs.
		assert.strictEqual(await touchAt(page, 'touchLeft', 'touchstart'), true, 'the other strip stops the page scrolling');
		await touchAt(page, 'touchLeft', 'touchend');
		// That tap turns left at the game's next look (ten a second). Wait for it, or on a slow
		// machine it lands after the log is cleared and is read as part of the swipe below.
		await page.waitForFunction(() => window.log.includes('L'));
		await page.evaluate(() => { window.log = []; });
		if (style == 'both') {
			await swipe(page, 'touchLeft', 0, -FAR);
			assert.deepStrictEqual(await firstActions(page), ['U'], 'ladder swipe on the other strip');
		}
		await page.close();
	});
}

test('scroll strip: swipes never act on it, and in swipes-only style its taps are ignored', async () => {
	const page = await swipeGame({ style: 'swipes' });
	await page.setViewportSize(iPadSizes.portrait);
	await swipe(page, 'touchRight', 0, -FAR);
	await touchAt(page, 'touchRight', 'touchstart');
	await touchAt(page, 'touchRight', 'touchend');
	assert.deepStrictEqual(await actions(page), []);
	await page.close();
});

test('map walls are at least 3px thick, in both the normal and high contrast looks', async () => {
	const { page, errors } = await openDemo('', gameScript(3, 3, 19, 4));
	// Walls were 1px black lines, too thin to see against the grey of unexplored cells.
	// Explore every cell so the map draws all its walls, doors and plain doors.
	const widths = async () => page.evaluate(() => {
		for (const cell of game.maze.cellList) cell.play.visited = true;
		game.mazehtml.renderMap();
		const found = new Set();
		for (const cell of document.querySelectorAll('.mapCell')) {
			const style = getComputedStyle(cell);
			for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
				if (style[`border${side}Style`] !== 'none') found.add(parseFloat(style[`border${side}Width`]));
			}
		}
		return [...found].sort((a, b) => a - b);
	});
	for (const on of [false, true]) {
		await page.evaluate(on => game.mazehtml.setHighContrast(on), on);
		const found = await widths();
		assert.ok(found.length > 0, `the map draws walls (high contrast ${on})`);
		assert.ok(found[0] >= 3, `every wall, door and key door is 3px or more (high contrast ${on}): ${found}`);
	}
	assert.deepStrictEqual(errors, []);
	await page.close();
});

test('dark map option draws the map black and white without turning on high contrast', async () => {
	const { page, errors } = await openDemo('', gameScript(3, 3, 19, 4));
	const look = () => page.evaluate(() => {
		const explored = game.maze.cellList.find(cell => cell.play.visited).map;
		const unexplored = game.maze.cellList.find(cell => !cell.play.visited)?.map;
		const wall = ['Top', 'Right', 'Bottom', 'Left']
			.map(side => getComputedStyle(explored[0])[`border${side}Color`]).find(c => c !== 'rgba(0, 0, 0, 0)');
		return {explored: explored.css('background-color'), unexplored: unexplored ? unexplored.css('background-color') : null, wall,
			darkClass: document.documentElement.classList.contains('darkMap'),
			highContrastClass: document.documentElement.classList.contains('highContrast')};
	});
	const light = await look();
	assert.strictEqual(light.explored, 'rgb(255, 255, 255)');
	assert.strictEqual(light.unexplored, 'rgb(128, 128, 128)');
	await page.evaluate(() => game.mazehtml.setDarkMap(true));
	const dark = await look();
	assert.strictEqual(dark.explored, 'rgb(0, 0, 0)', 'explored cells are black');
	assert.strictEqual(dark.unexplored, 'rgb(68, 68, 68)', 'unexplored cells are dark grey');
	assert.strictEqual(dark.wall, 'rgb(255, 255, 255)', 'walls are white');
	assert.deepStrictEqual([dark.darkClass, dark.highContrastClass], [true, false], 'only the map changes');
	// Doors keep their colors and stay solid: only walls turn white.
	const doors = await page.evaluate(() => {
		for (const cell of game.maze.cellList) cell.play.visited = true;
		game.mazehtml.renderMap();
		const sides = [];
		for (const cell of document.querySelectorAll('.mapCell')) {
			const style = getComputedStyle(cell);
			for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
				if (style[`border${side}Style`] !== 'none') sides.push([style[`border${side}Style`], style[`border${side}Color`]]);
			}
		}
		return sides;
	});
	assert.ok(doors.every(([style]) => style === 'solid'), 'no dashed lines');
	assert.ok(doors.some(([, color]) => color === 'rgb(255, 0, 0)'), 'a keyed door keeps its color');
	assert.ok(doors.some(([, color]) => color === 'rgb(165, 42, 42)'), 'a plain door keeps its brown');
	await page.evaluate(() => game.mazehtml.setDarkMap(false));
	const back = await look();
	assert.strictEqual(back.explored, light.explored, 'turning it off brings the light map back');
	assert.strictEqual(back.darkClass, false);
	assert.deepStrictEqual(errors, []);
	await page.close();
});

/*
Up and Down are thin bands so Forward is the big target. On a cell with no ladder up or down the
hidden band joins Forward: the box grows over it and a touch there lands on Forward.
*/
test('Up and Down are thin, and without a ladder Forward takes over their band', async () => {
	const { page } = await openDemo('', gameScript(1, 2, 4), { hasTouch: true, viewport: iPadSizes.portrait });
	await page.waitForFunction(() => !game.mazehtml.isBusy());
	const boxes = () => page.evaluate(() => {
		const nav = document.getElementById('touchNav');
		const rect = id => document.getElementById(id).getBoundingClientRect();
		const up = rect('touchUp'), down = rect('touchDown'), fwd = rect('touchFwd');
		const at = r => document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).id;
		return {
			navHeight: nav.getBoundingClientRect().height, up: up.height, down: down.height, fwd: fwd.height,
			noUp: nav.classList.contains('noUp'), noDown: nav.classList.contains('noDown'),
			canUp: game.mazehtml.player.canAct('U'), canDown: game.mazehtml.player.canAct('D'),
			atUp: at(up), atDown: at(down),
		};
	});
	const start = await boxes();
	assert.deepStrictEqual([start.noUp, start.noDown], [!start.canUp, !start.canDown], 'the classes follow the rules');
	assert.ok(start.noUp && start.noDown, 'the start cell of this maze has no ladder');
	assert.ok(start.fwd >= 0.84 * start.navHeight, 'Forward covers both empty bands');
	assert.deepStrictEqual([start.atUp, start.atDown], ['touchFwd', 'touchFwd'], 'a touch on an empty band lands on Forward');
	// The sizes on a cell with ladders both ways.
	await page.evaluate(() => document.getElementById('touchNav').classList.remove('noUp', 'noDown'));
	const ladder = await boxes();
	assert.ok(ladder.up <= 0.16 * ladder.navHeight && ladder.down <= 0.16 * ladder.navHeight, 'Up and Down are thin');
	assert.ok(ladder.fwd >= 3 * ladder.up, 'Forward is the big target');
	assert.deepStrictEqual([ladder.atUp, ladder.atDown], ['touchUp', 'touchDown'], 'with a ladder the bands are Up and Down again');
	await page.close();
});

// Press a key long enough for the game to see it (it looks ten times a second), then wait `after` ms.
async function tap(page, key, after = 300) {
	await page.keyboard.down(key);
	await page.waitForTimeout(150);
	await page.keyboard.up(key);
	if (after) await page.waitForTimeout(after);
}

// Counts each time the view starts a bump (the class `bump` goes on).
async function countBumps(page) {
	await page.evaluate(() => {
		window.bumps = 0;
		const view = document.querySelector('#maze .viewport');
		let had = false;
		new MutationObserver(() => {
			const has = view.classList.contains('bump');
			if (has && !had) ++window.bumps;
			had = has;
		}).observe(view, { attributes: true, attributeFilter: ['class'] });
	});
	return () => page.evaluate(() => window.bumps);
}

test('a press that would do nothing bumps once, costs no move, and can be turned off', async () => {
	const { page } = await openDemo('', gameScript(1, 2, 4));
	await page.waitForFunction(() => !game.mazehtml.isBusy());
	const bumps = await countBumps(page);
	// The way in is shut, so Back does nothing here.
	assert.strictEqual(await page.evaluate(() => game.mazehtml.player.canAct('B')), false);
	await page.keyboard.down('ArrowDown');
	await page.waitForTimeout(150);
	const animation = await page.evaluate(() => getComputedStyle(document.querySelector('#maze .viewport')).animationName);
	assert.strictEqual(animation, 'mazeBump', 'the view shakes');
	await page.waitForTimeout(450);
	assert.strictEqual(await bumps(), 1, 'a held key bumps once, not over and over');
	await page.keyboard.up('ArrowDown');
	await tap(page, 'ArrowDown');
	assert.strictEqual(await bumps(), 2, 'pressing again bumps again');
	assert.strictEqual(await page.evaluate(() => game.mazehtml.player.moves), 0, 'a bump costs no move');
	await page.evaluate(() => game.mazehtml.setBumpFeedback(false));
	await tap(page, 'ArrowDown');
	assert.strictEqual(await bumps(), 2, 'turned off, nothing bumps');
	await page.close();
});

test('a clear swipe that the rules refuse bumps; a crooked one does not', async () => {
	const page = await swipeGame({ style: 'swipes' });
	const bumps = await countBumps(page);
	await page.evaluate(() => window.blocked.add('U'));
	await swipe(page, 'touchLeft', 0, -FAR);
	assert.strictEqual(await bumps(), 1, 'a blocked climb bumps');
	// Let that bump finish before the next.
	await page.waitForTimeout(300);
	await swipe(page, 'touchLeft', 0, -FAR);
	assert.strictEqual(await bumps(), 2, 'each blocked swipe bumps');
	await swipe(page, 'touchFwd', FAR, FAR);
	assert.strictEqual(await bumps(), 2, 'a crooked swipe is not read, so it does not bump');
	await page.close();
});

test('Comfort darkens the edges, fades turns, flashes instead of shaking, and keeps the pace', async () => {
	const { page } = await openDemo('', gameScript(1, 2, 4));
	await page.waitForFunction(() => !game.mazehtml.isBusy());
	const layer = () => page.evaluate(() => {
		const el = document.querySelector('#maze .comfortLayer');
		const style = getComputedStyle(el);
		return { image: style.backgroundImage, turning: el.classList.contains('comfortTurn'),
			animation: style.animationName, duration: style.animationDuration, events: style.pointerEvents };
	});
	assert.strictEqual((await layer()).image, 'none', 'off by default: no dark edges');
	assert.strictEqual((await layer()).events, 'none', 'the layer never catches a touch');
	await tap(page, 'ArrowLeft', 0);
	assert.strictEqual((await layer()).turning, false, 'without Comfort a turn sweeps as before');
	await page.waitForFunction(() => !game.mazehtml.isBusy());

	await page.evaluate(() => game.mazehtml.setComfort(true));
	assert.ok(await page.evaluate(() => document.documentElement.classList.contains('mazeComfort')));
	assert.match((await layer()).image, /radial-gradient/, 'dark edges');
	// Turn back the other way, to face the way in again.
	await tap(page, 'ArrowRight', 0);
	const turning = await layer();
	assert.ok(turning.turning, 'the turn fades through dark');
	assert.deepStrictEqual([turning.animation, turning.duration], ['mazeComfortTurn', '0.5s'], 'as long as the turn itself');
	const turnTime = await page.evaluate(() => getComputedStyle(document.getElementById('mazeRotate')).transitionDuration);
	assert.strictEqual(turnTime, '0.5s', 'the turn takes as long as ever');
	await page.waitForFunction(() => !game.mazehtml.isBusy());

	// A bump with Comfort on: no shake, the edges flash. Facing the way it started, Back is shut.
	assert.strictEqual(await page.evaluate(() => game.mazehtml.player.canAct('B')), false);
	await tap(page, 'ArrowDown', 0);
	const bump = await page.evaluate(() => ({
		view: getComputedStyle(document.querySelector('#maze .viewport')).animationName,
		layer: getComputedStyle(document.querySelector('#maze .comfortLayer')).animationName,
	}));
	assert.deepStrictEqual(bump, { view: 'none', layer: 'mazeBumpFlash' });

	await page.evaluate(() => game.mazehtml.setComfort(false));
	assert.strictEqual((await layer()).image, 'none', 'turning it off takes the edges away');
	await page.close();
});

test('Comfort climbs a ladder without the dip, in the same time', async () => {
	const climb = async comfort => {
		const { page } = await openDemo('', gameScript(1, 2, 4));
		await page.waitForFunction(() => !game.mazehtml.isBusy());
		const transition = await page.evaluate(async comfort => {
			const { mazehtml } = game;
			mazehtml.setComfort(comfort);
			// Let the rules allow a climb here, and watch the transition the game sets for it.
			const player = mazehtml.player;
			const realAct = player.act.bind(player);
			player.act = action => action == 'U' ? { type: 'move' } : realAct(action);
			document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
			// The game looks at the keys ten times a second, so hold it for a couple of looks.
			await new Promise(r => setTimeout(r, 250));
			document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'PageUp', bubbles: true }));
			return document.getElementById('mazeTranslate').style.transition;
		}, comfort);
		await page.close();
		return transition;
	};
	const usual = await climb(false);
	const comfortable = await climb(true);
	assert.match(usual, /cubic-bezier\(0\.36, 0, 0\.66, -0\.56\)/, 'the usual climb dips first');
	assert.match(comfortable, /ease-in-out/, 'Comfort climbs smoothly');
	assert.ok(usual.includes('1500ms') && comfortable.includes('1500ms'), 'both take the same time');
});

test('letter keys: W A S D walk and turn, R and F climb, never with Ctrl, and they can be turned off', async () => {
	const { page } = await openDemo('', gameScript(1, 2, 4));
	await page.waitForFunction(() => !game.mazehtml.isBusy());
	// Spy on the rules: which action does each key ask for?
	await page.evaluate(() => {
		window.log = [];
		game.mazehtml.player.act = action => { window.log.push(action); return null; };
	});
	const asked = async (key, options = {}) => {
		await page.evaluate(() => { window.log = []; });
		await page.evaluate(([key, options]) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options })), [key, options]);
		await page.waitForTimeout(250);
		await page.evaluate(([key, options]) => document.body.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, ...options })), [key, options]);
		await page.waitForTimeout(150);
		return [...new Set(await page.evaluate(() => window.log))];
	};
	for (const [key, action] of [['w', 'F'], ['s', 'B'], ['a', 'L'], ['d', 'R'], ['r', 'U'], ['f', 'D'], ['W', 'F'], ['ArrowUp', 'F'], ['PageUp', 'U']]) {
		assert.deepStrictEqual(await asked(key), [action], `${key} asks for ${action}`);
	}
	assert.deepStrictEqual(await asked('w', { ctrlKey: true }), [], 'Ctrl+W is the browser\'s');
	assert.deepStrictEqual(await asked('r', { metaKey: true }), [], 'Cmd+R is the browser\'s');
	await page.evaluate(() => game.mazehtml.setLetterKeys(false));
	assert.deepStrictEqual(await asked('w'), [], 'turned off, a letter does nothing');
	assert.deepStrictEqual(await asked('ArrowUp'), ['F'], 'the arrows still work');
	await page.close();
});

test('letting go of a letter key stops the walk', async () => {
	const { page } = await openDemo('', gameScript(1, 2, 4));
	await page.waitForFunction(() => !game.mazehtml.isBusy());
	await page.evaluate(() => {
		window.log = [];
		game.mazehtml.player.act = action => { window.log.push(action); return null; };
	});
	await page.keyboard.down('a');
	await page.waitForTimeout(350);
	await page.keyboard.up('a');
	await page.waitForTimeout(150);
	const held = await page.evaluate(() => window.log.length);
	assert.ok(held >= 2, `held, it kept asking (${held})`);
	await page.waitForTimeout(400);
	assert.strictEqual(await page.evaluate(() => window.log.length), held, 'let go, it stopped');
	await page.close();
});

/*
Game layer hooks (generator/gamelayer.js): playGame takes options so a game with its own rules can use this view.
The page below plays a normal maze but routes every action through its own function, which is what a game layer does.
*/
function hookScript(extra = '') {
	return gameScript(1, 5, 2).replace('mazehtml.playGame();', `
		window.log = { acts: [], actions: [], settled: 0 };
		const player = new MazePlayer(maze);
		window.player = player;
		mazehtml.playGame(null, null, {
			player,
			act: (action, time) => { log.acts.push(action); return player.act(action, time); },
			canAct: (action) => player.canAct(action) && action != 'D',
			onAction: (action, result) => log.actions.push(action + ':' + result.type),
			onSettled: () => ++log.settled,
		});
		${extra}
	`);
}

test('playGame routes actions through the options the game gave, and reports each one', async () => {
	const { page, errors } = await openDemo('', hookScript());
	// Hold the key until the game has acted, then let go: one turn.
	await page.keyboard.down('ArrowLeft');
	await page.waitForFunction(() => log.acts.length >= 1);
	await page.keyboard.up('ArrowLeft');
	await page.waitForFunction(() => log.settled >= 1);
	assert.deepStrictEqual(await page.evaluate(() => log.acts), ['L']);
	assert.deepStrictEqual(await page.evaluate(() => log.actions), ['L:turn']);
	assert.strictEqual(await page.evaluate(() => player.actions), 'L', 'the player we passed in is the one that played');
	assert.deepStrictEqual(errors, []);
	await page.close();
});

test('a bump reaches the game but is not an action: nothing is reported', async () => {
	const { page } = await openDemo('', hookScript());
	// The player starts at an entrance facing into the maze, so Back (out of the entrance) is refused by the rules.
	await page.keyboard.down('ArrowDown');
	await page.waitForTimeout(300);
	await page.keyboard.up('ArrowDown');
	assert.deepStrictEqual(await page.evaluate(() => log.actions), []);
	await page.close();
});

test('syncPlayer snaps the view to where the game moved the player', async () => {
	const { page, errors } = await openDemo('', hookScript());
	const before = await page.evaluate(() => document.getElementById('mazeTranslate').style.transform);
	// The game moves the player itself (a teleport), then tells the view.
	await page.evaluate(() => {
		const here = game.maze.grid[player.z][player.y][player.x];
		const target = ['N', 'S', 'E', 'W'].map(d => game.maze.getNextCell(here, d)).find(c => c && c.loc[0] == player.z);
		player.moveTo(target, 'S');
		game.mazehtml.syncPlayer();
	});
	const after = await page.evaluate(() => ({ t: document.getElementById('mazeTranslate').style.transform, x: player.x, y: player.y, r: document.getElementById('mazeRotate').style.transform }));
	assert.notStrictEqual(after.t, before, 'the view moved');
	assert.ok(after.t.includes(`translate3d(${-100 * after.x}vmin, 0vmin, ${-100 * after.y}vmin)`), after.t);
	assert.match(after.r, /rotateY\((180|-180)deg\)/);
	assert.deepStrictEqual(errors, []);
	await page.close();
});

test('syncPlayer during an animation waits for it to end, then snaps', async () => {
	const { page } = await openDemo('', hookScript());
	await page.keyboard.down('ArrowLeft');
	await page.waitForFunction(() => log.acts.length >= 1);
	await page.keyboard.up('ArrowLeft');
	// Mid-turn: ask for a sync after the game changed the player's facing.
	await page.evaluate(() => { player.dir = 'N'; game.mazehtml.syncPlayer(); });
	await page.waitForFunction(() => log.settled >= 1);
	const rotation = await page.evaluate(() => document.getElementById('mazeRotate').style.transform);
	assert.match(rotation, /rotateY\(0deg\)/);
	await page.close();
});

test('the touch buttons ask the game\'s canAct, so a game can hide a button', async () => {
	const { page } = await openDemo('', hookScript(), { hasTouch: true });
	// canAct above refuses D, so the Down button is blocked (hidden) whatever the maze says.
	assert.ok(await page.locator('#touchDown.touchBlocked').count() > 0);
	await page.close();
});

/*
The win hook: a page can draw its own celebration. onWin gets the result and the #maze element
once the walk out of the exit has finished. Answering false means the page did the banner and sound itself.
*/
async function winWithHook(hookBody) {
	const { solve, load } = require('../../tools/check_mazes_lib.js');
	const ctx = load(root);
	const [type, seed] = [1, 202601015];
	const [, maze] = vm.runInContext(`build(${type}, ${seed})`, ctx);
	const script = gameScript(type, seed, 11).replace('mazehtml.playGame();',
		`window.wins = [];
		mazehtml.playGame(null, null, {onWin: info => { window.wins.push({moves: info.moves, cells: info.cells,
			actions: info.actions, hasElement: info.element.attr('id') == 'maze'}); ${hookBody} }});`);
	const { page, errors } = await openDemo('', script);
	const won = await playKeys(page, solve(maze));
	assert.strictEqual(won.won, true);
	// The hook runs when the walk out of the exit ends, a moment after the player counts as won.
	await page.waitForFunction(() => window.wins.length > 0);
	const result = await page.evaluate(() => ({wins: window.wins,
		banner: document.querySelectorAll('#maze .alertTop').length, custom: document.querySelectorAll('#maze .custom').length}));
	assert.deepStrictEqual(errors, []);
	await page.close();
	return { result, solution: won.actions };
}

test('the win hook is called once with the result, and replaces the plain win box', async () => {
	const { result, solution } = await winWithHook(`info.element.append('<div class="custom"></div>');`);
	assert.strictEqual(result.wins.length, 1);
	assert.strictEqual(result.wins[0].actions, solution);
	assert.strictEqual(result.wins[0].moves, solution.length);
	assert.ok(result.wins[0].cells > 0);
	assert.strictEqual(result.wins[0].hasElement, true);
	assert.strictEqual(result.custom, 1, 'the page could draw over the maze');
	assert.strictEqual(result.banner, 0, 'the plain box is only the default');
});

test('a win hook can call defaultOnWin to add to the plain win box', async () => {
	const { result } = await winWithHook(`game.mazehtml.defaultOnWin(info);`);
	assert.strictEqual(result.wins.length, 1);
	assert.strictEqual(result.banner, 1);
});

test('with no win hook the plain win box shows', async () => {
	const { solve, load } = require('../../tools/check_mazes_lib.js');
	const [, maze] = vm.runInContext('build(1, 202601015)', load(root));
	const { page, errors } = await openDemo('', gameScript(1, 202601015, 11));
	await playKeys(page, solve(maze));
	await page.waitForSelector('#maze .alertTop');
	assert.deepStrictEqual(errors, []);
	await page.close();
});

Regression: a wrong entrance (a fake exit) drops a wall when the player walks out of it, but the
map kept drawing an opening there. Stand at a fake exit, walk out, and read the map cell's border.
*/
test('the map draws the wall that falls at a fake exit', async () => {
	const { page, errors } = await openDemo('', gameScript(3, 3, 4));
	const prop = dir => ({ N: 'border-top-style', S: 'border-bottom-style', E: 'border-right-style', W: 'border-left-style' })[dir];
	// Stand at a fake exit, facing out, and let the view follow.
	const fake = await page.evaluate(() => {
		const { maze, mazehtml } = window.game;
		const exit = maze.entranceList[maze.entrances - 1];
		const entrance = maze.entranceList.find(e => e.cell !== exit.cell);
		const [z, y, x] = entrance.cell.loc;
		const player = mazehtml.player;
		player.z = z; player.y = y; player.x = x; player.dir = entrance.dir;
		mazehtml.syncPlayer();
		return { loc: entrance.cell.loc, dir: entrance.dir };
	});
	const style = () => page.evaluate(({ loc, p }) => {
		const cell = window.game.maze.grid[loc[0]][loc[1]][loc[2]];
		return cell.map.css(p);
	}, { loc: fake.loc, p: prop(fake.dir) });
	assert.notStrictEqual(await style(), 'solid', 'an unused fake exit is an opening');
	await page.waitForTimeout(1500);
	await page.keyboard.down('ArrowUp');
	await page.waitForTimeout(300);
	await page.keyboard.up('ArrowUp');
	await page.waitForTimeout(2500);
	assert.strictEqual(await style(), 'solid', 'the fallen wall is on the map');
	assert.deepStrictEqual(errors, []);
	await page.close();
});

test('the map marks the entrance the player started from, and only that one', async () => {
	const { page, errors } = await openDemo('', gameScript(3, 3, 19, 4));
	const markers = () => page.evaluate(() => {
		const maze = game.maze, start = maze.entranceList[0];
		const cells = [...document.querySelectorAll('.startMarker')];
		const mine = game.mazehtml.entranceGrid[start.floor][start.dir][start.pos].get(0);
		return {
			count: cells.length,
			// The marker sits in the border cell outside the start entrance.
			onStart: cells[0] === mine,
			title: cells[0]?.title,
			entrances: maze.entranceList.length,
			// An arrow icon class is on the marker, so it points into the maze.
			arrow: /fa-arrow-/.test(cells[0]?.className ?? ''),
			color: cells[0] && getComputedStyle(cells[0]).color,
		};
	});
	let found = await markers();
	assert.ok(found.entrances >= 2, 'the maze has more than one entrance, so a marker is needed');
	assert.strictEqual(found.count, 1, 'exactly one entrance is marked');
	assert.ok(found.onStart && found.arrow);
	assert.strictEqual(found.title, 'Start');
	assert.strictEqual(found.color, 'rgb(255, 212, 0)', 'bright on its dark square');
	// Redrawing the map (it happens all the time) never adds a second marker, in any look.
	for (const look of ['dark', 'highContrast', 'plain']) {
		await page.evaluate(look => {
			game.mazehtml.setDarkMap(look === 'dark');
			game.mazehtml.setHighContrast(look === 'highContrast');
			game.mazehtml.renderMap();
		}, look);
		found = await markers();
		assert.strictEqual(found.count, 1, `one marker in the ${look} look`);
		assert.ok(found.onStart);
	}
	assert.deepStrictEqual(errors, []);
	await page.close();
});
