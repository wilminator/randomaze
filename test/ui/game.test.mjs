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
async function openDemo(query, script = null) {
	const page = await browser.newPage();
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
function gameScript(type, seed, keyCount) {
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
