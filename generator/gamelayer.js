/*
The game layer: a place for a game's own rules, with no page code.

The maze rules (mazeplayer.js) say how a player moves. A game built on the engine adds its own
world on top: things that sit in cells, things that happen between moves, extra actions, ways to
win or lose. This file is the frame those rules plug into. It knows nothing about what the rules
are, so the same frame runs in the browser and on a server that replays a finished game and
checks it. Both run your rules on the same maze, the same actions and the same dice, so they agree.

You write a ruleset: a plain object with any of these parts. Every part is optional.

	extraActions   true to allow the player actions C (close a door) and W (wait). See MazePlayer.
	tickPolicy     which kinds of move cost a tick (see TickLayer). Default: all but the win.
	actions        {letter: (game, letter) => result}, your own action letters. A result is
	               {ok: true} or {ok: false, reason}. A letter must not be one of F B L R U D T C W.
	place          (maze, seed, dice) => [{kind, cell, ...data}]. The things to put in the maze,
	               decided once per maze and seed. The result is plain data (it refers to cells of that maze), so
	               a server may cache it next to the maze.
	start          (game, setup) => void. Called once, before the first action. `setup` is whatever
	               you passed in about the player (a class, a level, a starting bag).
	allows         (game, letter) => null, or a reason the action is refused right now
	               (a player in a fight cannot walk away).
	onArrive       (game, action, result) => void. After a move that counts, before its tick.
	               `result` is what MazePlayer reported ({type: 'move' | 'turn' | 'fall' | ...}).
	               This is where a ruleset reacts to where the player is.
	onTick         (game, tick, action, result) => void. The world's turn.
	summary        (game) => object. Extra fields for the replay result.

And your rules change the world through the game object they are handed:

	game.dice            the seeded dice. Draw from them in the same order every time.
	game.player          the MazePlayer.
	game.contents        the things in the maze (see Contents below): spawn, remove, find.
	game.moveTo(cell)    the movement hook: put the player somewhere else (a teleporter).
	game.emit(event)     report something that happened, for a page to animate.
	game.end(outcome)    finish the game.

Randomness is one stream, `${seed}:${nonce}`: each attempt gets a fresh nonce, and every roll of
a game comes from that one stream in the order the actions happen. Placement uses its own stream,
`${seed}:place`, so it never disturbs the dice.
*/

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

/*
The things in the maze. Each has a kind (any string you like), a cell, and whatever else you add.
Ids are handed out in order, so a replay that spawns the same things in the same order gets the
same ids. Start from the list `place` returned; spawn and remove as the game goes on.
*/
class Contents {
	constructor(list = []) {
		this.items = new Map();
		this.nextId = 1;
		for (const spec of list) { this.spawn(spec.kind, spec.cell, spec); }
	}

	// Adds a thing and returns it. `data` is copied onto it.
	spawn(kind, cell, data = {}) {
		const thing = { ...data, id: this.nextId++, kind, cell };
		this.items.set(thing.id, thing);
		return thing;
	}

	remove(thing) {
		this.items.delete(typeof thing == 'number' ? thing : thing.id);
	}

	get(id) {
		return this.items.get(id) ?? null;
	}

	// Everything in a cell, oldest first.
	at(cell) {
		return this.all().filter(t => t.cell === cell);
	}

	// Everything of one kind, oldest first.
	ofKind(kind) {
		return this.all().filter(t => t.kind == kind);
	}

	all() {
		return [...this.items.values()];
	}
}

// How many arrivals one action may chain (a teleporter that lands on a teleporter, and so on).
const MAX_ARRIVAL_DEPTH = 16;

class RuleGame {
	static movementLetters = 'FBLRUDTCW';

	constructor(maze, ruleset, setup = {}, seed = 0, nonce = 0, options = {}) {
		this.maze = maze;
		this.ruleset = ruleset;
		this.setup = setup;
		this.seed = seed;
		this.dice = new Dice(`${seed}:${nonce}`);
		this.events = options.events ? [] : null;
		this.actions = '';
		this.outcome = null;
		this.arrivalDepth = 0;

		for (const letter of Object.keys(ruleset.actions ?? {})) {
			if (letter.length != 1 || RuleGame.movementLetters.includes(letter)) {
				throw new Error(`"${letter}" cannot be a custom action letter`);
			}
		}

		this.player = new MazePlayer(maze, false, !!ruleset.extraActions);
		this.layer = new TickLayer(this.player, (tick, action, result) => {
			if (ruleset.onTick) ruleset.onTick(this, tick, action, result);
		}, ruleset.tickPolicy ?? TickLayer.defaultPolicy);
		// Arrival effects come first, then the tick (so a monster in the cell acts after the player is there).
		const countTick = this.player.onMove;
		this.player.onMove = (action, result) => {
			this.arrive(action, result);
			countTick(action, result);
		};

		// A ruleset may hand in its own placement (a server's cached one) instead of having it made here.
		const placed = options.placed ?? RuleGame.place(maze, ruleset, seed);
		this.contents = new Contents(placed);
		if (ruleset.start) ruleset.start(this, setup);
	}

