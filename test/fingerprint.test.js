const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { generate } = require('./helpers.js');

/*
Servers check finished games by rebuilding the maze from its seed, so a new engine version
must build exactly the same mazes as the one players have open. This hashes every wall,
door and key of a spread of mazes. If it changes, mazes changed: that needs a site and
server update together, not a quiet release.
*/
function fingerprint() {
	const hash = crypto.createHash('sha256');
	for (const type of [0, 1, 2, 3]) {
		for (const seed of [1, 2, 3, 202601017, 202601231]) {
			const { maze } = generate(type, seed);
			for (const cell of maze.cellList) {
				const d = cell.data;
				hash.update(`${cell.loc}|${d.N},${d.S},${d.E},${d.W},${d.U},${d.D}|${d.item.key || ''};`);
			}
			hash.update(JSON.stringify(maze.entranceList.map(e => [e.cell.loc, e.dir])));
		}
	}
	return hash.digest('hex');
}

test('mazes are the same as in the released engine', () => {
	assert.strictEqual(fingerprint(), 'd52b9799d702d84bb58f3243dece05a40a2cf7d8524fd3d4e7d93c6d89a589b7');
});
