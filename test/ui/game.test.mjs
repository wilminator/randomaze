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
