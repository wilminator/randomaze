/*
The dungeon layer: monsters, traps, fights and the replay of a dungeon run, with no page code.

A dungeon is a normal maze (classic rules, see mazeplayer.js) with a second layer on top.
The browser UI and the server's replay both run this file, so they get the same fights.

Three objects, from least to most live:
	Dungeon      Placed once for a maze and a seed: where the monsters and traps are. It never
	             changes during play, so a server can cache it next to the maze.
	DungeonGame  One run: a hero, the dice, the monsters' current state, a fight in progress.
	             act(letter) does one action and says what happened.
	replayDungeon(...)  Plays a finished run's action string and returns the result.

Randomness comes from two separate streams, so nothing here can move a wall of the maze:
	placement  `${dungeonSeed}:monsters` and `:traps`. The same for every player that day.
	dice       `${dungeonSeed}:${nonce}`. Every roll of a run (to hit, damage, crits, fleeing and
	           a monster's wandering) is drawn from this one stream, in the order the actions happen.
	           The server hands out the nonce when the run starts, so each attempt rolls differently.

Actions (a run's record is one letter per action; see replayDungeon):
	Exploring   F B L R U D as in the classic game, W wait, C close the open door ahead
	In a fight  A attack, G guard, X flee
	Anywhere    I drink a potion; 1 uses the class's level 1 skill (see `skills` below). Both cost a
	            tick outside a fight, and a round inside one (the monster still gets its swing).
	Reserved    2-4 (later skills) are valid letters for later phases. For now they are refused.
Fight actions are not ticks. The world is frozen while you fight. Only moves tick (the TickLayer
policy in DUNGEON_CONTENT says which kinds), and monsters act on ticks.

All the numbers are in DUNGEON_CONTENT below, passed into everything, so the balance work can
tune them (and a private copy can replace them) without touching the rules.
*/

const DUNGEON_CONTENT = {
	// Which version of these rules a record was played under. Change it when a change here would
	// make an old record replay differently.
	rules: 3,
	maxLevel: 20,

	// A hero's stats at level L are the class's base x (1 + growth x (L - 1)). Design 7.3: +15% HP
	// and ATK per level, plus +10% SP per level (Mike, 2026-10-21) and a full SP refill on a level-up.
	// DEF does not grow.
	heroGrowth: { hp: 0.15, atk: 0.15, def: 0, sp: 0.10 },
	// Levels of HP and SP growth a hero starts with, on top of its own level (a cushion for the early levels).
	headStart: { hp: 10, sp: 3 },
	// Monsters follow the same curve (design 3.6), and their XP grows by this factor per level.
	// The balance bot tunes both.
	monsterGrowth: 0.15,
	monsterXpGrowth: 1.10,
	// 1 SP back for this many steps (a 'move' result: walking, not turning).
	stepsPerSp: 4,
	// SP a Guard gives back.
	guardSp: 2,

	// Which kinds of move cost a tick. Same shape as TickLayer's policy.
	tickPolicy: { move: true, turn: true, door: true, close: true, wait: true, trap: true, fall: true, rope: true, item: true, skill: true, win: false },

	// Placement (design 3.1, 8.2).
	cellsPerMonster: 12,
	guardianChance: 0.6,      // each key cell's chance of a monster within guardianRadius steps
	guardianRadius: 2,
	minStartDistance: 3,      // no monster or trap this many steps (or fewer) from the start
	bossMinCells: 450,        // the exit guardian only stands in mazes with at least this many cells
	cellsPerTrap: { spikes: 40, dart: 60, alarm: 80 },
	// Elements (design 3.5, equipment-naming.md). `loop` beats the NEXT one in the list and is beaten by
	// the one before it (Fire > Frost > Earth > Storm > Fire). Hitting what you beat deals +bonus,
	// hitting what beats you deals -bonus: one flat step, not scaled by tier. Light is always +bonus
	// against Dark and has no downside. Neutral (or any other word) changes nothing. Nothing in a
	// fight uses this yet: heroes and gear get elements in later changes, which call the helper.
	elements: { loop: ['fire', 'frost', 'earth', 'storm'], bonus: 0.25, light: 'light', dark: 'dark' },

	// Which species may stand where. Tier 1 near the start, tier 3 deep.
	tiers: { 1: ['rat', 'slime', 'bat'], 2: ['goblin', 'skeleton', 'spider'], 3: ['orc', 'wraith'] },

	// Monster behaviour (design 3.3).
	wakeChance: 0.25,         // an idle wanderer starts walking
	restChance: 0.15,         // a wandering monster stops to idle
	searchTicks: 6,           // how long a monster follows your scent before giving up
	alarmRadius: 8,
	fleeFreeze: 4,            // ticks a monster you fled from stays put
	fleeRunTicks: 6,          // how long a goblin runs once it breaks off a fight
	goblinFleeBelow: 0.25,    // share of max HP

	// Combat (design 4.3, 8.2).
	critMultiplier: 1.5,
	monsterCrit: 0.05,
	trapDamage: { spikes: 0.05, dart: 0.03 },    // share of max HP

	// Potions. Found ones lie on the floor (picked up by walking onto them): HP potions heal a share of
	// max HP and SP potions restore a share of max SP, so they stay useful as the hero grows. SP
	// potions are sized so a Mage that finds them all could Firebolt every monster (tools/balance/
	// sp-potions.js). A hero may arrive with shop potions in `potions`: a number is an HP potion's
	// share, {sp: share} an SP potion's; the shop's are weaker (`shopHeal`, `shopSp`). One bag for
	// both kinds, at most `carry` (design 7.3a).
	potions: { cellsPerPotion: 40, heal: 0.5, shopHeal: 0.25, cellsPerSpPotion: 40, sp: 0.5, shopSp: 0.25, carry: 8 },

	// Passive charms, carried in the same bag and used up when they trigger (Mike, 2026-10-21):
	//   feather  a fall (a drop, or an unseen pit) does no damage
	//   hold     an unseen pit does not drop you: you stand on it and it is revealed
	// A maze has 0 to `floorCharms` of them on the floor in all (Mike), each kind chosen at random; the
	// shop sells both, and its copies arrive in `hero.potions` as the strings 'feather' and 'hold'. An
	// unused one at the exit pays gold, less than its price (the backend's rule; the run summary says how
	// many are left).
	charms: { feather: { name: 'Feather Charm' }, hold: { name: 'Anchor Charm' } },
	floorCharms: 2,

	// The level 1 skill of each class, used with key 1 (design 7.2). `sp` is the cost.
	//   power-strike  a hit worth `mult` x damage            backstab   `mult` x, on a first strike only
	//   firebolt      spell damage that ignores DEF; out of a fight, burns a monster in the next cell
	//   heal          restores `heal` of max HP
	//   aimed-shot    a `mult` x hit; out of a fight, shoots a monster in line within `range` cells
	//   flurry        `hits` hits, each worth `mult` x
	skills: {
		warrior: { name: 'Power Strike', kind: 'power-strike', sp: 4, mult: 1.8 },
		rogue:   { name: 'Backstab',     kind: 'backstab',     sp: 4, mult: 3 },
		mage:    { name: 'Firebolt',     kind: 'firebolt',     sp: 4 },
		cleric:  { name: 'Heal',         kind: 'heal',         sp: 8, heal: 0.4 },
		ranger:  { name: 'Aimed Shot',   kind: 'aimed-shot',   sp: 4, mult: 1.5, range: 6 },
		monk:    { name: 'Flurry',       kind: 'flurry',       sp: 6, mult: 0.5, hits: 3 },
	},

	// Heroes (design 7.1). `crit` is the chance of a critical hit.
	classes: {
		warrior: { name: 'Warrior', hp: 46, sp: 12, atk: 9, def: 5, spd: 4, crit: 0.05 },
		rogue:   { name: 'Rogue',   hp: 34, sp: 20, atk: 9, def: 2, spd: 8, crit: 0.12 },
		mage:    { name: 'Mage',    hp: 30, sp: 32, atk: 4, def: 1, spd: 5, crit: 0.05, spell: 9 },
		cleric:  { name: 'Cleric',  hp: 37, sp: 24, atk: 5, def: 4, spd: 4, crit: 0.05 },
		ranger:  { name: 'Ranger',  hp: 37, sp: 20, atk: 8.5, def: 3, spd: 7, crit: 0.05 },
		monk:    { name: 'Monk',    hp: 39, sp: 20, atk: 9.5, def: 3, spd: 9, crit: 0.05 },
	},

	// Bestiary at level 1 (design 3.5). Behaviour flags:
	//   speed     'normal' acts every tick, 'slow' every second tick, 'fast' twice per tick
	//   wanders   false: stays at home until it sees you, then goes back
	//   leash     how far from home (cells) it wanders
	//   erratic   chance that a step is in a random direction instead of the planned one
	//   opensPlain  can open plain (keyless) doors; passDoors: walks through any closed door
	//   flees     breaks off a fight at low HP (once)
	//   deadEnd   placed in dead ends;  pair: placed with a second one next to it
	//   element   fire, frost, earth, storm, dark or neutral (default). PLACEHOLDER: which species carry
	//             which element, and which elements each band features, are not decided yet. Light
	//             monsters do not exist yet. See `elements` above and dungeonElementMultiplier.
	monsters: {
		rat:      { tier: 1, element: 'neutral', hp: 5.4, atk: 2.7, def: 0, spd: 6, sight: 3, speed: 'normal', wanders: true,  leash: 4, pair: true },
		slime:    { tier: 1, element: 'earth', hp: 10.8, atk: 2.7, def: 2, spd: 1, sight: 2, speed: 'slow',   wanders: true,  leash: 3 },
		bat:      { tier: 1, element: 'storm', hp: 4.5, atk: 1.8, def: 0, spd: 9, sight: 5, speed: 'fast',   wanders: true,  leash: 6, erratic: 0.4 },
		goblin:   { tier: 2, element: 'fire', hp: 7.6, atk: 2.7, def: 2, spd: 5, sight: 5, speed: 'normal', wanders: true,  leash: 4, opensPlain: true, flees: true },
		skeleton: { tier: 2, element: 'dark', hp: 9.8, atk: 3.3, def: 4, spd: 3, sight: 6, speed: 'normal', wanders: true,  leash: 4, undead: true },
		spider:   { tier: 2, element: 'earth', hp: 6.5, atk: 2.7, def: 1, spd: 7, sight: 4, speed: 'normal', wanders: false, leash: 0, deadEnd: true },
		orc:      { tier: 3, element: 'fire', hp: 12.7, atk: 3.6, def: 4, spd: 4, sight: 5, speed: 'normal', wanders: true,  leash: 4, opensPlain: true },
		wraith:   { tier: 3, element: 'dark', hp: 9.1, atk: 3.2, def: 6, spd: 6, sight: 6, speed: 'normal', wanders: true,  leash: 4, undead: true, passDoors: true },
		guardian: { tier: 4, element: 'frost', hp: 19.1, atk: 3.8, def: 6, spd: 5, sight: 4, speed: 'normal', wanders: false, leash: 2, boss: true },
	},

	// A placeholder table of cumulative XP for each level (index 0 is level 1). The server passes
	// the real one in the hero snapshot; this only keeps a bare hero playable.
	xpTable: [0, 10, 50, 140, 300, 550, 910, 1400, 2040, 2850, 3850, 5060, 6500, 8190, 10150, 12400, 14960, 17850, 21090, 24700],
};