	// Decides what is in the maze, once. Cache the result next to the maze and pass it as options.placed.
	static place(maze, ruleset, seed) {
		return ruleset.place ? ruleset.place(maze, seed, new Dice(`${seed}:place`)) : [];
	}

	get ticks() {
		return this.layer.ticks;
	}

	emit(event) {
		if (this.events) this.events.push(event);
	}

	end(outcome) {
		if (!this.outcome) this.outcome = outcome;
	}

	/*
	The movement hook. Puts the player on `cell` (facing `dir`, default unchanged), tells the page
	with a 'teleport' event, and runs onArrive again for the new cell with a result of
	{type: 'teleport', from}. A ruleset decides what to do there; answering a teleport with another
	teleport chains, up to a limit, so a loop of teleporters is an error and not a freeze.
	*/
	moveTo(cell, dir = undefined) {
		if (++this.arrivalDepth > MAX_ARRIVAL_DEPTH) {
			throw new Error('too many arrivals in one action: do the teleporters form a loop?');
		}
		try {
			const from = this.player.cell();
			const result = this.player.moveTo(cell, dir);
			result.from = from;
			this.emit({ type: 'teleport', from, to: cell });
			this.arrive('teleport', result);
		}
		finally {
			--this.arrivalDepth;
		}
	}

	arrive(action, result) {
		if (this.ruleset.onArrive) this.ruleset.onArrive(this, action, result);
	}

	/*
	Does one action. Returns {ok: true, ...} or {ok: false, reason}. A refused action changes nothing
	and is not recorded. A finished game refuses everything.
	*/
	act(letter) {
		if (this.outcome) return { ok: false, reason: 'the game is over' };
		if (typeof letter != 'string' || letter.length != 1) return { ok: false, reason: `${letter} is not an action` };
		const refusal = this.ruleset.allows ? this.ruleset.allows(this, letter) : null;
		if (refusal) return { ok: false, reason: refusal };

		let result;
		if (RuleGame.movementLetters.includes(letter)) {
			result = this.player.act(letter);
			if (!result) return { ok: false, reason: 'that does nothing right now' };
			result = { ok: true, ...result };
		}
		else if (this.ruleset.actions?.[letter]) {
			result = this.ruleset.actions[letter](this, letter);
			if (!result?.ok) return { ok: false, reason: result?.reason ?? 'refused' };
		}
		else {
			return { ok: false, reason: `${letter} is not an action` };
		}
		this.actions += letter;
		if (this.player.won) this.end('won');
		return result;
	}

	summary() {
		return {
			outcome: this.outcome,
			ticks: this.ticks,
			moves: this.player.moves,
			actions: this.actions.length,
			rolls: this.dice.rolls,
			...(this.ruleset.summary ? this.ruleset.summary(this) : {}),
		};
	}
}

/*
Replays a finished game: the same actions, the same dice, the same result.
	replayRun(maze, ruleset, setup, seed, nonce, actions, options)
		-> {valid: true, outcome, ticks, moves, ...your summary}
		or {valid: false, reason: 'action 212 (A): no fight in progress'}
The game must end (by winning or by your rules calling game.end). Pass options.placed to reuse a
cached placement.
*/
function replayRun(maze, ruleset, setup, seed, nonce, actions, options = {}) {
	if (typeof actions != 'string' || actions.length == 0) {
		return { valid: false, reason: 'no actions' };
	}
	const game = new RuleGame(maze, ruleset, setup, seed, nonce, options);
	for (let i = 0; i < actions.length; ++i) {
		if (game.outcome) {
			return { valid: false, reason: `actions continue after the game ended at ${i}` };
		}
		const result = game.act(actions[i]);
		if (!result.ok) {
			return { valid: false, reason: `action ${i} (${actions[i]}): ${result.reason}` };
		}
	}
	if (!game.outcome) {
		return { valid: false, reason: 'the game never ended' };
	}
	return { valid: true, ...game.summary() };
}
