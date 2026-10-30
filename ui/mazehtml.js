// Constants
const viewRange = 5; // Viewing range. Cells farther away are hidden.

const turnRight = {'N':'E','E':'S','S':'W','W':'N'};
const turnLeft = {'N':'W','W':'S','S':'E','E':'N'};

const walls = [
	{'color':'#C0C0C0','img':''},
];
const doors = [
	{'map':'3px black solid', 'wall':'gray', 'img':''},
	{'map':'3px brown solid', 'wall':'brown', 'img':''},
	{'map':'3px red solid', 'key':'red', 'wall':'red', 'img':''},
	{'map':'3px orange solid', 'key':'orange', 'wall':'orange', 'img':''},
	{'map':'3px yellow solid', 'key':'yellow', 'wall':'yellow', 'img':''},
	{'map':'3px green solid', 'key':'green', 'wall':'green', 'img':''},
	{'map':'3px darkblue solid', 'key':'darkblue', 'wall':'darkblue', 'img':''},
	{'map':'3px purple solid', 'key':'purple', 'wall':'purple', 'img':''},
	{'map':'3px pink solid', 'key':'pink', 'wall':'pink', 'img':''},
	{'map':'3px aqua solid', 'key':'aqua', 'wall':'aqua', 'img':''},
	{'map':'3px springgreen solid', 'key':'springgreen', 'wall':'springgreen', 'img':''},
	{'map':'3px red solid', 'key':'red', 'wall':'red', 'img':''},
	{'map':'3px orange solid', 'key':'orange', 'wall':'orange', 'img':''},
	{'map':'3px yellow solid', 'key':'yellow', 'wall':'yellow', 'img':''},
	{'map':'3px green solid', 'key':'green', 'wall':'green', 'img':''},
	{'map':'3px darkblue solid', 'key':'darkblue', 'wall':'darkblue', 'img':''},
	{'map':'3px purple solid', 'key':'purple', 'wall':'purple', 'img':''},
	{'map':'3px pink solid', 'key':'pink', 'wall':'pink', 'img':''},
	{'map':'3px aqua solid', 'key':'aqua', 'wall':'aqua', 'img':''},
	{'map':'3px springgreen solid', 'key':'springgreen', 'wall':'springgreen', 'img':''},
];

const wallRotate = { 'E': '-90deg', 'W': '90deg', 'N': '0deg', 'S':  '180deg'};
const dirCss = { 'E': 'border-right', 'W': 'border-left', 'N': 'border-top', 'S': 'border-bottom' };
const dirText = { };
const dirClass = {'U':'fas fa-level-up-alt','D':'fas fa-level-down-alt'};
const keyClass ="fas fa-key";
const entranceClass = { 'E': 'fas fa-arrow-left', 'W': 'fas fa-arrow-right', 'N': 'fas fa-arrow-down', 'S': 'fas fa-arrow-up' };
const oneWayWallClass = { 'W': 'fas fa-arrow-left', 'E': 'fas fa-arrow-right', 'S': 'fas fa-arrow-down', 'N': 'fas fa-arrow-up' };
const oneWayWallHtml = { 'W': '&#57909;', 'E': '&#57908;', 'S': '&#57907;', 'N': '&#57906;' };
const stopPropagation = event=>event.stopImmediatePropagation();
/*
High contrast mode. Every key and its door share one look made of a color AND a pattern, so the
pair can be matched without telling hues apart. The colors are the Okabe-Ito set, chosen to stay
apart for the common kinds of color blindness, and all read clearly on black. Yellow and blue are
left out: yellow outlines the walls, and blue is dim on black. After the colors run out, the next
pattern starts, so 5 colors x 4 patterns give 20 looks before one repeats.
*/
const highContrastColors = ['#E69F00', '#56B4E9', '#009E73', '#CC79A7', '#D55E00'];
const highContrastPatterns = [
	{image: 'none', size: 'auto'},
	{image: 'repeating-linear-gradient(45deg, #000 0 1.5vmin, transparent 1.5vmin 4vmin)', size: 'auto'},
	{image: 'repeating-linear-gradient(0deg, #000 0 1.5vmin, transparent 1.5vmin 4vmin)', size: 'auto'},
	{image: 'radial-gradient(circle, #000 0.9vmin, transparent 1vmin)', size: '4vmin 4vmin'},
];
// The look of lock number `key` (2 and up): {color, image, size}. Keyless doors are drawn plain.
function highContrastLook(key) {
	const n = key - 2;
	const pattern = highContrastPatterns[Math.floor(n / highContrastColors.length) % highContrastPatterns.length];
	return Object.assign({color: highContrastColors[n % highContrastColors.length]}, pattern);
}

const defaultDoorNew = (elem, key, text)=>{
	const door = $('<div>').addClass(`door door_${key}`);
	door.append($('<div>').addClass('doortitle').text(text));
	elem.append(door);
};
const defaultDoorOpen = (door, otherDoor, openCss, otherOpenCss = null)=>{		
	// Only one door transition can trigger, or there are UI problems.
	door.children('.door').addClass(openCss);
	otherDoor.children('.door').on('transitionend', stopPropagation).addClass(otherOpenCss ? otherOpenCss : openCss);
};
const openDoorFxns = {
	up:{
		new: defaultDoorNew,
		open:(door, oDoor)=>defaultDoorOpen(door, oDoor, 'door_up_open'),
	},
	down:{
		new: defaultDoorNew,
		open:(door, oDoor)=>defaultDoorOpen(door, oDoor, 'door_down_open'),
	},
	left:{
		new: defaultDoorNew,
		open:(door, oDoor)=>defaultDoorOpen(door, oDoor, 'door_left_open'),
	},
	right:{
		new: defaultDoorNew,
		open:(door, oDoor)=>defaultDoorOpen(door, oDoor, 'door_right_open'),
	},
	split:{
		new:(elem, key, text)=>{
			const door_a = $('<div>').addClass(`door door_split_left door_${key}`);
			door_a.append($('<div>').addClass('doortitle').text(text));
			elem.append(door_a);
			const door_b = $('<div>').addClass(`door door_split_right door_${key}`);
			door_b.append($('<div>').addClass('doortitle').text(text));
			elem.append(door_b);
		},
		open:(door, otherDoor)=>{		
			// Only one door transition can trigger, or there are UI problems.
			door.children('.door_split_left').addClass('door_split_left_open');
			door.children('.door_split_right').on('transitionend', stopPropagation).addClass('door_split_right_open');
			otherDoor.children('.door_split_left').on('transitionend', stopPropagation).addClass('door_split_left_open');
			otherDoor.children('.door_split_right').on('transitionend', stopPropagation).addClass('door_split_right_open');
		},
	},
};

const gameDebug = false; // allow wall passthrough

/*
Look variety. Walls, floors, ceilings and doors are picked from what the page loaded, and the picks
must be the same every time the same maze is shown. They come from a hash of the maze seed
and the position, never from the seeded generator, so they do not change which key or door
look any other part of the UI gets, and never touch the maze, the game's RNG or replays.
*/

// 32-bit FNV-1a hash of a list of values, as a number from 0 up to (not including) 1.
function varietyRoll(...parts) {
	let h = 2166136261;
	for (const ch of parts.join('|')) {
		h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
	}
	// FNV mixes its last characters weakly, so finish with a murmur-style avalanche.
	h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
	h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
	h = (h ^ (h >>> 16)) >>> 0;
	return h / 4294967296;
}