const DUNGEON_DIRS = ['N', 'S', 'E', 'W'];
const DUNGEON_ALL_DIRS = ['N', 'S', 'E', 'W', 'U', 'D'];

/*
The dice: one seeded stream, drawn in the order the actions happen. `rolls` counts the draws, which
is handy in tests (replaying the same actions must draw the same number).
*/
class Dice {
	constructor(seed) {
		this.rng = new Math.seedrandom(String(seed));
		this.rolls = 0;
	}
	// A number in [0, 1).
	next() {
		++this.rolls;
		return this.rng();
	}
	// An integer in 0 .. n-1.
	int(n) {
		return Math.floor(this.next() * n);
	}
}

const clampNumber = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// The damage multiplier for a hit of element `attacker` on something of element `defender`:
// 1 + bonus, 1 - bonus or 1. Order matters: Fire hitting Frost is 1.25, Frost hitting Fire is 0.75.
// Light hitting Dark is 1.25; Dark hitting Light is 1 (Light has no downside). Anything else,
// including neutral or a missing element, is 1. Gear and spells call this; it draws no dice.
function dungeonElementMultiplier(content, attacker, defender) {
	const { loop, bonus, light, dark } = content.elements;
	if (attacker == light && defender == dark) return 1 + bonus;
	const a = loop.indexOf(attacker), d = loop.indexOf(defender);
	if (a < 0 || d < 0) return 1;
	if (d == (a + 1) % loop.length) return 1 + bonus;
	if (a == (d + 1) % loop.length) return 1 - bonus;
	return 1;
}

// The hero's stats for a class at a level.
function dungeonHeroStats(content, cls, level) {
	const c = content.classes[cls], g = content.heroGrowth, n = level - 1;
	return {
		maxHp: Math.round(c.hp * (1 + g.hp * (n + (content.headStart?.hp ?? 0)))),
		maxSp: Math.round(c.sp * (1 + g.sp * (n + (content.headStart?.sp ?? 0)))),
		atk: c.atk * (1 + g.atk * n),
		spell: (c.spell ?? 0) * (1 + g.atk * n),
		def: c.def * (1 + g.def * n),
		spd: c.spd,
		crit: c.crit,
	};
}

// A monster's stats for a species at a level. SPD does not grow.
function dungeonMonsterStats(content, species, level) {
	const m = content.monsters[species], s = 1 + content.monsterGrowth * (level - 1);
	return { maxHp: Math.max(1, Math.round(m.hp * s)), atk: m.atk * s, def: m.def * s, spd: m.spd };
}

