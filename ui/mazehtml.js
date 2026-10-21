// Constants
const viewRange = 5; // Viewing range. Cells farther away are hidden.

const turnRight = {'N':'E','E':'S','S':'W','W':'N'};
const turnLeft = {'N':'W','W':'S','S':'E','E':'N'};

const walls = [
	{'color':'#C0C0C0','img':''},
];
const doors = [
	{'map':'1px black solid', 'wall':'gray', 'img':''},
	{'map':'2px brown solid', 'wall':'brown', 'img':''},
	{'map':'2px red solid', 'key':'red', 'wall':'red', 'img':''},
	{'map':'2px orange solid', 'key':'orange', 'wall':'orange', 'img':''},
	{'map':'2px yellow solid', 'key':'yellow', 'wall':'yellow', 'img':''},
	{'map':'2px green solid', 'key':'green', 'wall':'green', 'img':''},
	{'map':'2px darkblue solid', 'key':'darkblue', 'wall':'darkblue', 'img':''},
	{'map':'2px purple solid', 'key':'purple', 'wall':'purple', 'img':''},
	{'map':'2px pink solid', 'key':'pink', 'wall':'pink', 'img':''},
	{'map':'2px aqua solid', 'key':'aqua', 'wall':'aqua', 'img':''},
	{'map':'2px springgreen solid', 'key':'springgreen', 'wall':'springgreen', 'img':''},
	{'map':'2px red solid', 'key':'red', 'wall':'red', 'img':''},
	{'map':'2px orange solid', 'key':'orange', 'wall':'orange', 'img':''},
	{'map':'2px yellow solid', 'key':'yellow', 'wall':'yellow', 'img':''},
	{'map':'2px green solid', 'key':'green', 'wall':'green', 'img':''},
	{'map':'2px darkblue solid', 'key':'darkblue', 'wall':'darkblue', 'img':''},
	{'map':'2px purple solid', 'key':'purple', 'wall':'purple', 'img':''},
	{'map':'2px pink solid', 'key':'pink', 'wall':'pink', 'img':''},
	{'map':'2px aqua solid', 'key':'aqua', 'wall':'aqua', 'img':''},
	{'map':'2px springgreen solid', 'key':'springgreen', 'wall':'springgreen', 'img':''},
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

// Which game action each key (or touch button, see playGame) stands for.
const keyActions = {'ArrowUp':'F', 'ArrowDown':'B', 'ArrowLeft':'L', 'ArrowRight':'R', 'PageUp':'U', 'PageDown':'D'};

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
		// Prefix for the images this file loads itself (the map's player marker), relative to the page.
		// The site serves img/ next to its pages; a page elsewhere sets this, e.g. '../ui/'.
		this.assetRoot = '';
		// Whether the on-screen touch buttons show: 'auto' (on a device with a touch screen),
		// 'on' or 'off'. A page that offers a setting for it calls setTouchControls().
		this.touchControls = 'auto';
		// Whether the maze is drawn in solid contrasting colors instead of pictures. Change it with setHighContrast().
		this.highContrast = false;
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
					color = openValue ? 'transparent none' : (this.highContrast ? (wallValue ? '3px #FFFFFF dashed' : '2px #FFFFFF solid') : doors[wallValue].map);
					break;
				default:					
					color = openValue ? 'transparent none' : (this.keyList ? `${this.highContrast ? 3 : 2}px ${this.highContrast ? this.keyList[wallValue].hcColor : this.keyList[wallValue].doorcolor} solid` : doors[wallValue].map);
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
			cell.map.html('&nbsp;').css('background-color', this.highContrast ? 'black' : 'white').addClass('mapCell');
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
			cell.map.html('&nbsp;').css({'background-color': this.highContrast ? '#444444' : 'gray', 'border':'2px transparent none'}).removeClass().addClass('mapCell');
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

	generateGameUi(rootNodeId, helpFxn = null) {
		this.rootNode = $(`#${rootNodeId}`);
		const gameUi = $(`
  <div id="maze">
	  <div class="viewport">
		<div id="mazeRotate" class="mazeRotate" style="transform: translate(-50%,-50%);">
		  <div id="mazeTranslate" class="mazeTranslate">
		  </div>
		</div>
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

	playGame(winFunc = null, loseFunc = null) {
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
		const player = new MazePlayer(maze, gameDebug);
		this.player = player;
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
		

		function hideOutOfRangeCells(cx, cy, cz, range){
			for(var y = 0; y < maze.rows; ++y){
				const show = y >= cy - range && y <= cy + range;
				for(var x = 0; x < maze.columns; ++x){
					if (show &&  x >= cx - range && x <= cx + range) {
						Object.values(maze.grid[cz][y][x].html).forEach(x => x.show());
					}
					else {
						Object.values(maze.grid[cz][y][x].html).forEach(x => x.hide());
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
					case 'keydown':
					case 'keyup':
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
				$(`#${id}`).toggleClass('touchBlocked', !player.canAct(action));
			}
		}

		function processKeyPress(key) {
			const action = keyActions[key];
			if (!action) {
				return true;
			}
			// Get the current cell.
			const cell = maze.grid[pZ][pY][pX];
			// The rules decide what this key does. null means a bump, which costs nothing.
			const result = player.act(action, Date.now() - startTime);
			if (!result) {
				return true; // May process more actions
			}
			// A key picked up here is shown once the animation ends.
			pendingKey = result.pickedUp || null;
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
					hideOutOfRangeCells(pX, pY, pZ, viewRange);
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
					// Open door
					animationState = 'door';
					// Play the sound
					playSound(localThis.getClip('door'));
					return false; // action in progress
				case 'turn':
					pDir = player.dir;
					pDeg += action == 'L' ? -90 : 90;
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
				mazeTranslateElement.css({'transition':`transform cubic-bezier(0.36, 0, 0.66, -0.56) ${ms(1500)}`,'transform':`translate3d(${-100*pX}vmin, ${lift}vmin, ${-100*pY}vmin)`});
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
					animationState = false;
					break;
				case 'backward':
					// Update the visit flag for this cell.
					nextCell = maze.grid[pZ][pY][pX];
					// Also update for last cell.
					lastCell = maze.getNextCell(nextCell, pDir);
					// No more animations.
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
					hideOutOfRangeCells(pX, pY, pZ, viewRange);
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
					hideOutOfRangeCells(pX, pY, pZ, viewRange);
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
			return !animationState;
		}

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
		hideOutOfRangeCells(pX, pY, pZ, viewRange);

		// Clean up final map.
		this.renderMap();
		this.renderMapCursor(maze.grid[pZ][pY][pX], pDir);
		
		// Stop propogation of transitionend by cell contents up the DOM.
		// This breaks keypress handling.
		$('.contents').children().on('transitionend', stopPropagation);

		// Doors are a special case. Stop on all door objects except door_a.
		// This is handled now in the open functions.
		//$('.door').filter(':not(.door_a)').on('transitionend', stopPropagation);

		$('body').on('keydown.game', function(event) {
			keyPressed[event.key] = true;
			eventQueue.push('keydown');
		}).on('keyup.game', function(event) {
			if (keyPressed[event.key]) {
				delete keyPressed[event.key];
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

		// A phone can cancel a touch (a long press, a notification, a swipe the browser takes
		// as a scroll) and send touchcancel in place of touchend; it must let go of the button too.
		var [mousedown, mouseup] = navigator.maxTouchPoints > 0 ? ['touchstart','touchend touchcancel touchmove'] : ['mousedown','mouseup mouseout'] ;

		$('#touchNav .touchNav').on(mousedown, function (event){
			const map = {
				touchFwd: 'ArrowUp',
				touchBack: 'ArrowDown',
				touchLeft: 'ArrowLeft',
				touchRight: 'ArrowRight',
				touchUp: 'PageUp',
				touchDown: 'PageDown',
			};
			const id = $(event.target).attr('id');
			event.stopImmediatePropagation();
			// Keep the browser from turning a held button into a text selection or a scroll.
			if (event.type == 'touchstart') {
				event.preventDefault();
			}
			if (id == 'touchHide') {
				// Hide only stops drawing the buttons: they stay live, so a tap on the maze
				// still works. The faint Show label draws them again.
				$('#maze').addClass('touchHidden').removeClass('touchVisible');
				return;
			}
			keyPressed[map[id]] = true;
			tappedKey = map[id];
			eventQueue.push('keydown');
		}).on(mouseup, function (event){
			const map = {
				touchFwd: 'ArrowUp',
				touchBack: 'ArrowDown',
				touchLeft: 'ArrowLeft',
				touchRight: 'ArrowRight',
				touchUp: 'PageUp',
				touchDown: 'PageDown',
			};
			const id = $(event.target).attr('id');
			console.log(`${id}.${event.type}`);
			if (event.type == 'touchmove'){
				// changedTouches holds the finger that moved; touches[0] could be another finger.
				// elementFromPoint wants coordinates in the window, not the page.
				const touch = event.changedTouches[0];
				if (event.target === document.elementFromPoint(touch.clientX,touch.clientY)) {
					//Have not left.
					return;
				}
			}
			if (map[id] && keyPressed[map[id]]) {
				delete keyPressed[map[id]];
			}
			// A cancelled touch was not a tap.
			if (event.type == 'touchcancel' && tappedKey == map[id]) {
				tappedKey = null;
			}
			eventQueue.push('keyup');
		});

		$('#touchShow').on(mousedown, function (event) {
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