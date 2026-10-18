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
function gameScript(type, seed, keyCount, plainDoors = 0, dungeon = false) {
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
		mazehtml.dungeon = ${dungeon};
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
const pressFor = {F: 'ArrowUp', B: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight', U: 'PageUp', D: 'PageDown', C: 'c', W: 'w'};
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

/*
A dungeon game adds C (close the open door ahead) and W (wait). Close a plain door right after
opening it, check the page really shut it, open it again and finish the maze. The tick layer
counts the same ticks live as the server's replay does.
*/
test('in a dungeon, C closes a door and W waits, and the recording replays', async () => {
	const { solve, load } = require('../../tools/check_mazes_lib.js');
	const ctx = load(root);
	const [type, seed, plainDoors] = [1, 3, 1000];
	const [, maze] = vm.runInContext(`build(${type}, ${seed})`, ctx);
	maze.generatePlainDoors(plainDoors);
	const solution = solve(maze);
	// Where the solution first opens a door: play it in the rules until a 'door' result.
	const probe = new (vm.runInContext('MazePlayer', ctx))(maze, false, true);
	let doorAt = -1;
	for (let i = 0; i < solution.length && doorAt < 0; ++i) {
		if (probe.act(solution[i]).type == 'door') doorAt = i;
	}
	assert.ok(doorAt >= 0, 'the solution goes through a plain door');

	const { page, errors } = await openDemo('', gameScript(type, seed, 11, plainDoors, true));
	assert.deepStrictEqual(errors, []);
	await page.evaluate(() => { game.ticks = []; game.mazehtml.onMove((action, result) => game.ticks.push(action)); });
	const openDoors = () => page.evaluate(() => document.querySelectorAll('.door_split_left_open').length);
	await playKeys(page, solution.slice(0, doorAt + 1));
	assert.ok(await openDoors() > 0, 'the door opened');
	await playKeys(page, 'WC');
	assert.strictEqual(await openDoors(), 0, 'the door closed again');
	const closed = await page.evaluate(() => { const p = game.mazehtml.player; return p.canWalk(p.cell(), p.dir); });
	assert.strictEqual(closed, false);
	// Reopen it and finish the maze.
	const won = await playKeys(page, solution.slice(doorAt));
	const expected = solution.slice(0, doorAt + 1) + 'WC' + solution.slice(doorAt);
	assert.strictEqual(won.won, true);
	assert.strictEqual(won.actions, expected);
	// The hook saw every move, and the server-side replay agrees on the result and on the ticks.
	const hooked = await page.evaluate(() => game.ticks.join(''));
	assert.strictEqual(hooked, expected);
	const replay = vm.runInContext('replayGame', ctx)(maze, won.actions, {dungeon: true});
	assert.strictEqual(replay.valid, true);
	assert.strictEqual(replay.ticks, expected.length - 1, 'every move but the winning step ticks');
	assert.deepStrictEqual(errors, []);
	await page.close();
});

test('in a classic game C and W do nothing', async () => {
	const { page, errors } = await openDemo('', gameScript(1, 3, 11));
	const result = await playKeys(page, 'WC');
	assert.strictEqual(result.actions, '');
A top floor of three cells (start, middle, exit) over a bottom floor where the middle cell
sits between a ladder home and a key. The middle cell on the top floor is a hole or a pit.
*/
function holeScript(pit) {
	return `
		const maze = new Maze('holes', 2, 3, 1, 0, 2, 0);
		const upper = c => maze.grid[1][0][c], lower = c => maze.grid[0][0][c];
		upper(0).data.E = null; upper(1).data.W = null; upper(1).data.E = null; upper(2).data.W = null;
		upper(0).data.W = null; upper(2).data.E = null;
		lower(0).data.E = null; lower(1).data.W = null;
		upper(0).data.D = null; lower(0).data.U = null;
		upper(1).data.D = null; upper(1).data.hole = true; lower(1).data.U = 0;
		${pit ? 'upper(1).data.pit = true;' : ''}
		maze.entranceList = [{cell: upper(0), floor: 1, dir: 'W', pos: 0}, {cell: upper(2), floor: 1, dir: 'E', pos: 0}];
		const mazehtml = new MazeHtml(1, maze);
		mazehtml.loadWall({name: 'plain', css: 'background: gray;', tags: ['wall']});
		mazehtml.loadDoor({css: 'background: brown;', tags: ['split']});
		mazehtml.generateGameUi('gamewindow');
		mazehtml.playGame();
		window.game = {maze, mazehtml};
	`;
}

const floorTiles = (page, cls) => page.evaluate(cls => game.maze.grid[1][0].map(cell => cell.html.floor.hasClass(cls)), cls);

test('a hole is drawn as a hole in the floor, with no ladder, and a pit looks like floor', async () => {
	const seen = await openDemo('', holeScript(false));
	assert.deepStrictEqual(seen.errors, []);
	assert.deepStrictEqual(await floorTiles(seen.page, 'hole'), [true, true, false], 'ladder cell and hole cell');
	const ladders = await seen.page.evaluate(() => game.maze.grid[1][0].map(cell => cell.html.contents.children('.ladder').length));
	assert.deepStrictEqual(ladders, [1, 0, 0]);
	// The cell below a hole has the opening in its ceiling.
	assert.strictEqual(await seen.page.evaluate(() => game.maze.grid[0][0][1].html.ceiling.hasClass('hole')), true);
	await seen.page.close();

	const hidden = await openDemo('', holeScript(true));
	assert.deepStrictEqual(await floorTiles(hidden.page, 'hole'), [true, false, false], 'only the ladder shows');
	assert.strictEqual(await hidden.page.evaluate(() => game.maze.grid[0][0][1].html.ceiling.hasClass('hole')), false);
	await hidden.page.close();
});

test('walking onto a pit drops the player to the floor below', async () => {
	const { page, errors } = await openDemo('', holeScript(true));
	const where = () => page.evaluate(() => [game.mazehtml.player.z, game.mazehtml.player.y, game.mazehtml.player.x]);
	assert.deepStrictEqual(await where(), [1, 0, 0]);
	await page.keyboard.down('ArrowUp');
	await page.waitForFunction(() => game.mazehtml.player.z == 0);
	await page.keyboard.up('ArrowUp');
	assert.deepStrictEqual(await where(), [0, 0, 1], 'across and down');
	// The counter changes when the fall animation ends; the page must stay error free until then.
	await page.waitForFunction(() => document.querySelector('#moves').textContent == 'Moves: 1', null, { timeout: 15000 });
	assert.deepStrictEqual(errors, []);
	await page.close();
});