// XP for killing a monster: 4 x tier^2 + HP/4 at level 1 (design 7.3), then x growth per level.
function dungeonMonsterXp(content, species, level) {
	const m = content.monsters[species];
	return Math.round((4 * m.tier ** 2 + m.hp / 4) * content.monsterXpGrowth ** (level - 1));
}

// The level a hero with `xp` total has reached, from a cumulative table (index 0 is level 1).
function dungeonLevelForXp(table, xp, maxLevel) {
	let level = 1;
	while (level < maxLevel && level < table.length && xp >= table[level]) ++level;
	return level;
}

/*
Where the monsters and traps are, for one maze. Built from the maze and the dungeon seed only, so
every player gets the same dungeon. Monster levels depend on the player's band, so a monster here
has a `depth` (0 by the entrance to 1 by the exit) and a `jitter` (-1, 0 or 1), and a game turns
those into a level.
*/
class Dungeon {
	constructor(maze, seed, content = DUNGEON_CONTENT) {
		this.maze = maze;
		this.seed = seed;
		this.content = content;
		this.start = maze.entranceList[0].cell;
		this.exit = maze.entranceList[maze.entranceList.length - 1].cell;
		this.entranceSet = new Set(maze.entranceList.map(e => e.cell));
		this.dist = this.routeDistances();
		this.exitDist = Math.max(1, this.dist.get(this.exit) ?? Math.max(...this.dist.values()));
		this.monsters = [];
		this.traps = [];
		this.potions = [];
		this.charms = [];
		this.placeMonsters();
		this.placeTraps();
		this.placePotions();
		this.placeCharms();
	}

	// Steps from the start to each cell, going through every wall the rules let a player through
	// (open sides, any door, ladders). Used for depth only, so doors count as open.
	routeDistances() {
		const dist = new Map([[this.start, 0]]);
		const queue = [this.start];
		for (let i = 0; i < queue.length; ++i) {
			const cell = queue[i];
			for (const dir of DUNGEON_ALL_DIRS) {
				const next = this.step(cell, dir);
				if (next && !dist.has(next)) {
					dist.set(next, dist.get(cell) + 1);
					queue.push(next);
				}
			}
		}
		return dist;
	}

	// The cell you reach by going `dir` from `cell` through an open side or a door, or null.
	step(cell, dir) {
		const v = cell.data[dir];
		if (v !== null && !(v > 0)) return null;
		return this.maze.getNextCell(cell, dir);
	}

	// Cells within `steps` of `cell` (not counting itself), in a fixed order.
	nearby(cell, steps) {
		const seen = new Map([[cell, 0]]);
		const queue = [cell];
		for (let i = 0; i < queue.length; ++i) {
			const here = queue[i];
			if (seen.get(here) == steps) continue;
			for (const dir of DUNGEON_ALL_DIRS) {
				const next = this.step(here, dir);
				if (next && !seen.has(next)) {
					seen.set(next, seen.get(here) + 1);
					queue.push(next);
				}
			}
		}
		return queue.slice(1);
	}

	depthOf(cell) {
		return Math.min(1, (this.dist.get(cell) ?? 0) / this.exitDist);
	}

	// How many sides of a cell lead anywhere.
	openSides(cell) {
		return DUNGEON_ALL_DIRS.filter(d => cell.data[d] === null || cell.data[d] > 0).length;
	}

	placeMonsters() {
		const content = this.content, maze = this.maze;
		const rng = new Math.seedrandom(`${this.seed}:monsters`);
		const pick = n => Math.floor(rng() * n);
		const taken = new Set();
		// Cells a monster may start on: reachable, off the entrances, and not near the start.
		const allowed = cell => this.dist.has(cell) && this.dist.get(cell) > content.minStartDistance && !this.entranceSet.has(cell);
		const free = cell => allowed(cell) && !taken.has(cell);

		const place = (species, cell) => {
			taken.add(cell);
			this.monsters.push({ id: this.monsters.length, species, cell, depth: this.depthOf(cell), jitter: 0 });
		};
		// Which species stands at a cell: by depth, with some blur so the tiers overlap.
		const speciesAt = cell => {
			const t = this.depthOf(cell) + (rng() - 0.5) * 0.3;
			const tier = t < 1 / 3 ? 1 : t < 2 / 3 ? 2 : 3;
			let list = content.tiers[tier];
			if (this.openSides(cell) != 1) list = list.filter(s => !content.monsters[s].deadEnd);
			return list[pick(list.length)];
		};
		const placeAt = cell => {
			const species = speciesAt(cell);
			place(species, cell);
			if (content.monsters[species].pair) {
				// Rats come in pairs: the second one in a free cell next door.
				const next = DUNGEON_DIRS.map(d => this.step(cell, d)).filter(c => c && free(c));
				if (next.length) place(species, next[pick(next.length)]);
			}
		};

		const target = Math.max(1, Math.round(maze.cellList.length / content.cellsPerMonster));
		// Key guardians first: a fight on the way to each key.
		for (const cell of maze.cellList) {
			if (this.monsters.length >= target) break;
			if (!cell.data.item.key || rng() >= content.guardianChance) continue;
			const spots = [cell, ...this.nearby(cell, content.guardianRadius)].filter(free);
			if (spots.length) placeAt(spots[pick(spots.length)]);
		}
		// The rest anywhere reachable.
		const spots = maze.cellList.filter(free);
		while (this.monsters.length < target && spots.length) {
			const cell = spots.splice(pick(spots.length), 1)[0];
			if (free(cell)) placeAt(cell);
		}
		// The exit guardian, in a big maze, in a cell next to the exit.
		if (maze.cellList.length >= content.bossMinCells) {
			const next = DUNGEON_DIRS.map(d => this.step(this.exit, d)).filter(c => c && free(c));
			if (next.length) place('guardian', next[0]);
		}
		// A level wobble of -1, 0 or +1 for each monster, fixed here so it is the same for everyone.
		for (const m of this.monsters) m.jitter = pick(3) - 1;
	}

	placeTraps() {
		const content = this.content, maze = this.maze;
		const rng = new Math.seedrandom(`${this.seed}:traps`);
		const spots = maze.cellList.filter(c => this.dist.has(c) && this.dist.get(c) > content.minStartDistance && !this.entranceSet.has(c));
		for (const kind of Object.keys(content.cellsPerTrap)) {
			const count = Math.round(maze.cellList.length / content.cellsPerTrap[kind]);
			for (let i = 0; i < count && spots.length; ++i) {
				const cell = spots.splice(Math.floor(rng() * spots.length), 1)[0];
				this.traps.push({ kind, cell });
			}
		}
	}