/*
Deal `count` indexes from 0..size-1 like cards: every index is used once before any repeats,
and a new round never starts with the card that ended the last one. This is for things that
should look different from each other, like the doors in one maze.
*/
function varietyDeal(size, count, ...salt) {
	const dealt = [];
	if (size == 0) return dealt;
	for (let round = 0; dealt.length < count; ++round) {
		const deck = [...Array(size).keys()]
			.map(i => ({i, sort: varietyRoll(...salt, round, i)}))
			.sort((a, b) => a.sort - b.sort)
			.map(c => c.i);
		if (deck.length > 1 && deck[0] === dealt[dealt.length - 1]) deck.push(deck.shift());
		dealt.push(...deck);
	}
	return dealt.slice(0, count);
}
/*
Look regions. Each floor of the maze is cut into regions, and a whole region shares one look
(a wall image paired with a floor image), so you feel like you are in one area of the maze.

Borders go where a door is: the cells you can reach from each other without passing a door
make one region. A region bigger than about `target` cells is cut into several large regions so the
look still changes mid-area. No region is under `min` cells (a closet behind a door joins the
region next to it), so there are never small outcrops.
Everything depends only on the maze layout and its seed.

Returns, for each maze floor, a grid of region numbers (regions[floor][row][column]).
*/
function lookRegions(maze, seed, {target = 45, min = 12} = {}) {
	const dirStep = {N: [-1, 0], S: [1, 0], W: [0, -1], E: [0, 1]};
	const opp = {N: 'S', S: 'N', W: 'E', E: 'W'};
	return [...Array(maze.floors)].map((_, floor) => {
		const rows = maze.rows, cols = maze.columns, count = rows * cols;
		const at = i => maze.grid[floor][Math.floor(i / cols)][i % cols];
		// Neighbours reached without passing a door. A one-way wall counts as open.
		const open = [...Array(count)].map(() => []);
		// Neighbours across a door.
		const doorway = [...Array(count)].map(() => []);
		for (let i = 0; i < count; ++i) {
			const r = Math.floor(i / cols), c = i % cols;
			for (const dir in dirStep) {
				const nr = r + dirStep[dir][0], nc = c + dirStep[dir][1];
				if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
				const here = at(i).data[dir], there = maze.grid[floor][nr][nc].data[opp[dir]];
				const door = (typeof here == 'number' && here >= 1) || (typeof there == 'number' && there >= 1);
				if (door) doorway[i].push(nr * cols + nc);
				else if (here === null || there === null) open[i].push(nr * cols + nc);
			}
		}
		// Make the passages two-way for flood fills (a one-way wall is open from one side only).
		for (let i = 0; i < count; ++i) for (const j of open[i]) if (!open[j].includes(i)) open[j].push(i);

		const region = Array(count).fill(-1);
		let regionCount = 0;
		const components = [];
		for (let start = 0; start < count; ++start) {
			if (region[start] >= 0) continue;
			const cells = [start];
			region[start] = regionCount;
			for (let k = 0; k < cells.length; ++k) {
				for (const j of open[cells[k]]) if (region[j] < 0) { region[j] = regionCount; cells.push(j); }
			}
			components.push(cells);
			++regionCount;
		}

		// Cut big door-free areas into a few large regions.
		for (const cells of components) {
			const pieces = Math.round(cells.length / target);
			if (pieces < 2) continue;
			const inside = new Set(cells);
			// Distance from the nearest seed to every cell of this area.
			const distanceFrom = seeds => {
				const dist = new Map(seeds.map(s => [s, 0]));
				const queue = [...seeds];
				for (let k = 0; k < queue.length; ++k) {
					for (const j of open[queue[k]]) if (!dist.has(j)) { dist.set(j, dist.get(queue[k]) + 1); queue.push(j); }
				}
				return dist;
			};
			// Seeds: the first by a roll, each next one as far as possible from the others.
			const roll = i => varietyRoll(seed, 'region', floor, i);
			const seeds = [cells.reduce((a, b) => roll(b) < roll(a) ? b : a)];
			while (seeds.length < pieces) {
				const dist = distanceFrom(seeds);
				seeds.push(cells.reduce((a, b) => dist.get(b) > dist.get(a) || (dist.get(b) == dist.get(a) && roll(b) < roll(a)) ? b : a));
			}
			// Each seed grows outwards together, one step at a time, so each piece is a connected blob.
			const owner = new Map(seeds.map((s, p) => [s, p]));
			const queue = [...seeds];
			for (let k = 0; k < queue.length; ++k) {
				for (const j of open[queue[k]]) if (!owner.has(j)) { owner.set(j, owner.get(queue[k])); queue.push(j); }
			}
			// Fold pieces under `min` cells into the neighbour they touch most.
			const sizes = seeds.map(() => 0);
			for (const i of cells) sizes[owner.get(i)]++;
			for (;;) {
				const alive = sizes.map((n, p) => ({n, p})).filter(x => x.n > 0);
				const small = alive.filter(x => x.n < min).sort((a, b) => a.n - b.n || a.p - b.p)[0];
				if (!small || alive.length < 2) break;
				const touch = new Map();
				for (const i of cells) {
					if (owner.get(i) != small.p) continue;
					for (const j of open[i]) if (owner.get(j) != small.p) touch.set(owner.get(j), (touch.get(owner.get(j)) || 0) + 1);
				}
				const into = [...touch.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
				for (const i of cells) if (owner.get(i) == small.p) owner.set(i, into);
				sizes[into] += sizes[small.p];
				sizes[small.p] = 0;
			}
			// The first piece keeps the area's region number; the others get new ones.
			const numbers = new Map();
			for (const i of cells) {
				const p = owner.get(i);
				if (!numbers.has(p)) numbers.set(p, numbers.size == 0 ? region[cells[0]] : regionCount++);
				region[i] = numbers.get(p);
			}
		}

		// A tiny room behind a door would look like an outcrop too: fold any region under `min`
		// cells into the region it touches most (through openings or doors).
		for (;;) {
			const sizes = new Map();
			for (const n of region) sizes.set(n, (sizes.get(n) || 0) + 1);
			if (sizes.size < 2) break;
			let merged = false;
			for (const [id] of [...sizes].filter(([, n]) => n < min).sort((a, b) => a[1] - b[1] || a[0] - b[0])) {
				const touch = new Map();
				for (let i = 0; i < count; ++i) {
					if (region[i] != id) continue;
					for (const j of [...open[i], ...doorway[i]]) if (region[j] != id) touch.set(region[j], (touch.get(region[j]) || 0) + 1);
				}
				if (touch.size == 0) {
					// Only stairs lead here: go with whatever lies next door, wall or not.
					for (let i = 0; i < count; ++i) {
						if (region[i] != id) continue;
						for (const [dr, dc] of Object.values(dirStep)) {
							const r = Math.floor(i / cols) + dr, c = i % cols + dc;
							if (r < 0 || c < 0 || r >= rows || c >= cols || region[r * cols + c] == id) continue;
							touch.set(region[r * cols + c], (touch.get(region[r * cols + c]) || 0) + 1);
						}
					}
				}
				const into = [...touch.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
				for (let i = 0; i < count; ++i) if (region[i] == id) region[i] = into;
				merged = true;
				break;
			}
			if (!merged) break;
		}

		// Renumber in order of first appearance, and return a row by column grid.
		const renumber = new Map();
		for (let i = 0; i < count; ++i) if (!renumber.has(region[i])) renumber.set(region[i], renumber.size);
		return [...Array(rows)].map((_, r) => [...Array(cols)].map((_, c) => renumber.get(region[r * cols + c])));
	});
}

/*
Give every region of every floor a look from `looks` (a list of {wall, floor, ceiling} class names).
Touching regions (across a door or an opening) avoid sharing a wall, a floor, or the same look, and
a floor tries to use as many different looks as it can. Returns looks[floor][region].
*/
function lookAssign(maze, regions, looks, seed) {
	return regions.map((grid, floor) => {
		const regionCount = Math.max(-1, ...grid.flat()) + 1;
		const touching = [...Array(regionCount)].map(() => new Set());
		for (let r = 0; r < maze.rows; ++r) for (let c = 0; c < maze.columns; ++c) {
			for (const [nr, nc] of [[r + 1, c], [r, c + 1]]) {
				if (nr < maze.rows && nc < maze.columns && grid[nr][nc] != grid[r][c]) {
					const edgeless = maze.grid[floor][r][c].data[nr > r ? 'S' : 'E'] === 0 && maze.grid[floor][nr][nc].data[nr > r ? 'N' : 'W'] === 0;
					if (!edgeless) { touching[grid[r][c]].add(grid[nr][nc]); touching[grid[nr][nc]].add(grid[r][c]); }
				}
			}
		}
		const chosen = [];
		const used = looks.map(() => 0);
		for (let region = 0; region < regionCount; ++region) {
			const neighbours = [...touching[region]].filter(n => chosen[n] !== undefined).map(n => looks[chosen[n]]);
			const cost = look => {
				const i = looks.indexOf(look);
				const clash = neighbours.reduce((sum, n) => sum + (n === look ? 4 : 0) + (n.wall == look.wall ? 2 : 0) + (n.floor == look.floor ? 1 : 0), 0);
				return clash * 100 + used[i];
			};
			const best = Math.min(...looks.map(cost));
			const candidates = looks.map((look, i) => i).filter(i => cost(looks[i]) == best);
			const pick = candidates[Math.floor(varietyRoll(seed, 'look', floor, region) * candidates.length)];
			chosen[region] = pick;
			used[pick]++;
		}
		return chosen.map(i => looks[i]);
	});
}

/*
Which cells of a maze floor can be seen from a cell, as a Set of row * columns + column numbers. Only
cells reached through openings within `range` steps count: walls block the view, and so does a
door until it has been opened (`play[dir]` on the cell is set then). Everything else is not worth drawing: the walls of a cell you cannot
see are behind other walls. The facing is ignored, so turning on the spot never changes the set.
*/
function visibleCells(maze, floor, row, column, range) {
	const step = {N: [-1, 0], S: [1, 0], W: [0, -1], E: [0, 1]};
	const opp = {N: 'S', S: 'N', W: 'E', E: 'W'};
	const seen = new Set([row * maze.columns + column]);
	const queue = [[row, column, 0]];
	for (let k = 0; k < queue.length; ++k) {
		const [r, c, d] = queue[k];
		if (d >= range) continue;
		const cell = maze.grid[floor][r][c];
		for (const dir in step) {
			const nr = r + step[dir][0], nc = c + step[dir][1];
			if (nr < 0 || nc < 0 || nr >= maze.rows || nc >= maze.columns || seen.has(nr * maze.columns + nc)) continue;
			const next = maze.grid[floor][nr][nc];
			const here = cell.data[dir], there = next.data[opp[dir]];
			// A door lets the eye through once it is open. A one-way wall is open from one side only.
			const opened = cell.play && cell.play[dir] || next.play && next.play[opp[dir]];
			const door = (typeof here == 'number' && here >= 1) || (typeof there == 'number' && there >= 1);
			if (door ? opened : (here === null || there === null)) {
				seen.add(nr * maze.columns + nc);
				queue.push([nr, nc, d + 1]);
			}
		}
	}
	return seen;
}

// Which game action each key (or touch button, see playGame) stands for.
const keyActions = {'ArrowUp':'F', 'ArrowDown':'B', 'ArrowLeft':'L', 'ArrowRight':'R', 'PageUp':'U', 'PageDown':'D'};
// Letter keys, for keyboards without Page Up and Page Down (most laptops) and players who like
// WASD: each stands for the key above that does the same thing. R climbs up and F climbs down.
const letterKeys = {'w':'ArrowUp', 's':'ArrowDown', 'a':'ArrowLeft', 'd':'ArrowRight', 'r':'PageUp', 'f':'PageDown'};

class MazeHtml{
	constructor(seed, maze) {
		this.seed = seed;
		this.generator = new Math.seedrandom(seed);
		this.generateInt = generateIntegerWrapper(this.generator);
		this.maze = maze;
		this._debug = false;
		this.mapHtml = this.generateMapHtml();
		this.helpFxn = null;
		this.music = null;
		// How much longer than normal animations last: 1 is the usual pace, 2 is half speed.
		// Change it with setAnimationSpeed().
		this.slowFactor = 1;
		this.walls = [];
		this.items = [];
		this.doors = [];
		this.clips = [];
		// The looks a region of the maze can have, each a wall image paired with a floor image
		// (see loadLook). Without any, every loaded wall pairs with every loaded floor.
		this.looks = [];
		// How big the look regions are, in cells (see lookRegions). A door-free area bigger than
		// about `target` cells is cut into pieces; no cut piece is smaller than `min`.
		this.regionSize = {target: 45, min: 12};
		// Floor and ceiling images are drawn only on cells this many steps from the player or
		// nearer (0 for just the cell you stand in). Farther cells keep the plain colour of their
		// look. Every textured tile costs a phone's graphics memory, and a phone that runs out
		// drops tiles and parts of the page. Set it to 99 to texture everything in view.
		this.textureRange = 1;
		// Prefix for the images this file loads itself (the map's player marker), relative to the page.
		// The site serves img/ next to its pages; a page elsewhere sets this, e.g. '../ui/'.
		this.assetRoot = '';
		// Whether the on-screen touch buttons show: 'auto' (on a device with a touch screen),
		// 'on' or 'off'. A page that offers a setting for it calls setTouchControls().
		this.touchControls = 'auto';
		// How the touch buttons are used: 'taps' (a touch on a box acts at once), 'swipes' (only
		// swipes act; taps are ignored) or 'both' (a tap acts when the finger lifts, a swipe acts as
		// soon as it is clear, a finger held still walks). Change it with setTouchStyle().
		this.touchStyle = 'taps';
		// With swipes on, which way a swipe points: 'point' (swipe where you want to go, up is
		// forward, left turns left) or 'drag' (drag the view like Street View: everything flips,
		// down is forward, dragging left turns right). Change it with setSwipeDirection().
		this.swipeDirection = 'point';
		// When the map sits below the maze the page scrolls, and one side strip of the touch
		// buttons is left to the browser for scrolling it: 'left' or 'right'. The other strip
		// climbs ladders by swipe. Change it with setScrollSide().
		this.scrollSide = 'right';
		// Whether the maze is drawn in solid contrasting colors instead of pictures. Change it with setHighContrast().
		this.highContrast = false;
		// Whether the map alone is drawn dark: black explored cells, white walls, dark grey unexplored cells.
		// High contrast also does this. Change it with setDarkMap().
		this.darkMap = false;
		// The Comfort option for players who get motion sick (see setComfort()). Off unless the page turns it on.
		this.comfort = false;
		// Whether a press that would do nothing gives a small bump (see setBumpFeedback()).
		this.bumpFeedback = true;
		// Whether W A S D, R and F work as well as the arrows and Page Up/Down (see setLetterKeys()).
		this.letterKeys = true;
		// This engine needs a script tag in the root html page.
		// Find it. Assert if it can't be found.
		this.styleSheet =  [...document.styleSheets].filter((x)=>x.href==null).pop();
	}

	selectRandomTag(object, tag){
		const choices = Object.values(object).filter(x=>x.tags.includes(tag));
		if (choices.length > 0) {
			return choices[this.generateInt(choices.length)];
		}
		return undefined;
	}

	// The look (wall, floor and ceiling classes) of the region the cell at this row and column is in.
	cellLook(floor, row, column) {
		return this.regionLooks[floor][this.regions[floor][row][column]];
	}

	// The CSS class for the walls of the cell at this row and column.
	wallTile(floor, row, column) {
		return this.cellLook(floor, row, column).wall;
	}

	// The CSS class for the floor of the cell at this row and column, or '' when no floor images were loaded.
	floorTile(floor, row, column) {
		return this.cellLook(floor, row, column).floor;
	}

	// The CSS class for the ceiling of the cell at this row and column, or '' when no ceiling images were loaded.
	ceilingTile(floor, row, column) {
		return this.cellLook(floor, row, column).ceiling;
	}

	/*
	Add a look that regions of the maze can have: a wall image paired with a floor image, both
	given by the name used in loadWall (and optionally a ceiling image). Any pair that looks good
	together may be loaded; a wall or floor can be in as many pairs as you like.
	*/
	loadLook(look) {
		this.looks.push(look);
	}

	// The looks to use: the ones loaded, or else every wall image with every floor image.
	availableLooks() {
		const classes = (look) => ({
			wall: look.wall ? `wall_${look.wall}` : '',
			floor: look.floor ? `floor_${look.floor}` : '',
			ceiling: look.ceiling ? `ceiling_${look.ceiling}` : '',
		});
		if (this.looks.length > 0) return this.looks.map(classes);
		const walls = this.walls.filter(w=>w.tags.includes('wall')).map(w=>w.name);
		const floors = this.walls.filter(w=>w.tags.includes('floor')).map(w=>w.name);
		return walls.flatMap(wall => (floors.length ? floors : [null]).map(floor => classes({wall, floor})));
	}

	loadWall(wall){
		/*
		{
			name: name of the image
			css: css definition for this wall
			tags: array of possible use locations: wall, ceiling, or floor. An image with the wall tag
			      is used for walls, with floor for the floor of each cell, and with ceiling for the
			      ceiling (it can have several).
		}
		*/
		this.walls.push(wall);
	}
	
	loadItem(item){
		/*
		{
			name: name of the item
			initials: short version of name. Used as keys for colorblind aid.
			src: The location of the maze-rendered item image. 375 x 375
			invsrc: The location of the inventory image for this item.
			css: css definition for this item. Added to both maze and inventory html.			
			tags: array of possible uses: key, treasure, equipment.
			doorcolor: if 'key' is a tag, this is the color the door should be on the map.
		}
		*/
		this.items.push(item);
	}
	
	loadDoor(door){
		/*
		{
			css: css definition for this door
			tags: array of possible ways to open. Must be defined in openDoorFxns.
		}
		*/
		this.doors.push(door);
	}
	
	loadClip(clip){
		/*
		{
			url: url to clip
			tags: array of possible uses: maze, effect, combat, combat_win, game_win, game_loss, ladder, wall, close, door, pickup
		}
		*/
		this.clips.push(clip);
	}
	
	debug(value) {			
		this._debug = value;		
		var border = this._debug ? "2px black solid" : "2px transparent none";
		this.maze.cellList.map(x=>x.map.css({"border": border}));
		if (value) {
			const div=$('<div>').css({display:"flex"});
			this.mapHtml.forEach(function (x){
				div.append(x);
				div.append($('<div>').css({width:'10px'}));
			});
			$('body').prepend(div);
			this.mapList = div
		}
		else {
			this.mapHtml.remove();
			delete this.mapList;
		}
	}

	generateMapHtml(){		
		function newCell() {
			return $('<div>').addClass('mapCell').html('&nbsp;');
		}
		const mapHtml = [];
		// Define a data structure for entrance markers.
		this.entranceGrid = [];
		// Create the HTML structure.
		for (var f = 0; f < this.maze.floors; ++f) {
			// Setup the floor entrance grid.
			const eg = {'N':[],'S':[],'E':[],'W':[]};
			this.entranceGrid.push(eg);
			// Add floor.
			const floorContainer = $('<div>').addClass('floorMapContainer');
			const floorElement = $('<div>').addClass('floorMapTitle').text("Floor " + (f+1));
			floorContainer.append(floorElement);
			mapHtml.push(floorContainer);
			const mapContainer = $('<div>').addClass('floorMapContent').css({'grid-template-columns': `repeat(${this.maze.columns + 2}, 1fr)`,'grid-template-rows': `repeat(${this.maze.rows + 2}, 1fr)`,'aspect-ratio': '1/1'});
			floorContainer.append(mapContainer);
			// Add north entrance cells.
			mapContainer.append(newCell());
			for (var c = 0; c < this.maze.columns; ++c) {
				const cell = newCell();
				//northEntrance.append(cell);
				mapContainer.append(cell);
				eg.N.push(cell);
			}
			mapContainer.append(newCell());
			// Now start core map cells.
			for (var r = 0; r < this.maze.rows; ++r) {
				// Add row
				const westEntrance = newCell();
				mapContainer.append(westEntrance);
				eg.W.push(westEntrance);
				for (var c = 0; c < this.maze.columns; ++c) {
					// Add cell
					const cell = newCell();					
					mapContainer.append(cell);
					// Update grid to contain HTML.
					this.maze.grid[f][r][c].map = cell;					
				}	
				const eastEntrance = newCell();
				mapContainer.append(eastEntrance);
				eg.E.push(eastEntrance);
			}
			// Add south entrance cells.
			mapContainer.append(newCell());
			for (var c = 0; c < this.maze.columns; ++c) {
				const cell = newCell();
				mapContainer.append(cell);
				eg.S.push(cell);
			}
			mapContainer.append(newCell());
		}
		// Create flat entrance cell list.
		this.entranceGridList = this.entranceGrid.map(x=>Object.values(x)).flat(2);
		return mapHtml;
	}

	renderMapWall(cell, dir) {
		const wallValue = cell.data[dir];
		const openValue = cell.play[dir];
		if (dir in dirCss){
			var color;
			switch (wallValue) {
				case null:
					color = 'transparent none';
					break;
				case 0:
				case 1:
					color = openValue ? 'transparent none' : (wallValue ? (this.highContrast ? '3px #FFFFFF dashed' : doors[wallValue].map) : (this.mapIsDark() ? '3px #FFFFFF solid' : doors[wallValue].map));
					break;
				default:					
					color = openValue ? 'transparent none' : (this.keyList ? `${this.highContrast ? 4 : 3}px ${this.highContrast ? this.keyList[wallValue].hcColor : this.keyList[wallValue].doorcolor} solid` : doors[wallValue].map);
					break;
			}			
			// Update the wall on the map.
			cell.map.css(dirCss[dir], color);
		}
		if (dir in dirClass){
			if (wallValue === null){
				// Add a stair to the map.
				cell.map.addClass(dirClass[dir]);
				//cell.map.css('color', color);
			}
			else{
				// Remove a stair from the map. This used to compare the whole class attribute,
				// which never matched because the cell also has the mapCell class.
				// Remove only the icon class: 'fas' may belong to another icon in this cell.
				cell.map.removeClass(dirClass[dir].split(' ').pop());
			}
		}
	}
	
	// Debug helpers for the generator, so mazegen.js does not need this file's globals.
	debugKeyColor(key) {
		// doors[0] and doors[1] are walls and plain doors; key colours start at 2 and repeat.
		return doors[2 + (key - 2) % (doors.length - 2)].key;
	}

	renderMapDebugKey(cell, key, css = {}) {
		this.renderMapDebug(cell, null, Object.assign({'color': this.debugKeyColor(key)}, css), null, keyClass);
	}

	renderMapDebug(cell, dir = null, css = null, text = null, addClass = null) {
		if (dir) {
			this.renderMapWall(cell, dir);
		}
		if (css && Object.values(css).length > 0) {
			cell.map.css(css);
		}
		if (text) {
			cell.map.text(text);
		}
		if (addClass) {
			cell.map.addClass(addClass);
		}
	}	
	
	renderMapCell(cell) {
		if (this._debug || cell.play.visited) {
			cell.map.html('&nbsp;').css('background-color', this.mapIsDark() ? 'black' : 'white').addClass('mapCell');
			for (const dir of ['N','S','E','W','U','D']) {
				this.renderMapWall(cell, dir);
				const nextCell = this.maze.getNextCell(cell, dir);
				if (nextCell && nextCell.data[opposite[dir]] != cell.data[dir] && cell.data[dir] == null &&
					(this._debug || nextCell.play.visited)) {
					cell.map.addClass(oneWayWallClass[dir]);
				}
			}
			if (this._debug && 'key' in cell.data.item) {
				cell.map.addClass(keyClass).css('color',this.debugKeyColor(cell.data.item.key));					
			}
		}
		else {
			cell.map.html('&nbsp;').css({'background-color': this.mapIsDark() ? '#444444' : 'gray', 'border':'2px transparent none'}).removeClass().addClass('mapCell');
		}
	}
	
	renderMap() {
		for (const cell of this.maze.cellList) {
			this.renderMapCell(cell);
		}
		if (this._debug) {
			for (const e in this.maze.entranceList) {
				const ent = this.maze.entranceList[e];
				// Update the entrance grid.
				this.entranceGrid[ent.floor][ent.dir][ent.pos].css({'background-color':'#FFF'}).addClass(entranceClass[ent.dir]).text(parseInt(e)+1);
			}
		}
		
	}

	renderMapCursor(cell, dir = null) {
		if (dir) {
			cell.map.css('background-image',`url(${this.assetRoot}img/misc/pc_${dir}.png)`);
		}
		else {
			cell.map.css('background-image','');
		}
	}
	
	debugResetToEmpty() {
		this.maze.cellList.forEach(cell => cell.map.html('&nbsp;'));
	}
	
	debugResetToStack(stack) {
		this.debugResetToEmpty();
		stack.forEach(cell => cell.map.text(cell.work.dist));
	}
	
	debugResetToDist(){
		this.maze.cellList.forEach(c => c.map.text(c.work.dist));
	}
	
	debugEntranceGrid(f, dir, pos, number){
		this.entranceGrid[f][dir][pos].css({'background-color':'#FFF'}).addClass(entranceClass[dir]).text(number);
	}
	
	debugOneWayArrow(cell, dir) {
		cell.map.addClass(oneWayWallClass[dir]);
	}

	generateMazeHtml() {
		const html = [];
		for (var floor = 0; floor < this.maze.floors; ++floor) {
			const floorDiv = $('<div>').addClass('mazeFloor');
			html.push(floorDiv);
			for (var row = 0; row < this.maze.rows; ++row) {
				for (var column = 0; column < this.maze.columns; ++column) {
					const cell = this.maze.grid[floor][row][column];
					const px = 100 * column; // left-right
					const pz = 100 * row; // front-back
					const contents = $('<div>').addClass('offset contents').css('transform', `translate3d(${px}vmin, 0vmin, ${pz}vmin)`);
					const fTile = $('<div>').addClass(`offset floor ${this.floorTile(floor, row, column)}`).css('transform', `translate3d(${px}vmin, 50vmin, ${pz}vmin) rotateX(90deg)`);
					const cTile = $('<div>').addClass(`offset ceiling ${this.ceilingTile(floor, row, column)}`).css('transform', `translate3d(${px}vmin, -50vmin, ${pz}vmin) rotateX(90deg)`);
					cell.html={contents:contents,floor:fTile,ceiling:cTile};
					const entrance = this.maze.entranceList.filter(e=>e.cell === cell);
					for (const dir of ['N','E','S','W']) {
						// Default orientation is facing north at 0,0.						
						//const px = 100 * column + 50 * dx[dir]; // left-right
						//const pz = 100 * row + 50 * dy[dir]; // front-back
						// py is the floor, not used here.
						const ry = wallRotate[dir];
						const css = `translate3d(${px+ 50 * dx[dir]}vmin, 0vmin, ${pz+ 50 * dy[dir]}vmin) rotateY(${ry})`;
						const elem = $('<div>').addClass('offset tile').css('transform', css);
						const wallCss = this.wallTile(floor, row, column);
						floorDiv.append(elem);
						// Store this element for manipulation.
						cell.html[dir] = elem;
						switch (cell.data[dir]) {
							case null: //opening
								// Is to outside?
								if (entrance.length > 0 && entrance[0].dir == dir) {
									elem.addClass('outside');
								}
								else {
									elem.addClass('opening');
								}
								break;
							case 0: //wall
								elem.addClass(wallCss);
								break;
							default: //door
								//const css = `hue-rotate(${cell.data[dir] * 24 - 48}deg)`;
								const key = cell.data[dir];
								const holeyWall = $('<div>').addClass(`${wallCss} doorwall`);
								elem.append(holeyWall);
								openDoorFxns['split'].new(elem, key, this.keyList[key].initials);
								/*
								//const keyName = `#${cell.data[dir]-1}`;
								//const door_a = $('<div>').css({filter: css}).addClass('door door_a').text(keyName);
								const door_a = $('<div>').addClass(`door door_a door_${key}`);
								door_a.append($('<div>').addClass('doortitle').text(this.keyList[key].initials));
								elem.append(door_a);
								//const door_b = $('<div>').css('filter', css).addClass('door door_b').text(keyName);
								const door_b = $('<div>').addClass(`door door_b door_${key}`);
								door_b.append($('<div>').addClass('doortitle').text(this.keyList[key].initials));								
								elem.append(door_b);
								*/
						}
					}
					floorDiv.append(contents);
					floorDiv.append(fTile);
					floorDiv.append(cTile);
					// Add ladders and other cell contents.
					for (const dir of ['U','D']) {
						if (cell.data[dir] === null) {
							const elem = $('<div>').addClass(`item ladder ladder_${dir}`);
							contents.append(elem);
							const hole = dir == 'U' ? cTile : fTile;
							hole.addClass('hole');
						}
					}
					// Add key
					if (cell.data.item.key) {
						//const elem = $('<div>').addClass('item key').css('filter',`hue-rotate(${cell.data.item.key * 24 - 48}deg)`);
						const elem = $('<div>').addClass(`item key key_${cell.data.item.key}`).attr('data-initials', this.keyList[cell.data.item.key].initials);
						contents.append(elem);
					}
				}
			}			
		}
		// Add entrnaces that look like they are outside.
		
		for (var entrance of this.maze.entranceList) {
			const [f, r, c] = entrance.cell.loc;
			const x = c + dx[entrance.dir];
			const y = r + dy[entrance.dir];
			const px = 100 * x; // left-right
			const pz = 100 * y; // front-back
			const fTile = $('<div>').addClass('offset outside floor').css({'transform': `translate3d(${px}vmin, 50vmin, ${pz}vmin) rotateX(90deg)`,'background-color':'#7CFC00'});
			const cTile = $('<div>').addClass('offset outside ceiling').css({'transform': `translate3d(${px}vmin, -50vmin, ${pz}vmin) rotateX(-90deg)`,'background-color':'skyblue'});
			html[f].append(fTile);
			html[f].append(cTile);
			for (const dir of ['N','E','S','W']) {
				if (dir != opposite[entrance.dir]) {
					const ry = wallRotate[dir];
					const css = `translate3d(${px+ 50 * dx[dir]}vmin, 0vmin, ${pz+ 50 * dy[dir]}vmin) rotateY(${ry})`;
					const tile = $('<div>').addClass('offset outside ceiling').css({'transform':css, 'background-color':'skyblue'});
					html[f].append(tile);
				}
			}
		}
		
		return html;
	}

	setItemHtmlRotation(degrees) {
		this.cssRules.item.style.transform = `rotateY(${-degrees}deg)`;
		/*
		// This searches for the .item CSS rule and updates it to rotate by the degrees variable.
		if (!this.cssRule) {
			// Find the stinking rule
			for (const styleSheet of document.styleSheets){
				if (styleSheet.href && styleSheet.href.endsWith('/css/maze.css')) {
					try {
						for (const rule of styleSheet.cssRules){
							if (rule.selectorText && rule.selectorText == '.item') {
								this.cssRule = rule;
								break;
							}
						}
					}
					catch{}
				}	
			}
		}
		if(this.cssRule) {
			this.cssRule.style.transform = `rotateY(${-degrees}deg)`;
		}
		*/
	}
	
	// Show or hide the touch buttons: 'auto' shows them where the device has a touch screen
	// (iPads included, whatever orientation they are held in), 'on' always, 'off' never.
	setTouchControls(mode) {
		this.touchControls = mode;
		const show = mode == 'on' || (mode != 'off' && navigator.maxTouchPoints > 0);
		$('#maze').toggleClass('touchOn', show);
	}

	// How touches act, see touchStyle: 'taps', 'swipes' or 'both'. Can change while playing.
	setTouchStyle(style) {
		this.touchStyle = ['swipes', 'both'].includes(style) ? style : 'taps';
	}

	// Which way a swipe points, see swipeDirection: 'point' or 'drag'. Can change while playing.
	setSwipeDirection(direction) {
		this.swipeDirection = direction == 'drag' ? 'drag' : 'point';
	}

	// Which side strip scrolls the page when the map is below the maze: 'left' or 'right'.
	// The stylesheet reads the class this sets; the touch code reads scrollSide.
	setScrollSide(side) {
		this.scrollSide = side == 'left' ? 'left' : 'right';
		$('#maze').toggleClass('scrollLeft', this.scrollSide == 'left').toggleClass('scrollRight', this.scrollSide == 'right');
	}

	// True when the page puts the map below the maze (the same screens the stylesheet switches
	// to portrait for), so the page can scroll under a finger on the touch buttons.
	mapIsBelow() {
		return window.matchMedia('screen and (max-width: 140vh)').matches;
	}

	/*
	Draw the maze in solid, strongly contrasting colors instead of textured art (an accessibility
	option). The stylesheet does the drawing: this only sets the class `highContrast` on the page,
	which ui/css/maze.css and the per-key rules made in playGame() key off. It can be changed while
	playing; the map is drawn again because it picks its colors in script.
	*/
	setHighContrast(on) {
		this.highContrast = !!on;
		document.documentElement.classList.toggle('highContrast', this.highContrast);
		if (this.maze && this.maze.cellList.every(cell => cell.map)) {
			this.renderMap();
		}
	}

	// True when the map is drawn dark: by its own option or because high contrast is on.
	mapIsDark() {
		return this.highContrast || this.darkMap;
	}

	/*
	Draw only the map dark: black explored cells with white walls on dark grey unexplored cells. Doors keep their colors.
	Walls show up more clearly than on the light map. Turned on by setHighContrast() too, which
	also changes the maze itself. Sets the class `darkMap` on the page for the stylesheet, and
	draws the map again because it picks its colors in script.
	*/
	setDarkMap(on) {
		this.darkMap = !!on;
		document.documentElement.classList.toggle('darkMap', this.darkMap);
		if (this.maze && this.maze.cellList.every(cell => cell.map)) {
			this.renderMap();
		}
	}

	/*
	The Comfort option, for players who feel motion sick: dark edges around the view, turns that
	fade through dark instead of sweeping the picture past, and ladder climbs without the dip
	before the rise. Every animation keeps its length, so the pace of the game, which the server
	checks, does not change. Sets the class `mazeComfort` on the page for the stylesheet.
	Can change while playing.
	*/
	setComfort(on) {
		this.comfort = !!on;
		document.documentElement.classList.toggle('mazeComfort', this.comfort);
	}

	// Bump feedback: a press that would do nothing (a wall, a locked door, no ladder) gives the
	// view a small shake, or an edge flash with Comfort on. It costs no move. On unless turned off.
	setBumpFeedback(on) {
		this.bumpFeedback = !!on;
	}

	// Letter keys: W A S D walk and turn, R climbs up, F climbs down, alongside the arrows and
	// Page Up/Down. On unless turned off, for a page that needs those letters for something else.
	setLetterKeys(on) {
		this.letterKeys = !!on;
	}

	generateGameUi(rootNodeId, helpFxn = null) {
		this.rootNode = $(`#${rootNodeId}`);
		const gameUi = $(`
  <div id="maze">
	  <div class="viewport">
		<div id="mazeRotate" class="mazeRotate" style="transform: translate(-50%,-50%);">
		  <div id="mazeTranslate" class="mazeTranslate">
		  </div>
		</div>
	  <div class="comfortLayer"></div>
	  <div class="touchNav" id="touchShow">Show</div>	  
		<div id="touchNav">
		  <div class="touchNav" id="touchFwd">Forward</div>
		  <div class="touchNav" id="touchBack">Backward</div>
		  <div class="touchNav" id="touchLeft">Left</div>
		  <div class="touchNav" id="touchRight">Right</div>
		  <div class="touchNav" id="touchUp">Up</div>
		  <div class="touchNav" id="touchDown">Down</div>	  
		  <div class="touchNav" id="touchHide">Hide</div>	  
		</div>
	  </div>
  </div>
  <div class="info">
  <div id="map" class="mazemap"></div>
  <div id="status" class="textWindow statusWindow">
	<div id="help" class="fa fa-cog icon"></div>
	<div id="gamevolup" class="icon">&#x1F50A</div>
	<div id="gamemute" class="icon">&#x1F4E2</div>
	<div id="gamevoldn" class="icon">&#x1F509</div>  
    <div id="moves">Moves: 0</div>
    <div><br />Inventory
	<div id="inventory" class="d-flex flex-wrap overflow-auto"></div>	
	</div>
  </div>
  </div>
`);
`
<!--<div id="directions">
<br />
Directions:<br />
&uarr; Forward/Open<br />
&larr; Turn Left<br />
&rarr; Turn Right<br />
&darr; Backward<br />
PgUp Climb<br />
PgDn Descend<br />		
</div>-->
`
		this.rootNode.append(gameUi);
		this.setTouchControls(this.touchControls);
		this.setScrollSide(this.scrollSide);
		this.mapHtml = this.generateMapHtml();
		if (helpFxn) {
			this.helpFxn = helpFxn;
			$('#help').click(function(){helpFxn({state:'help'})});
		}
		var myThis = this;
		$("#gamemute").click(function(){setAudioState(!getAudioState());myThis.setVolUI();setVolume()});
		$("#gamevolup").click(function(){updateVolume(10);});
		$("#gamevoldn").click(function(){updateVolume(-10);});
	}

	setVolUI(){
		if (getAudioState()){
			$("#gamevolup,#gamevoldn,#gamemute").removeClass('disabledicon');
		}
		else {
			$("#gamevolup,#gamevoldn,#gamemute").addClass('disabledicon');
		}
	}

	getClip(tag) {
		let choice = this.selectRandomTag(this.clips, tag);
		if (choice) {
			return new Audio(choice.url);
		}
		return null;
	}
	
	/*
	Slow-motion for the animations (turns, steps, ladders, doors). speed is a share of the usual
	pace: 1 is normal, 0.5 is half speed. It can go down to 0.25 but never above 1: the server
	treats moves quicker than the usual animations as impossible, so a faster game would be flagged.
	Takes effect from the next animation, so it can be changed while playing.
	*/
	setAnimationSpeed(speed) {
		const share = Math.min(1, Math.max(0.25, Number(speed) || 1));
		this.slowFactor = 1 / share;
		// The stylesheet reads this for the durations it sets itself (see ui/css/maze.css).
		document.documentElement.style.setProperty('--maze-slow', String(this.slowFactor));
	}

	/*
	Starts the game on this maze. winFunc and loseFunc are kept for the page's own use.

	options lets a game with its own rules (see generator/gamelayer.js) use this first-person view
	without the view knowing anything about those rules. All of them are optional; with none, this is the classic game.
		player            An object with MazePlayer's interface (x, y, z, dir, moves, actions, times, canAct, act)
		                  to play instead of a new MazePlayer. A game layer passes its own game's player.
		act(action, time) Does one action and answers what MazePlayer.act answers ({type, ...} or null for a bump).
		                  A game layer routes the action through its own rules here (a fight may refuse a step).
		canAct(action)    Whether the action would do something now; decides which touch buttons show.
		onAction(action, result)  Called when an action is accepted, before its animation starts.
		onSettled()       Called each time the view is standing still again after an action.
	While playing, mazehtml.syncPlayer() snaps the view to where the player now is. A game calls it after it moves the
	player itself (a flee, a teleport), which no action of this view animated.
	*/
	playGame(winFunc = null, loseFunc = null, options = {}) {
		const mapElement=$('#map');
		const mazeElement=$('#maze');
		const mazeTranslateElement=$('#mazeTranslate');
		const mazeRotateElement=$('#mazeRotate');
		const maze = this.maze;
		const mazehtmlui = this;
		// A duration in milliseconds, stretched by the animation speed setting.
		const ms = n => `${Math.round(n * mazehtmlui.slowFactor)}ms`;

		// Between the time the UI was made and now, the maze could have been generated.
		// Define the visual characteristics of the maze.

		// Now update css for the game.
		// Create the .item class.
		let item = this.styleSheet.insertRule(`.item {height:100vmin; width:100vmin;transition: transform calc(0.5s * var(--maze-slow, 1));background-size: contain;}`);
		this.cssRules = {
			item: this.styleSheet.cssRules[item]
		}

		// Walls
		// Load in wall resources
		// An image tagged both wall and floor gets a rule for each use.
		for (const wall of this.walls){
			for (const use of ['wall', 'floor', 'ceiling']) {
				if (!wall.tags.includes(use)) continue;
				const name = `${use}_${wall.name}`;
				const item = this.styleSheet.insertRule(`.${name} {${wall.css}}`);
				this.cssRules[name] = this.styleSheet.cssRules[item];
			}
		}
		// Cut each maze floor into regions and give each region its look (see lookRegions).
		this.regions = lookRegions(this.maze, this.seed, this.regionSize);
		this.regionLooks = lookAssign(this.maze, this.regions, this.availableLooks(), this.seed);
		// Looks without a ceiling of their own take a loaded ceiling image, if any, by region.
		const ceilings = this.walls.filter(w=>w.tags.includes('ceiling')).map(w=>`ceiling_${w.name}`);
		this.regionLooks = this.regionLooks.map((floorLooks, f) => floorLooks.map((look, r) => look.ceiling || !ceilings.length ? look :
			{...look, ceiling: ceilings[Math.floor(varietyRoll(this.seed, 'ceiling', f, r) * ceilings.length)]}));

		// Keys and Doors
		// Generate one key for each key in the maze.		
		const keyCells = maze.cellList.filter(c=>c.data.item.key);
		const shuffledKeys = this.items.filter(x=>x.tags.includes('key'))
			.map(value => ({ value, sort: this.generator() }))
			.sort((a, b) => a.sort - b.sort)
			.map(({ value }) => value);
		this.keyList = {};
		// One extra deal covers the keyless doors, if the maze has any.
		const doorDeal = varietyDeal(this.doors.length, keyCells.length + 1, this.seed, 'door');
		let doorsMade = 0;
		// Picks how the door for lock number `key` looks and opens, and adds its css.
		const addDoorStyle = (key, keyObj) => {
			// Pick the door type for this lock. Doors are dealt out so a maze shows as many looks as it can.
			const door = this.doors[doorDeal[doorsMade++]];
			// Pick a door function and tag this door with it.
			keyObj.open = door.tags[this.generateInt(door.tags.length)];
			// Create the door css
			const door_name = `door_${key}`;
			const door_css = this.styleSheet.insertRule(`.${door_name} {${door.css}}`);
			this.cssRules[door_name] = this.styleSheet.cssRules[door_css];
			if (key > 1) {
				// The look high contrast mode gives this lock, its door, its key and its inventory icon.
				const look = highContrastLook(key);
				keyObj.hcColor = look.color;
				const hc_css = this.styleSheet.insertRule(`.highContrast .${door_name}, .highContrast .key_${key}, .highContrast .inv_${key} {--hc-color: ${look.color}; --hc-image: ${look.image}; --hc-size: ${look.size};}`);
				this.cssRules[`${door_name}_hc`] = this.styleSheet.cssRules[hc_css];
			}
			return door_name;
		};
		if (keyCells.length > shuffledKeys.length) {
			console.log(`The maze has ${keyCells.length} keys but only ${shuffledKeys.length} key items were loaded. Reusing items.`);
		}
		for (var i = 0, j = 0; i < keyCells.length; ++i) {
			// i = lock number
			// j = key item
			// i == 1 gets NO key item.

			// Get the lock number
			const key = keyCells[i].data.item.key;
			// Create a construct for the needed key.
			// Copy the item: open is set per door below, and two doors may share one item.
			const keyObj = key == 1 ? {} : Object.assign({}, shuffledKeys[j++ % shuffledKeys.length]);
			// Store this key data
			this.keyList[key] = keyObj;
			const door_name = addDoorStyle(key, keyObj);
			// Check if the door actually needs a key.
			if (key > 1){
				// Create the key css
				const door_after_css = this.styleSheet.insertRule(`.${door_name}::after {background-image:url(${keyObj.invsrc}); ${keyObj.css}}`);
				this.cssRules[`${door_name}_after`] = this.styleSheet.cssRules[door_after_css];
				const key_name = `key_${key}`;
				const key_css = this.styleSheet.insertRule(`.${key_name} {background-image:url(${keyObj.src}); ${keyObj.css}}`);
				this.cssRules[key_name] = this.styleSheet.cssRules[key_css];
			}
		}
		// Plain doors (side value 1) open without a key, so no cell holds key 1 and the loop
		// above never gives them an entry. Give them one, drawn like any other door.
		// Only mazes that have plain doors get here, so other mazes draw exactly as before.
		const hasPlainDoors = maze.cellList.some(c => ['N','S','E','W'].some(dir => c.data[dir] === 1));
		if (hasPlainDoors && !this.keyList[1]) {
			this.keyList[1] = {initials: ''};
			addDoorStyle(1, this.keyList[1]);
		}


		// Generate maze HTML.
		const mapHtml = this.mapHtml;
		const mazeHtml = this.generateMazeHtml();
		if (!this.music) {
			this.music = this.getClip('maze');
		}
		setMusic(this.music);
		this.setVolUI();
		
		// Attach events.
		// Display the map ready for play
		var [pZ, pY, pX] = maze.entranceList[0].cell.loc;
		var pDir = opposite[maze.entranceList[0].dir];
		var pDeg = { 'E': 90, 'W': -90, 'N': 0, 'S': 180}[pDir];
		var animationState = false;
		var mayProcessAction = true;
		var alertTimeout = null;
		// The game's rules: where the player is, keys held, moves made.
		const player = options.player ?? new MazePlayer(maze, gameDebug);
		this.player = player;
		// What a game layer may replace: how an action is done, and whether it would do anything.
		const canAct = options.canAct ?? (action => player.canAct(action));
		const doAction = options.act ?? ((action, time) => player.act(action, time));
		// True while an action is animating and the next key press has to wait.
		this.isBusy = () => !!animationState || !mayProcessAction;
		// A key picked up by the last action, shown when its animation ends.
		var pendingKey = null;
		// Each move's time is recorded as milliseconds since the game began.
		const startTime = Date.now();
		const eventQueue = [];
		const keyPressed = {};
		// The game looks at the buttons ten times a second. A touch button tapped and let go
		// between two looks was never seen as held and the tap was lost, so a quick tap is
		// remembered here until the next look.
		let tappedKey = null;
		function nextKey() {
			const held = Object.keys(keyPressed);
			if (held.length == 1) {
				tappedKey = null;
				return held[0];
			}
			if (held.length == 0 && tappedKey) {
				const key = tappedKey;
				tappedKey = null;
				return key;
			}
			return null;
		}
		var gameLoopThread = null;
		var gameOver = null;
		// An instance variable for checking outside of the object.
		this.gameOver = false;
		// Local this variable
		const localThis = this;
		

		// Draws only the cells that can be seen from here (see visibleCells). Cells out of sight
		// are hidden: every drawn wall, floor and ceiling costs a phone graphics memory.
		// With cullBack, a wall that faces away from the player (a cell's wall on the player's own side
		// of it) is hidden too: only its back could be seen. That is saved for when the player stands
		// still, because a step passes through a doorway whose walls are still in front for half of it.
		function hideOutOfRangeCells(cx, cy, cz, range, cullBack = false){
			const visible = visibleCells(maze, cz, cy, cx, range);
			for(var y = 0; y < maze.rows; ++y){
				for(var x = 0; x < maze.columns; ++x){
					const html = maze.grid[cz][y][x].html;
					if (visible.has(y * maze.columns + x)) {
						Object.values(html).forEach(x => x.show());
						if (cullBack) {
							html.N.toggle(!(cy < y));
							html.S.toggle(!(cy > y));
							html.W.toggle(!(cx < x));
							html.E.toggle(!(cx > x));
						}
						// Only the ground near the player carries its image (see textureRange).
						const far = Math.max(Math.abs(x - cx), Math.abs(y - cy)) > localThis.textureRange;
						html.floor.toggleClass('far', far);
						html.ceiling.toggleClass('far', far);
					}
					else {
						Object.values(html).forEach(x => x.hide());
					}
				}
			}
		}

		function gameLoop(){
			var endAnimation = false;
			while (eventQueue.length > 0) {
				const event = eventQueue.shift();
				switch (event) {
					case 'trapEntrance':
						const wall = $('.trapEntrance');
						wall.removeClass('trapEntrance').css({transition:`transform steps(5, jump-both) ${ms(2000)}`,transform: 'translate3d(-50vmin, -50vmin, 0vmin)'});
						// Play the sound
						playSound(localThis.getClip('close'));
						// Set the state.
						animationState='entranceTrap';		
					case 'animationStop':				
						endAnimation = true;
						break;
					case 'keyup':
						// Let go, so the next press that bumps shows it again.
						bumped = false;
						break;
					case 'keydown':
					default:
						break;
				}
			}
			if (endAnimation) {
				mayProcessAction = processEndAnimation();
			}
			if (mayProcessAction) {
				const key = nextKey();
				if (key) {
					mayProcessAction = processKeyPress(key);
				}
			}
		}

		// A touch button is shown exactly when pressing it would do something, so the
		// buttons that would only bump a wall or a locked door are hidden. The rules
		// answer through player.canAct(). Left and right always work, so they never hide.
		// A hidden button is still there to catch taps; it only stops being drawn.
		const touchButtonActions = { touchFwd: 'F', touchBack: 'B', touchUp: 'U', touchDown: 'D' };
		function updateTouchButtons() {
			for (const [id, action] of Object.entries(touchButtonActions)) {
				$(`#${id}`).toggleClass('touchBlocked', !canAct(action));
			}
			// With no ladder, Forward takes over the empty Up or Down band (see ui/css/maze.css).
			$('#touchNav').toggleClass('noUp', !player.canAct('U')).toggleClass('noDown', !player.canAct('D'));
		}

		// Run the CSS animation that hangs on `cls` for `duration` ms, starting it again if it ran a
		// moment ago: taking the class off and reading the size makes the browser forget the last run.
		const animationTimers = {};
		function restartAnimation(element, cls, duration) {
			clearTimeout(animationTimers[cls]);
			element.removeClass(cls);
			void element[0].offsetWidth;
			element.addClass(cls);
			animationTimers[cls] = setTimeout(() => element.removeClass(cls), duration);
		}

		// Bump feedback (see setBumpFeedback). A held key bumps once; letting go of it, or a
		// press that works, lets the next one show.
		let bumped = false;
		function bump() {
			if (!localThis.bumpFeedback || bumped) {
				return;
			}
			bumped = true;
			restartAnimation(mazeElement.find('.viewport'), 'bump', 250);
		}

		function processKeyPress(key) {
			const action = keyActions[key];
			if (!action) {
				return true;
			}
			// Get the current cell.
			const cell = maze.grid[pZ][pY][pX];
			// The rules decide what this key does. null means a bump, which costs nothing.
			const result = doAction(action, Date.now() - startTime);
			if (!result) {
				bump();
				return true; // May process more actions
			}
			bumped = false;
			// A key picked up here is shown once the animation ends.
			pendingKey = result.pickedUp || null;
			if (options.onAction) {
				options.onAction(action, result);
			}
			if (result.type == 'fall' && result.via == 'step') {
				// Stepping onto an unseen pit moves the player and drops them a floor in one action; there is no
				// animation for that, so show where they ended up.
				syncPlayer();
				return true;
			}
			switch (result.type) {
				case 'trap':
					// And the walls come tumbling down!
					const fauxWall = cell.html[pDir];
					const wallCss = localThis.wallTile(pZ, pY, pX);
					const wall = $('<div>').addClass(`offset tile ${wallCss} trapEntrance`).css('transform', 'translate3d(-50vmin, -150vmin, 0vmin)');
					fauxWall.append(wall);
					// Pop onto the event queue or it will not animate.
					eventQueue.push('trapEntrance');
					return false;
				case 'win':
					gameOver = {state:'win', moves:player.moves, cells:maze.floors * maze.columns * maze.rows, actions:player.actions, times:player.times};
					// Walk out through the exit.
					pX += dx[pDir];
					pY += dy[pDir];
					// The player is outside the maze now, so what is drawn stays as it is.
					mazeTranslateElement.css('transform',`translate3d(${-100*pX}vmin, 0vmin, ${-100*pY}vmin)`);
					animationState = 'forward';
					return false; // action in progress
				case 'door':
					const door = cell.html[pDir];
					cell.play[pDir] = true;
					const nextCell = maze.getNextCell(cell, pDir);
					const oDoor = nextCell.html[opposite[pDir]];
					nextCell.play[opposite[pDir]] = true;
					const anim = localThis.keyList[result.key].open;
					openDoorFxns[anim].open(door, oDoor);
					// What lies behind the door can be seen now.
					hideOutOfRangeCells(pX, pY, pZ, viewRange, true);
					// Open door
					animationState = 'door';
					// Play the sound
					playSound(localThis.getClip('door'));
					return false; // action in progress
				case 'turn':
					pDir = player.dir;
					pDeg += action == 'L' ? -90 : 90;
					// Comfort: the turn fades through dark (see ui/css/maze.css).
					if (localThis.comfort) {
						restartAnimation(mazeElement.find('.comfortLayer'), 'comfortTurn', 500 * mazehtmlui.slowFactor);
					}
					// Update the GUI
					mazeRotateElement.css('transform',`rotateY(${pDeg}deg) translate(-50%,-50%)`);
					mazehtmlui.setItemHtmlRotation(pDeg);
					animationState = action == 'L' ? 'left' : 'right';
					return false; // action in progress
			}
			// A move: forward, back, or a ladder.
			if (action == 'U' || action == 'D') {
				// Hide the map cursor
				mazehtmlui.renderMapCursor(cell);
				pZ = player.z;
				// Update the UI
				const lift = action == 'U' ? 100 : -100;
				animationState = action == 'U' ? 'up' : 'down';
				// The climb dips before it rises; Comfort leaves the dip out.
				const climb = localThis.comfort ? 'ease-in-out' : 'cubic-bezier(0.36, 0, 0.66, -0.56)';
				mazeTranslateElement.css({'transition':`transform ${climb} ${ms(1500)}`,'transform':`translate3d(${-100*pX}vmin, ${lift}vmin, ${-100*pY}vmin)`});
				// Play ladder sound
				playSound(localThis.getClip('ladder'));
				return false; // action in progress
			}
			pX = player.x;
			pY = player.y;
			// Update the GUI
			hideOutOfRangeCells(pX, pY, pZ, viewRange);
			mazeTranslateElement.css('transform',`translate3d(${-100*pX}vmin, 0vmin, ${-100*pY}vmin)`);
			animationState = action == 'F' ? 'forward' : 'backward';
			return false; // action in progress
		}

		function processEndAnimation() {
			// Update the move counter.	
			$('#moves').text(`Moves: ${player.moves}`);
			var lastCell, nextCell;
			switch (animationState) {
				case 'forward':
					if (gameOver && gameOver.state == 'win') {
						const alert = $('<div>').addClass('alertTop textWindow').html('You have escaped the maze.<br />YOU WIN!!!');
						mazeElement.append(alert);
						localThis.setGameOver(true);
						const music = localThis.getClip('game_win'); //new Audio('audio/win.mp3');
						setMusic(music, false);
						setTimeout(function(){localThis.removeGameUi(gameOver)}, 10000);
						return;
					}		
					// Update the visit flag for this cell.
					nextCell = maze.grid[pZ][pY][pX];
					// Also update for last cell.
					lastCell = maze.getNextCell(nextCell, opposite[pDir]);
					// No more animations.
					// Standing still now, so the walls behind can go.
					hideOutOfRangeCells(pX, pY, pZ, viewRange, true);
					animationState = false;
					break;
				case 'backward':
					// Update the visit flag for this cell.
					nextCell = maze.grid[pZ][pY][pX];
					// Also update for last cell.
					lastCell = maze.getNextCell(nextCell, pDir);
					// No more animations.
					// Standing still now, so the walls behind can go.
					hideOutOfRangeCells(pX, pY, pZ, viewRange, true);
					animationState = false;
					break;
				case 'left':
				case 'right':
					// Update the visit flag for this cell.
					nextCell = maze.grid[pZ][pY][pX];
					// No more animations.
					animationState = false;
					break;
				case 'up':
					mazeTranslateElement.css({'transition':'transform 1ms','transform':`translate3d(${-100*pX}vmin, -100vmin, ${-100*pY}vmin)`});
					mazeTranslateElement.empty();			
					animationState = 'up2';
					break;
				case 'up2':
					mapElement.empty().prepend(mapHtml[pZ]);
					mazeTranslateElement.prepend(mazeHtml[pZ]);
					hideOutOfRangeCells(pX, pY, pZ, viewRange, true);
					mazeTranslateElement.css({'transition':`transform ease-out ${ms(1500)}`,'transform':`translate3d(${-100*pX}vmin, 0vmin, ${-100*pY}vmin)`});
					animationState = 'up3';
					// Play ladder sound
					playSound(localThis.getClip('ladder'));
					break;
				case 'up3':
					mazeTranslateElement.css({'transition':''});
					mazehtmlui.renderMapCursor(maze.grid[pZ][pY][pX], pDir);
					animationState = false;
					// Update the visit flag for this cell.
					nextCell = maze.grid[pZ][pY][pX];
					break;
				case 'down':
					mazeTranslateElement.css({'transition':'transform 1ms','transform':`translate3d(${-100*pX}vmin, 100vmin, ${-100*pY}vmin)`});
					mazeTranslateElement.empty();			
					animationState = 'down2';
					break;
				case 'down2':
					mapElement.empty().prepend(mapHtml[pZ]);
					mazeTranslateElement.prepend(mazeHtml[pZ]);
					hideOutOfRangeCells(pX, pY, pZ, viewRange, true);
					mazeTranslateElement.css({'transition':`transform ease-out ${ms(1500)}`,'transform':`translate3d(${-100*pX}vmin, 0vmin, ${-100*pY}vmin)`});
					animationState = 'down3';
					// Play ladder sound
					playSound(localThis.getClip('ladder'));
					break;
				case 'down3':
					mazeTranslateElement.css({'transition':''});
					mazehtmlui.renderMapCursor(maze.grid[pZ][pY][pX], pDir);
					animationState = false;
					// Update the visit flag for this cell.
					nextCell = maze.grid[pZ][pY][pX];
					break;
				case 'door':
					// Update the door for this cell.
					nextCell = maze.grid[pZ][pY][pX];
					// Also update the door from the other side.
					lastCell = maze.getNextCell(nextCell, pDir);
					// No more animations.
					animationState = false;
				default: //everything else
					// No more animations.
					animationState = false;
			}
			if (nextCell) { 
				nextCell.play.visited = true;
				mazehtmlui.renderMapCell(nextCell); 
				mazehtmlui.renderMapCursor(nextCell, pDir);
			}
			if (lastCell) { 
				mazehtmlui.renderMapCursor(lastCell); 
			}
			
			// The state may have changed (a key, a door, a wall that fell), so redo the buttons.
			updateTouchButtons();

			// If there are no more animations, then process activity at this cell.
			if (!animationState && nextCell) {
				// Check for items
				if (pendingKey) {
					// The player already holds it; flag it as collected for the display.
					nextCell.play.item.key = true;
					pendingKey = null;
					// Hide the object in the maze.
					const keyHtml = nextCell.html.contents.children('.key');
					keyHtml.hide();
					// Add the key to the player's inventory.
					const key = nextCell.data.item.key;
					const keyObj = localThis.keyList[key];					
					const inv = $('<div>').addClass(`inventory inv_${key}`).text(keyObj.initials);
					inv.prepend($('<img>').addClass('inventory').attr('src',keyObj.invsrc)).attr('style',keyObj.css);
					$('#inventory').append(inv);
					// Display a notice.
					const alert = $('<div>').addClass('alertTop textWindow').text(`You have found ${keyObj.name}.`);
					alertTimeout = setTimeout(function () {
						alert.remove();
					}, 5000);
					mazeElement.append(alert);
					// Play pickup sound.
					playSound(localThis.getClip('pickup'));
				}		
				// Now process keypresses. 
				const key = nextKey();
				if (key) {
					// Process the remianing key.
					processKeyPress(key);
				}				
			}
			if (!animationState) {
				if (syncPending) {
					syncPlayer();
				}
				if (options.onSettled) {
					options.onSettled();
				}
			}
			return !animationState;
		}

		// Snaps the view to the player's position, direction and floor, with no animation. A game layer calls this
		// (as mazehtml.syncPlayer()) after it moves the player itself. While an animation runs it waits for the end.
		var syncPending = false;
		function syncPlayer() {
			if (animationState) {
				syncPending = true;
				return;
			}
			syncPending = false;
			const floorChanged = player.z != pZ;
			const previous = maze.grid[pZ][pY][pX];
			pX = player.x;
			pY = player.y;
			pZ = player.z;
			pDir = player.dir;
			// Turn the short way round: keep pDeg within half a turn of the direction's own angle.
			const target = { 'E': 90, 'W': -90, 'N': 0, 'S': 180 }[pDir];
			pDeg = target + 360 * Math.round((pDeg - target) / 360);
			mazeTranslateElement.css('transition', 'none');
			mazeRotateElement.css('transition', 'none');
			if (floorChanged) {
				mapElement.empty().prepend(mapHtml[pZ]);
				mazeTranslateElement.empty().prepend(mazeHtml[pZ]);
			}
			mazeTranslateElement.css('transform', `translate3d(${-100*pX}vmin, 0vmin, ${-100*pY}vmin)`);
			mazeRotateElement.css('transform', `rotateY(${pDeg}deg) translate(-50%,-50%)`);
			localThis.setItemHtmlRotation(pDeg);
			hideOutOfRangeCells(pX, pY, pZ, viewRange, true);
			// Let the browser apply the snap before the normal transitions come back.
			mazeTranslateElement[0] && mazeTranslateElement[0].offsetWidth;
			mazeTranslateElement.css('transition', '');
			mazeRotateElement.css('transition', '');
			const here = maze.grid[pZ][pY][pX];
			here.play.visited = true;
			if (!floorChanged) {
				localThis.renderMapCursor(previous);
			}
			localThis.renderMapCell(here);
			localThis.renderMapCursor(here, pDir);
			updateTouchButtons();
			$('#moves').text(`Moves: ${player.moves}`);
		}
		this.syncPlayer = syncPlayer;

		// Initialize our starting cell.
		maze.grid[pZ][pY][pX].play.visited = true;
		updateTouchButtons();

		// Attach the current floor elements to the UI.
		if (this.mapList) {
			this.mapList.remove();
		}
		mapElement.prepend(mapHtml[pZ]);
		mazeTranslateElement.prepend(mazeHtml[pZ]);

		// Set initial position.
		mazeTranslateElement.css('transform',`translate3d(${-100*pX}vmin, 0vmin, ${-100*pY}vmin)`);
		mazeRotateElement.css('transform',`rotateY(${pDeg}deg) translate(-50%,-50%)`);
		this.setItemHtmlRotation(pDeg);
		hideOutOfRangeCells(pX, pY, pZ, viewRange, true);

		// Clean up final map.
		this.renderMap();
		this.renderMapCursor(maze.grid[pZ][pY][pX], pDir);
		
		// Stop propogation of transitionend by cell contents up the DOM.
		// This breaks keypress handling.
		$('.contents').children().on('transitionend', stopPropagation);

		// Doors are a special case. Stop on all door objects except door_a.
		// This is handled now in the open functions.
		//$('.door').filter(':not(.door_a)').on('transitionend', stopPropagation);

		// The key name the game works with: a letter key becomes the arrow or Page key it stands for.
		// With Ctrl, Alt or Cmd held it is left alone, because Ctrl+W, Ctrl+R and the like belong
		// to the browser. Lower case, so Shift and Caps Lock make no difference.
		function gameKey(event) {
			const letter = localThis.letterKeys && !event.ctrlKey && !event.altKey && !event.metaKey
				&& typeof event.key == 'string' && letterKeys[event.key.toLowerCase()];
			return letter || event.key;
		}
		$('body').on('keydown.game', function(event) {
			keyPressed[gameKey(event)] = true;
			eventQueue.push('keydown');
		}).on('keyup.game', function(event) {
			// A letter is let go however it is read now, in case the letter setting changed while it was held.
			const key = gameKey(event);
			const letter = typeof event.key == 'string' && letterKeys[event.key.toLowerCase()];
			for (const name of [key, event.key, letter]) {
				if (name && keyPressed[name]) {
					delete keyPressed[name];
				}
			}
			eventQueue.push('keyup');
		}).on('transitionend.game', function (event) {
			eventQueue.push('animationStop');
			event.stopImmediatePropagation();	
		});
		// A page that loses focus (Alt-Tab, clicking another window) never hears the keyup,
		// so a held key would stay pressed and keep the player moving. Let go of everything.
		$(window).on('blur.game', function() {
			Object.keys(keyPressed).forEach(key => delete keyPressed[key]);
		});

		// The key each touch button stands for.
		const buttonKeys = {
			touchFwd: 'ArrowUp',
			touchBack: 'ArrowDown',
			touchLeft: 'ArrowLeft',
			touchRight: 'ArrowRight',
			touchUp: 'PageUp',
			touchDown: 'PageDown',
		};
		// Hold a button's key down. tappedKey keeps a press that ends before the next look.
		function pressButton(key) {
			keyPressed[key] = true;
			tappedKey = key;
			eventQueue.push('keydown');
		}
		// Let go. A cancelled touch was not a tap, so it takes back the remembered press too.
		function releaseButton(key, cancelled) {
			if (key && keyPressed[key]) {
				delete keyPressed[key];
			}
			if (cancelled && key && tappedKey == key) {
				tappedKey = null;
			}
			eventQueue.push('keyup');
		}
		// Hide only stops drawing the buttons: they stay live, so a tap on the maze
		// still works. The faint Show label draws them again.
		function hideTouchButtons() {
			$('#maze').addClass('touchHidden').removeClass('touchVisible');
		}

		if (navigator.maxTouchPoints == 0) {
			$('#touchNav .touchNav').on('mousedown', function (event){
				const id = $(event.target).attr('id');
				event.stopImmediatePropagation();
				if (id == 'touchHide') {
					hideTouchButtons();
					return;
				}
				pressButton(buttonKeys[id]);
			}).on('mouseup mouseout', function (event){
				releaseButton(buttonKeys[$(event.target).attr('id')], false);
			});
		}

		/*
		Touch screens. What a finger does depends on the touch style (see setTouchStyle):
		 taps    a touch acts at once, as a mouse press does, and a finger sliding off the box lets go.
		 swipes  only a swipe acts: it is read from how far the finger has moved, wherever it began.
		 both    a quick tap acts when the finger lifts, a swipe acts as soon as it is clear, and a
		         finger held still for HOLD_MS starts walking (like holding the box) until it lifts.
		A swipe in the middle of the screen turns (sideways), walks forward (up) or back (down), and
		keeps walking while the finger stays down. A swipe up or down that begins on a side strip
		climbs a ladder. A swipe that is blocked (a wall, no ladder here) or too crooked to read does
		nothing at all and costs no move, because moves are scored. With swipeDirection 'drag' every
		direction is flipped, as if the finger dragged the picture.

		The side strip chosen as the scroll side (see setScrollSide) is the exception when the map
		is below the maze: the browser owns its vertical drags so the page can scroll, and a tap
		there acts like the 'both' tap (on lift), because the browser may be about to scroll.
		*/
		const HOLD_MS = 250;
		const TAP_SLOP = 10;
		// A swipe must travel this far, about a tenth of the maze, and be this much more
		// sideways than up (or the other way round) to count; anything else is ambiguous.
		const swipeDistance = () => Math.max(24, $('#maze .viewport').width() * 0.1);
		const CLEAR_RATIO = 1.5;
		// Fingers on the buttons, by touch identifier.
		const fingers = new Map();
		// The fingers an event is about. A script that fires a bare touch event has none listed;
		// that counts as one finger, so such an event still works as a press.
		const fingersOf = event => event.changedTouches && event.changedTouches.length
			? [...event.changedTouches] : [{identifier: 0, clientX: 0, clientY: 0}];
		const isSideStrip = id => id == 'touchLeft' || id == 'touchRight';
		const isScrollStrip = id => isSideStrip(id) && localThis.mapIsBelow()
			&& id == (localThis.scrollSide == 'left' ? 'touchLeft' : 'touchRight');

		// The key a swipe stands for, or null when it is too crooked to tell, or a side strip's
		// sideways swipe (a strip only climbs).
		function swipeKey(finger, dx, dy) {
			if (localThis.swipeDirection == 'drag') {
				dx = -dx;
				dy = -dy;
			}
			const sideways = Math.abs(dx) > CLEAR_RATIO * Math.abs(dy);
			const vertical = Math.abs(dy) > CLEAR_RATIO * Math.abs(dx);
			if (finger.strip) {
				return vertical ? (dy < 0 ? 'PageUp' : 'PageDown') : null;
			}
			if (sideways) {
				return dx < 0 ? 'ArrowLeft' : 'ArrowRight';
			}
			return vertical ? (dy < 0 ? 'ArrowUp' : 'ArrowDown') : null;
		}

		$('#touchNav .touchNav').on('touchstart', function (event) {
			const id = $(event.target).attr('id');
			event.stopImmediatePropagation();
			const scrolls = isScrollStrip(id);
			// The browser may not scroll under a finger that is playing the maze, but it must be
			// allowed to under one on the scroll strip.
			if (!scrolls) {
				event.preventDefault();
			}
			if (id == 'touchHide') {
				hideTouchButtons();
				return;
			}
			const style = localThis.touchStyle;
			for (const touch of fingersOf(event)) {
				const finger = {
					id, key: buttonKeys[id], x: touch.clientX, y: touch.clientY,
					// 'now': acts at once; otherwise it waits for lift, swipe or hold.
					now: style == 'taps' && !scrolls,
					swipes: style != 'taps' && !scrolls,
					taps: style != 'swipes',
					strip: isSideStrip(id),
					// The key this finger is pressing, once it has acted; and whether it has
					// been used up (a swipe that is blocked or ambiguous never turns into a tap).
					pressed: null, spent: false, timer: null,
				};
				fingers.set(touch.identifier, finger);
				if (finger.now) {
					finger.pressed = finger.key;
					pressButton(finger.key);
				} else if (finger.taps) {
					finger.timer = setTimeout(() => {
						finger.timer = null;
						if (!finger.spent) {
							finger.pressed = finger.key;
							pressButton(finger.key);
						}
					}, HOLD_MS);
				}
			}
		}).on('touchmove', function (event) {
			for (const touch of fingersOf(event)) {
				const finger = fingers.get(touch.identifier);
				if (!finger || finger.spent && !finger.pressed) {
					continue;
				}
				if (finger.now) {
					// Sliding off the box lets go of it.
					if (event.target !== document.elementFromPoint(touch.clientX, touch.clientY)) {
						fingers.delete(touch.identifier);
						releaseButton(finger.key, false);
					}
					continue;
				}
				const dx = touch.clientX - finger.x;
				const dy = touch.clientY - finger.y;
				const distance = Math.hypot(dx, dy);
				if (finger.pressed) {
					continue;
				}
				if (distance > TAP_SLOP) {
					// Moved too much to be a tap or a hold.
					clearTimeout(finger.timer);
					finger.timer = null;
					finger.taps = false;
				}
				if (finger.swipes && distance >= swipeDistance()) {
					const key = swipeKey(finger, dx, dy);
					finger.spent = true;
					// Ask the rules whether this would do anything; if not, nothing happens.
					if (key && canAct(keyActions[key])) {
						finger.pressed = key;
						pressButton(key);
					} else if (key) {
						// A clear swipe the rules refuse is a new try, so it bumps.
						bumped = false;
						bump();
					}
				}
			}
		}).on('touchend touchcancel', function (event) {
			const cancelled = event.type == 'touchcancel';
			for (const touch of fingersOf(event)) {
				const finger = fingers.get(touch.identifier);
				if (!finger) {
					continue;
				}
				fingers.delete(touch.identifier);
				clearTimeout(finger.timer);
				if (finger.pressed) {
					releaseButton(finger.pressed, cancelled);
				} else if (!cancelled && finger.taps && !finger.spent) {
					// A quick tap, acted on as the finger lifts. It is remembered for the next look.
					tappedKey = finger.key;
					eventQueue.push('keydown');
					eventQueue.push('keyup');
				}
			}
		});

		$('#touchShow').on(navigator.maxTouchPoints > 0 ? 'touchstart' : 'mousedown', function (event) {
			event.stopImmediatePropagation();
			if (event.type == 'touchstart') {
				event.preventDefault();
			}
			$('#maze').removeClass('touchHidden').addClass('touchVisible');
		});

		this.rootNode.on('cut copy', function(e) {
			e.preventDefault();
			return false;
		});

		this.gameLoopThread = setInterval(gameLoop, 100);
	}
	
	showAllMaps() {
		for (const html of this.mapHtml) {
			$('body').append(html);
		}
	}

	setGameOver(state) {
		this.gameOver = state;
	}

	isGameOver() {
		return this.gameOver == true;
	}

	removeGameUi(state) {
		clearInterval(this.gameLoopThread);
		this.gameLoopThread = null;
		setMusic(null);
		this.rootNode.empty();

		// Remove triggers on body tag (or else...)
		$('body').off('keydown.game').off('keyup.game').off('transitionend.game');
		$(window).off('blur.game');

		// Clean up all dynamic CSS (or else...)
		for (const [name, rule] of Object.entries(this.cssRules)) {
			for (var i=0;i<this.styleSheet.cssRules.length;++i){
				if (Object.is(this.styleSheet.cssRules.item(i), rule)) {
					this.styleSheet.deleteRule(i);
					break
				}
			}
		}

		// The menu callback is optional (see generateGameUi).
		if (this.helpFxn) {
			this.helpFxn(state);
		}
	}
}