	// Potions on the floor: reachable cells away from the start and the entrances, own random stream.
	placePotions() {
		const content = this.content, maze = this.maze;
		const rng = new Math.seedrandom(`${this.seed}:potions`);
		const spots = maze.cellList.filter(c => this.dist.has(c) && this.dist.get(c) > content.minStartDistance && !this.entranceSet.has(c));
		const count = Math.round(maze.cellList.length / content.potions.cellsPerPotion);
		for (let i = 0; i < count && spots.length; ++i) {
			this.potions.push({ cell: spots.splice(Math.floor(rng() * spots.length), 1)[0], heal: content.potions.heal });
		}
		const spCount = Math.round(maze.cellList.length / content.potions.cellsPerSpPotion);
		for (let i = 0; i < spCount && spots.length; ++i) {
			this.potions.push({ cell: spots.splice(Math.floor(rng() * spots.length), 1)[0], sp: content.potions.sp });
		}
	}

	// Charms on the floor: like potions, but never on a hole or pit, with a stream of their own.
	placeCharms() {
		const content = this.content, maze = this.maze;
		const rng = new Math.seedrandom(`${this.seed}:charms`);
		const taken = new Set(this.potions.map(x => x.cell));
		const spots = maze.cellList.filter(c => this.dist.has(c) && this.dist.get(c) > content.minStartDistance && !this.entranceSet.has(c) && !c.data.hole && !taken.has(c));
		const kinds = Object.keys(content.charms);
		const count = Math.floor(rng() * (content.floorCharms + 1));
		for (let i = 0; i < count && spots.length; ++i) {
			const cell = spots.splice(Math.floor(rng() * spots.length), 1)[0];
			this.charms.push({ cell, charm: kinds[Math.floor(rng() * kinds.length)] });
		}
	}

	// A monster's level for a band whose monsters start at level `first` and span `width` levels.
	monsterLevel(monster, first, width) {
		return Math.max(1, first + Math.round(monster.depth * width) + monster.jitter);
	}

	// All the XP in the dungeon for that band: what a full clear is worth ("up to N bonus XP").
	totalXp(first, width) {
		return this.monsters.reduce((sum, m) => sum + dungeonMonsterXp(this.content, m.species, this.monsterLevel(m, first, width)), 0);
	}
}

/*
One run. `hero` is a snapshot the server (or the page, for a guest) builds:
	cls          'warrior' | 'rogue' | 'mage' | 'cleric' | 'ranger' | 'monk'
	level, xp    the hero's level and lifetime XP when the run starts
	safeShare    0..1, the share of every kill's XP that is kept even if the hero dies (4.5)
	xpTable      cumulative XP for each level, index 0 = level 1
	monsters     {first, width}: the first level of the monsters' band and the band's width (3.6)
`nonce` seeds the dice. Pass {events: true} to get a list of what happened with every action
(for the page to animate); the replay leaves it off.

act(letter) returns {ok: true, type, events} or {ok: false, reason}. A refused action changes
nothing. outcome is null while the run goes on, then 'escaped' or 'died'.
*/
class DungeonGame {
	constructor(maze, dungeon, hero, nonce, options = {}) {
		const content = this.content = dungeon.content;
		if (!content.classes[hero?.cls]) throw new Error(`unknown hero class ${hero?.cls}`);
		if (!Number.isInteger(hero.level) || hero.level < 1) throw new Error('hero level must be a whole number from 1');
		if (!(hero.xp >= 0) || !(hero.safeShare >= 0 && hero.safeShare <= 1)) throw new Error('bad hero xp or safeShare');
		if (!Array.isArray(hero.xpTable) || !hero.monsters || !(hero.monsters.first >= 1) || !(hero.monsters.width >= 0)) {
			throw new Error('the hero needs xpTable and monsters {first, width}');
		}
		const carried = hero.potions ?? [];
		const share = x => typeof x == 'string' ? x in content.charms : (typeof x == 'number' ? x : x?.sp) > 0 && (typeof x == 'number' ? x : x?.sp) <= 1;
		if (!Array.isArray(carried) || carried.length > content.potions.carry || !carried.every(share)) {
			throw new Error('hero potions must be a short list of shares (0 to 1], a number for HP or {sp: share} for SP, or a charm name');
		}
		this.maze = maze;
		this.dungeon = dungeon;
		this.hero = hero;
		this.dice = new Dice(`${dungeon.seed}:${nonce}`);
		this.events = options.events ? [] : null;

		this.player = new MazePlayer(maze, false, true);
		this.layer = new TickLayer(this.player, (tick) => this.tick(tick), content.tickPolicy);
		const countTick = this.player.onMove;
		// Arrival effects (a monster in the cell, a trap) come first, then the tick.
		this.player.onMove = (action, result) => {
			this.arrive(action, result);
			countTick(action, result);
		};

		this.level = hero.level;
		this.stats = dungeonHeroStats(content, hero.cls, this.level);
		this.hp = this.stats.maxHp;
		this.sp = this.stats.maxSp;
		this.actions = '';
		this.outcome = null;
		this.steps = 0;
		this.prev = null;            // the cell the last 'move' came from, for fleeing
		this.fight = null;           // {monster, round, firstStrike}
		this.guarding = false;
		this.kills = 0;
		this.xp = 0;                 // all kill XP this run
		this.safeXp = 0;             // the share kept even on a death
		this.maxDist = 0;            // furthest from the start the hero got, in steps
		this.usedTraps = new Set();  // darts and alarms go off once
		this.seenTraps = new Set();  // traps the hero has set off
		this.bag = carried.map(x => typeof x == 'string' ? { charm: x, found: false } : typeof x == 'number' ? { heal: x, found: false } : { sp: x.sp, found: false });   // potions carried, oldest first
		this.potionAt = new Map(dungeon.potions.map(x => [x.cell, x]));
		this.charmAt = new Map(dungeon.charms.map(x => [x.cell, x]));
		this.player.fallGuard = (cell, via) => via == 'step' && this.useCharm('hold');
		this.counts = { fights: 0, attacks: 0, hits: 0, fleeTries: 0, fleeWins: 0, damageTaken: 0, damageDealt: 0, skills: 0, potionsFound: 0, potionsDrunk: 0 };

		// Scent: the last 8 cells the hero stood in, newest with the highest number.
		this.trail = [];
		this.trailSeq = new Map();
		this.seq = 0;
		this.noteTrail(this.player.cell());

		this.trapAt = new Map(dungeon.traps.map(t => [t.cell, t]));
		this.occupied = new Map();
		this.monsters = dungeon.monsters.map(t => {
			const level = dungeon.monsterLevel(t, hero.monsters.first, hero.monsters.width);
			const s = dungeonMonsterStats(content, t.species, level);
			const m = {
				id: t.id, species: t.species, spec: content.monsters[t.species], level,
				element: content.monsters[t.species].element ?? 'neutral',
				...s, hp: s.maxHp, cell: t.cell, home: t.cell,
				xp: dungeonMonsterXp(content, t.species, level),
				state: 'idle', target: null, lastDir: null, frozen: 0, searchLeft: 0, runLeft: 0,
				alive: true, fled: false, usedDart: false,
			};
			this.occupied.set(m.cell, m);
			return m;
		});
	}

	emit(event) {
		if (this.events) this.events.push(event);
	}

	playerCell() {
		return this.player.cell();
	}

	get ticks() {
		return this.layer.ticks;
	}

	// Does one action. See the file header for the letters.
	act(letter) {
		if (this.outcome) return { ok: false, reason: 'the run is over' };
		if (this.events) this.events = [];
		const result = this.fight ? this.fightAct(letter) : this.exploreAct(letter);
		if (!result.ok) return result;
		this.actions += letter;
		return { ok: true, type: result.type, events: this.events };
	}

	exploreAct(letter) {
		if (letter == 'I') return this.drinkPotion();
		if (letter == '1') return this.useSkillExploring();
		if (!'FBLRUDWC'.includes(letter) || letter.length != 1) {
			if ('234'.includes(letter) && letter.length == 1) return { ok: false, reason: 'that skill is not available yet' };
			if ('AGX'.includes(letter) && letter.length == 1) return { ok: false, reason: 'no fight in progress' };
			return { ok: false, reason: `${letter} is not an action` };
		}
		const before = this.playerCell();
		const result = this.player.act(letter);
		if (!result) return { ok: false, reason: 'does nothing' };
		if (result.type == 'move') this.prev = before;
		return { ok: true, type: result.type };
	}

	// ---- the hero arrives somewhere ----

	// Called for every move that counts, before its tick.
	arrive(action, result) {
		if (result.type == 'win') {
			this.outcome = 'escaped';
			this.emit({ type: 'escaped' });
			return;
		}
		if (result.type != 'move' && result.type != 'fall') return;
		const cell = this.playerCell();
		this.noteTrail(cell);
		if (++this.steps % this.content.stepsPerSp == 0) this.sp = Math.min(this.stats.maxSp, this.sp + 1);
		this.maxDist = Math.max(this.maxDist, this.dungeon.dist.get(cell) ?? 0);
		if (result.type == 'fall') {
			// Dropped a floor: it hurts, and there is no stepping back up (so no fleeing that way).
			this.prev = null;
			this.emit({ type: 'fall', via: result.via });
			if (!this.useCharm('feather')) this.hurtHero(fallDamage(this.stats.maxHp));
			if (this.outcome) return;
		}
		this.enterCell(cell);
	}

	// Traps first, then a monster standing there (the hero walked into it).
	enterCell(cell) {
		const trap = this.trapAt.get(cell);
		if (trap) this.springOnHero(trap);
		if (this.outcome) return;
		const charm = this.charmAt.get(cell);
		if (charm && this.bag.length < this.content.potions.carry) {
			this.charmAt.delete(cell);
			this.bag.push({ charm: charm.charm, found: true });
			this.emit({ type: 'charm-found', charm: charm.charm, cell: cell.loc });
		}
		const potion = this.potionAt.get(cell);
		if (potion && this.bag.length < this.content.potions.carry) {
			this.potionAt.delete(cell);
			this.bag.push({ heal: potion.heal, sp: potion.sp, found: true });
			++this.counts.potionsFound;
			this.emit({ type: 'potion-found', cell: cell.loc });
		}
		const monster = this.occupied.get(cell);
		if (monster) {
			// You get the first strike on a monster that had not noticed you.
			this.startFight(monster, monster.state == 'idle' || monster.state == 'wander');
		}
	}

	noteTrail(cell) {
		this.trailSeq.set(cell, ++this.seq);
		this.trail.push(cell);
		if (this.trail.length > 8) {
			const old = this.trail.shift();
			if (!this.trail.includes(old)) this.trailSeq.delete(old);
		}
	}

	springOnHero(trap) {
		const c = this.content;
		if (trap.kind == 'spikes') {
			this.seenTraps.add(trap);
			this.emit({ type: 'trap', kind: 'spikes', cell: trap.cell.loc });
			this.hurtHero(Math.max(1, Math.ceil(this.stats.maxHp * c.trapDamage.spikes)));
		}
		else if (!this.usedTraps.has(trap)) {
			this.usedTraps.add(trap);
			this.seenTraps.add(trap);
			this.emit({ type: 'trap', kind: trap.kind, cell: trap.cell.loc });
			if (trap.kind == 'dart') this.hurtHero(Math.max(1, Math.ceil(this.stats.maxHp * c.trapDamage.dart)));
			else this.alarm(trap.cell);
		}
	}

	// Every monster within range on this floor starts heading for the alarm.
	alarm(cell) {
		for (const m of this.monsters) {
			if (!m.alive || m.state == 'flee') continue;
			if (this.distance(m.cell, cell) > this.content.alarmRadius) continue;
			m.state = 'chase';
			m.target = cell;
		}
	}

	hurtHero(amount) {
		this.hp -= amount;
		this.counts.damageTaken += amount;
		if (this.hp <= 0) {
			this.hp = 0;
			this.outcome = 'died';
			this.fight = null;
			this.emit({ type: 'died' });
		}
	}

	// Manhattan distance on the same floor, or Infinity on another.
	distance(a, b) {
		return a.loc[0] != b.loc[0] ? Infinity : Math.abs(a.loc[1] - b.loc[1]) + Math.abs(a.loc[2] - b.loc[2]);
	}

	// ---- the tick: monsters act ----

	tick(tick) {
		if (this.outcome || this.fight) return;
		for (const m of this.monsters) {
			if (!m.alive) continue;
			if (m.frozen > 0) { --m.frozen; continue; }
			const steps = m.spec.speed == 'fast' ? 2 : m.spec.speed == 'slow' ? (tick % 2 == 0 ? 1 : 0) : 1;
			for (let i = 0; i < steps && m.alive; ++i) {
				this.monsterTurn(m);
				if (this.fight || this.outcome) return;
			}
		}
	}

	// Can the monster see the hero? Same floor, same row or column, nothing in the way, in range.
	canSee(m) {
		return this.lineClear(m.cell, this.playerCell(), m.spec.sight);
	}

	// Two cells on the same floor, in one row or column, within `range`, with nothing in between.
	lineClear(here, there, range) {
		if (here.loc[0] != there.loc[0]) return false;
		const dy = there.loc[1] - here.loc[1], dx = there.loc[2] - here.loc[2];
		if ((dx != 0 && dy != 0) || Math.abs(dx) + Math.abs(dy) > range) return false;
		const dir = dx > 0 ? 'E' : dx < 0 ? 'W' : dy > 0 ? 'S' : 'N';
		for (let cell = here; cell !== there;) {
			const v = cell.data[dir];
			if (!(v === null || (v > 0 && this.player.isDoorOpen(cell, dir)))) return false;
			cell = this.maze.getNextCell(cell, dir);
			if (!cell) return false;
		}
		return true;
	}

	monsterTurn(m) {
		const sees = m.state != 'flee' && this.canSee(m);
		if (sees) {
			if (m.state != 'chase') this.emit({ type: 'alert', monster: m.id });
			m.state = 'chase';
			m.target = this.playerCell();
		}
		switch (m.state) {
			case 'chase':
				// Head for where the hero was last seen; once there (or blocked), follow the scent.
				if (m.cell === m.target && !sees) this.startSearch(m);
				else if (!this.stepToward(m, m.target)) this.startSearch(m);
				break;
			case 'search':
				this.search(m);
				break;
			case 'flee':
				this.runAway(m);
				break;
			default:
				this.wander(m);
		}
	}

	startSearch(m) {
		m.state = 'search';
		m.searchLeft = this.content.searchTicks;
	}

	// Follow the scent: step onto the neighbouring trail cell that is newer than this one.
	search(m) {
		if (--m.searchLeft < 0) { m.state = 'wander'; return; }
		const here = this.trailSeq.get(m.cell) ?? -1;
		let best = null, bestSeq = here, bestDir = null;
		for (const dir of DUNGEON_DIRS) {
			const next = this.canMove(m, dir);
			const seq = next ? this.trailSeq.get(next) : undefined;
			if (seq > bestSeq) { best = next; bestSeq = seq; bestDir = dir; }
		}
		if (best) this.moveMonster(m, bestDir, best, false);
		else m.state = 'wander';
	}

	wander(m) {
		const spec = m.spec;
		if (!spec.wanders) {
			if (m.cell !== m.home) this.stepToward(m, m.home);
			else m.state = 'idle';
			return;
		}
		if (m.state == 'idle') {
			if (this.dice.next() < this.content.wakeChance) m.state = 'wander';
			return;
		}
		if (this.dice.next() < this.content.restChance) { m.state = 'idle'; return; }
		const options = [];
		for (const dir of DUNGEON_DIRS) {
			const next = this.canMove(m, dir);
			if (next && this.distance(next, m.home) <= spec.leash) options.push(dir);
		}
		if (options.length == 0) {
			// Out of its leash (chasing took it away) or boxed in: head home.
			if (m.cell !== m.home) this.stepToward(m, m.home);
			return;
		}
		// Do not turn back unless it is the only way (or the monster is erratic).
		const back = m.lastDir && { N: 'S', S: 'N', E: 'W', W: 'E' }[m.lastDir];
		const ahead = spec.erratic ? options : options.filter(d => d != back);
		const dir = (ahead.length ? ahead : options)[this.dice.int((ahead.length ? ahead : options).length)];
		this.moveMonster(m, dir, this.canMove(m, dir), false);
	}

	// Run from the hero: the step that ends furthest away. Forced, so it triggers traps.
	runAway(m) {
		if (--m.runLeft < 0) { m.state = 'wander'; return; }
		const there = this.playerCell();
		let best = null, bestDir = null, bestDist = this.distance(m.cell, there);
		for (const dir of DUNGEON_DIRS) {
			const next = this.canMove(m, dir);
			const d = next ? this.distance(next, there) : -1;
			if (d > bestDist) { best = next; bestDist = d; bestDir = dir; }
		}
		if (best) this.moveMonster(m, bestDir, best, true);
	}

	// A greedy step towards a cell on the same floor (the longer way first). No pathfinding on
	// purpose (design 3.3). Returns false when no step helps.
	stepToward(m, target) {
		if (!target || target.loc[0] != m.cell.loc[0]) return false;
		const dy = target.loc[1] - m.cell.loc[1], dx = target.loc[2] - m.cell.loc[2];
		const horizontal = dx == 0 ? null : dx > 0 ? 'E' : 'W';
		const vertical = dy == 0 ? null : dy > 0 ? 'S' : 'N';
		const dirs = (Math.abs(dx) >= Math.abs(dy) ? [horizontal, vertical] : [vertical, horizontal]).filter(Boolean);
		if (dirs.length && m.spec.erratic && this.dice.next() < m.spec.erratic) {
			// A bat flutters off in a random direction instead.
			const options = DUNGEON_DIRS.filter(d => this.canMove(m, d));
			if (options.length) {
				const dir = options[this.dice.int(options.length)];
				this.moveMonster(m, dir, this.canMove(m, dir), false);
				return true;
			}
		}
		for (const dir of dirs) {
			const next = this.canMove(m, dir);
			if (next) {
				this.moveMonster(m, dir, next, false);
				return true;
			}
		}
		return false;
	}

	// The cell a monster would reach going `dir`, or null if it cannot (walls, doors it cannot
	// open, ladders, entrances, another monster).
	canMove(m, dir) {
		if (dir == 'U' || dir == 'D') return null;
		const cell = m.cell, v = cell.data[dir];
		if (v !== null && !(v > 0)) return null;
		const next = this.maze.getNextCell(cell, dir);
		if (!next) return null;
		const hero = this.playerCell();
		if (this.dungeon.entranceSet.has(next) && next !== hero) return null;
		if (v > 0 && !this.player.isDoorOpen(cell, dir) && !m.spec.passDoors && !(v == 1 && m.spec.opensPlain)) return null;
		const other = this.occupied.get(next);
		if (other && other !== m) return null;
		return next;
	}

	// Takes a step that canMove approved. Walking into the hero starts a fight.
	moveMonster(m, dir, next, forced) {
		const cell = m.cell;
		if (cell.data[dir] > 0 && !this.player.isDoorOpen(cell, dir) && !m.spec.passDoors) {
			// A goblin or orc opens a plain door as it goes through, and it stays open.
			this.player.openDoors.add(`${cell.loc}${dir}`);
			this.player.openDoors.add(`${next.loc}${opposite[dir]}`);
			this.emit({ type: 'door', monster: m.id, cell: cell.loc, dir });
		}
		this.occupied.delete(cell);
		m.cell = next;
		m.lastDir = dir;
		this.occupied.set(next, m);
		this.emit({ type: 'monster', monster: m.id, from: cell.loc, to: next.loc });
		if (next === this.playerCell()) {
			this.startFight(m, false);
			return;
		}
		if (forced) this.springOnMonster(m);
	}

	// A monster that is forced to move triggers whatever it lands on. Otherwise it knows its way.
	springOnMonster(m) {
		const trap = this.trapAt.get(m.cell);
		if (!trap) return;
		const c = this.content;
		if (trap.kind == 'spikes') {
			this.seenTraps.add(trap);
			this.hurtMonster(m, Math.max(1, Math.ceil(m.maxHp * c.trapDamage.spikes)));
		}
		else if (!this.usedTraps.has(trap)) {
			this.usedTraps.add(trap);
			this.seenTraps.add(trap);
			if (trap.kind == 'dart') this.hurtMonster(m, Math.max(1, Math.ceil(m.maxHp * c.trapDamage.dart)));
			else this.alarm(trap.cell);
		}
	}

	hurtMonster(m, amount) {
		m.hp -= amount;
		if (m.hp <= 0) this.kill(m);
	}

	kill(m) {
		m.hp = 0;
		m.alive = false;
		this.occupied.delete(m.cell);
		++this.kills;
		this.emit({ type: 'kill', monster: m.id, xp: m.xp });
		// Full XP, whatever killed it. Part is kept even if the hero dies (proficiency XP).
		const safe = Math.round(m.xp * this.hero.safeShare);
		this.xp += m.xp;
		this.safeXp += safe;
		const level = dungeonLevelForXp(this.hero.xpTable, this.hero.xp + this.safeXp, this.content.maxLevel);
		if (level > this.level) this.levelUp(level);
	}

	levelUp(level) {
		const before = this.stats.maxHp;
		this.level = level;
		this.stats = dungeonHeroStats(this.content, this.hero.cls, level);
		this.hp += this.stats.maxHp - before;
		this.sp = this.stats.maxSp;
		this.emit({ type: 'level', level });
	}

	// ---- fights ----

	startFight(m, firstStrike) {
		this.fight = { monster: m, round: 0, firstStrike };
		++this.counts.fights;
		this.emit({ type: 'fight', monster: m.id, firstStrike });
	}

	// One round: both sides act, the faster first (the hero on a tie, or on a first strike).
	fightAct(letter) {
		if (letter.length != 1 || !'AGXI1'.includes(letter)) {
			if ('234'.includes(letter) && letter.length == 1) return { ok: false, reason: 'that skill is not available yet' };
			if ('FBLRUDWC'.includes(letter) && letter.length == 1) return { ok: false, reason: 'you are in a fight' };
			return { ok: false, reason: `${letter} is not an action` };
		}
		const f = this.fight, m = f.monster;
		const refusal = letter == 'I' ? this.potionRefusal() : letter == '1' ? this.skillRefusal(true) : null;
		if (refusal) return { ok: false, reason: refusal };
		++f.round;
		this.guarding = letter == 'G';
		if (this.guarding) this.sp = Math.min(this.stats.maxSp, this.sp + this.content.guardSp);
		const heroFirst = (f.round == 1 && f.firstStrike) || this.stats.spd >= m.spd;
		const heroActs = () => {
			if (letter == 'A') this.heroAttacks(m);
			else if (letter == 'X') this.heroFlees(m);
			else if (letter == 'I') this.quaff();
			else if (letter == '1') this.castSkill(m);
		};
		const monsterActs = () => this.monsterAttacks(m);
		if (heroFirst) {
			heroActs();
			if (this.fight) monsterActs();
		}
		else {
			monsterActs();
			if (this.fight) heroActs();
		}
		// A goblin that is nearly dead runs (once).
		if (this.fight && m.spec.flees && !m.fled && m.hp <= m.maxHp * this.content.goblinFleeBelow) {
			m.fled = true;
			m.state = 'flee';
			m.runLeft = this.content.fleeRunTicks;
			this.fight = null;
			this.emit({ type: 'monster-flees', monster: m.id });
		}
		return { ok: true, type: 'fight' };
	}

	// The shared attack roll: to hit, then damage, then a critical. Returns damage, 0 on a miss.
	strike(atk, def, aSpd, dSpd, crit, multiplier = 1) {
		const hit = clampNumber(0.90 + 0.02 * (aSpd - dSpd), 0.60, 0.98);
		if (this.dice.next() >= hit) return 0;
		let damage = atk * (0.85 + 0.3 * this.dice.next()) - def / 2;
		if (this.dice.next() < crit) damage *= this.content.critMultiplier;
		return Math.max(1, Math.round(damage * multiplier));
	}

	heroAttacks(m, multiplier = 1) {
		++this.counts.attacks;
		const damage = this.strike(this.stats.atk, m.def, this.stats.spd, m.spd, this.stats.crit, multiplier);
		this.emit({ type: 'hero-attack', monster: m.id, damage });
		if (damage) this.hitMonster(m, damage);
	}

	hitMonster(m, damage) {
		++this.counts.hits;
		this.counts.damageDealt += damage;
		m.hp -= damage;
		if (m.hp <= 0) {
			this.fight = null;
			this.kill(m);
		}
	}

	// ---- potions and skills ----

	// The oldest potion that would do some good: an HP potion when hurt, an SP potion when SP is down.
	pickPotion() {
		return this.bag.findIndex(x => x.charm ? false : x.sp ? this.sp < this.stats.maxSp : this.hp < this.stats.maxHp);
	}

	// Uses up a charm if the bag has one of that kind. Returns whether it did.
	useCharm(kind) {
		const i = this.bag.findIndex(x => x.charm == kind);
		if (i < 0) return false;
		this.bag.splice(i, 1);
		this.emit({ type: 'charm', charm: kind });
		return true;
	}

	potionRefusal() {
		if (!this.bag.some(x => !x.charm)) return 'no potion to drink';
		if (this.pickPotion() < 0) return 'no potion would help';
		return null;
	}

	// Drink that potion.
	quaff() {
		const potion = this.bag.splice(this.pickPotion(), 1)[0];
		++this.counts.potionsDrunk;
		if (potion.sp) {
			const restored = Math.min(this.stats.maxSp - this.sp, Math.ceil(this.stats.maxSp * potion.sp));
			this.sp += restored;
			this.emit({ type: 'potion', restored });
			return;
		}
		const healed = Math.min(this.stats.maxHp - this.hp, Math.ceil(this.stats.maxHp * potion.heal));
		this.hp += healed;
		this.emit({ type: 'potion', healed });
	}

	drinkPotion() {
		const refusal = this.potionRefusal();
		if (refusal) return { ok: false, reason: refusal };
		this.quaff();
		this.player.onMove('I', { type: 'item' });
		return { ok: true, type: 'item' };
	}

	// The nearest monster the hero could shoot from here, or null.
	shotTarget(range) {
		const here = this.playerCell();
		let best = null, bestDist = Infinity;
		for (const m of this.monsters) {
			if (!m.alive || !this.lineClear(here, m.cell, range)) continue;
			const d = this.distance(here, m.cell);
			if (d < bestDist) { best = m; bestDist = d; }
		}
		return best;
	}

	// Why the level 1 skill cannot be used now, or null. `inFight` says which kind of moment it is.
	skillRefusal(inFight) {
		const k = this.content.skills[this.hero.cls];
		if (this.sp < k.sp) return `not enough SP for ${k.name}`;
		if (k.kind == 'heal') return this.hp >= this.stats.maxHp ? 'already at full health' : null;
		if (k.kind == 'aimed-shot') return inFight || this.shotTarget(k.range) ? null : 'nothing in line to shoot';
		if (k.kind == 'firebolt') return inFight || this.shotTarget(1) ? null : 'nothing in the next cell to burn';
		if (!inFight) return `${k.name} is used in a fight`;
		if (k.kind == 'backstab' && !(this.fight.round == 0 && this.fight.firstStrike)) return 'Backstab needs a first strike';
		return null;
	}

	// The skill in a fight: it takes the hero's action for the round.
	castSkill(m) {
		const k = this.content.skills[this.hero.cls];
		this.sp -= k.sp;
		++this.counts.skills;
		this.emit({ type: 'skill', skill: k.kind });
		if (k.kind == 'heal') this.healSelf(k);
		else if (k.kind == 'firebolt') this.firebolt(m);
		else if (k.kind == 'flurry') {
			for (let i = 0; i < k.hits && this.fight; ++i) this.heroAttacks(m, k.mult);
		}
		else this.heroAttacks(m, k.mult);   // power-strike, backstab, aimed-shot
	}

	// Spell damage ignores DEF and needs no to-hit roll.
	firebolt(m) {
		++this.counts.attacks;
		const damage = Math.max(1, Math.round(this.stats.spell * (0.85 + 0.3 * this.dice.next())));
		this.emit({ type: 'hero-attack', monster: m.id, damage });
		this.hitMonster(m, damage);
	}

	healSelf(k) {
		const healed = Math.min(this.stats.maxHp - this.hp, Math.ceil(this.stats.maxHp * k.heal));
		this.hp += healed;
		this.emit({ type: 'heal', healed });
	}

	// The skill outside a fight: Heal, Aimed Shot at a monster in line, or Firebolt at one in the next cell. Costs a tick.
	useSkillExploring() {
		const refusal = this.skillRefusal(false);
		if (refusal) return { ok: false, reason: refusal };
		const k = this.content.skills[this.hero.cls];
		this.sp -= k.sp;
		++this.counts.skills;
		this.emit({ type: 'skill', skill: k.kind });
		if (k.kind == 'heal') this.healSelf(k);
		else if (k.kind == 'firebolt') {
			const m = this.shotTarget(1);
			this.firebolt(m);
			if (m.alive) { m.state = 'chase'; m.target = this.playerCell(); }
		}
		else {
			const m = this.shotTarget(k.range);
			++this.counts.attacks;
			const damage = this.strike(this.stats.atk, m.def, this.stats.spd, m.spd, this.stats.crit, k.mult);
			this.emit({ type: 'hero-attack', monster: m.id, damage });
			if (damage) this.hitMonster(m, damage);
			// A monster that survives the shot knows where it came from.
			if (m.alive) { m.state = 'chase'; m.target = this.playerCell(); }
		}
		this.player.onMove('1', { type: 'skill' });
		return { ok: true, type: 'skill' };
	}

	monsterAttacks(m) {
		const damage = this.strike(m.atk, this.stats.def, m.spd, this.stats.spd, this.content.monsterCrit, this.guarding ? 0.5 : 1);
		this.emit({ type: 'monster-attack', monster: m.id, damage });
		if (damage) this.hurtHero(damage);
	}

	// The cell the hero came from, if the rules let the hero step back into it.
	fleeCell() {
		const here = this.playerCell(), prev = this.prev;
		if (!prev || this.occupied.has(prev)) return null;
		for (const dir of DUNGEON_ALL_DIRS) {
			if (this.maze.getNextCell(here, dir) === prev && this.player.canWalk(here, dir)) return prev;
		}
		return null;
	}

	// Fleeing steps back to the cell you came from and freezes the monster for a few ticks.
	// It fails if there is nowhere to step back to, and it never works on a boss.
	heroFlees(m) {
		++this.counts.fleeTries;
		const dest = this.fleeCell();
		if (m.spec.boss || !dest) {
			this.emit({ type: 'flee-failed', monster: m.id });
			return;
		}
		const chance = clampNumber(0.5 + 0.1 * (this.stats.spd - m.spd), 0.1, 0.9);
		if (this.dice.next() >= chance) {
			this.emit({ type: 'flee-failed', monster: m.id });
			return;
		}
		++this.counts.fleeWins;
		this.fight = null;
		m.frozen = this.content.fleeFreeze;
		m.state = 'chase';
		m.target = dest;
		[this.player.z, this.player.y, this.player.x] = dest.loc;
		this.prev = null;
		this.noteTrail(dest);
		this.emit({ type: 'fled', monster: m.id });
		this.enterCell(dest);
	}

	// ---- the result ----

	summary() {
		const escaped = this.outcome == 'escaped';
		const bonusXp = this.xp - this.safeXp;
		const grantedXp = this.safeXp + (escaped ? bonusXp : 0);
		return {
			outcome: this.outcome,
			ticks: this.ticks,
			moves: this.player.moves,
			actions: this.actions.length,
			floor: this.player.z + 1,
			progress: Math.min(1, this.maxDist / this.dungeon.exitDist),
			kills: this.kills,
			monsters: this.monsters.length,
			xp: this.xp,
			safeXp: this.safeXp,
			bonusXp,
			grantedXp,
			startLevel: this.hero.level,
			level: this.level,
			endLevel: dungeonLevelForXp(this.hero.xpTable, this.hero.xp + grantedXp, this.content.maxLevel),
			hp: this.hp,
			sp: this.sp,
			potionsLeft: { found: this.bag.filter(x => x.found && !x.charm).length, carried: this.bag.filter(x => !x.found && !x.charm).length },
			charmsLeft: this.bag.filter(x => x.charm).length,
			stats: { ...this.counts, rolls: this.dice.rolls },
		};
	}
}

/*
Replays a finished dungeon run: the same actions, the same dice, the same fights.
	replayDungeon(maze, dungeon, hero, nonce, actions)
		-> {valid: true, outcome: 'escaped' | 'died', ticks, floor, xp, kills, ...}
		or {valid: false, reason: 'action 212 (A): no fight in progress'}
The run must end: by walking out of the exit, or by dying. See DungeonGame.summary for every field.
*/
function replayDungeon(maze, dungeon, hero, nonce, actions, options = {}) {
	if (typeof actions != 'string' || actions.length == 0) {
		return { valid: false, reason: 'no actions' };
	}
	const game = new DungeonGame(maze, dungeon, hero, nonce, options);
	for (let i = 0; i < actions.length; ++i) {
		if (game.outcome) {
			return { valid: false, reason: `actions continue after the run ended at ${i}` };
		}
		const result = game.act(actions[i]);
		if (!result.ok) {
			return { valid: false, reason: `action ${i} (${actions[i]}): ${result.reason}` };
		}
	}
	if (!game.outcome) {
		return { valid: false, reason: 'the run never ended' };
	}
	return { valid: true, ...game.summary() };
}

/*
Builds the daily dungeon from a day's seed (the classic dailySeed, e.g. 202601018): its maze, from
the combat row of MazeParameters (COMBAT), with that row's plain doors, holes and pits added, and
its Dungeon. The maze's own random stream is never used for the dungeon, so nothing here moves a wall.
Returns {params, maze, dungeon, seed} where seed is the dungeon's seed (what the dice are made from).
*/
function buildDungeon(daySeed, content = DUNGEON_CONTENT) {
	const params = new MazeParameters(COMBAT, `${daySeed}:dungeon`);
	const maze = new Maze(params.mazeSeed, params.floors, params.columns, params.rows, params.doorTypes, params.entrances, params.oneWayWalls);
	maze.generateMaze();
	maze.generateDoors();
	maze.generatePlainDoors(params.plainDoors);
	maze.generateHoles(params.holes, params.pits);
	const seed = new Math.seedrandom(`${params.mazeSeed}:dungeon`).int32();
	return { params, maze, dungeon: new Dungeon(maze, seed, content), seed };
}
