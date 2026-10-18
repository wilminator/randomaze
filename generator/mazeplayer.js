/*
The rules for moving through a maze, with no page code.

The browser UI asks a MazePlayer what each key press does and only animates the answer.
A server can rebuild the same maze from its seed and replay a finished game's actions to
check the result: replayGame(maze, actions).

An action is one letter, and every action that counts as a move is recorded:
	F  forward, or open the door ahead
	B  back
	L  turn left
	R  turn right
	U  climb a ladder up
	D  climb a ladder down, or drop through a hole you can see
	T  tie a rope to the hole you are standing on (needs a rope, see below)
A dungeon game (see below) adds two more:
	C  close the open door ahead (a door that needs a key stays closed to monsters, and you
	   keep the key, so you can always open it again)
	W  wait a move
Actions that do nothing (bumping a wall, a locked door, a missing ladder) are free and
are not recorded, so a game's move count is always the length of its action string.

Holes (see Maze.generateHoles) are one-way drops: a cell with data.hole has an open floor and the cell
below it has a solid ceiling.
	- A hole you can see never drops you by accident: walk across it, or press D to drop on purpose.
	- A pit (data.pit) is a hole nobody has spotted. Stepping onto it drops you at once, with the
	  action that stepped. Once it has caught someone, or been added to `revealedPits` (a Rogue's
	  Trap Sense, say), it behaves like any other hole.
	- Every drop is a 'fall' (it hurts, the dungeon decides how much). With a rope tied to the hole,
	  going down is an ordinary 'move' and U climbs back up. Ropes are counted in `ropes`, which
	  whoever sets up the run fills in; the rules only spend them.
The page can also pass the time of each move, which is kept alongside in `times`.

Moves and ticks are separate layers. A move is what the maze's rules say it is, and the classic
game knows nothing else. A tick is the dungeon's clock: monsters act on ticks. The player has a
hook, `onMove(action, result)`, called after every move that counts. Classic play installs
nothing. A dungeon installs a TickLayer (below), whose policy says which kinds of move cost a
tick. This file is DOM-free, so the server's replay installs the same layer and gets the same ticks.
*/
class MazePlayer {
	static turnLeft = { 'N': 'W', 'W': 'S', 'S': 'E', 'E': 'N' };
	static turnRight = { 'N': 'E', 'E': 'S', 'S': 'W', 'W': 'N' };

	// debug lets the player walk through walls (never through the outside walls).
	// dungeon turns on the actions only a dungeon has: C (close a door) and W (wait).
	constructor(maze, debug = false, dungeon = false) {
		this.maze = maze;
		this.debug = debug;
		this.dungeon = dungeon;
		// Called as onMove(action, result) after every move that counts. See TickLayer.
		this.onMove = null;
		const start = maze.entranceList[0];
		[this.z, this.y, this.x] = start.cell.loc;
		this.dir = opposite[start.dir];
		this.keys = [1];
		this.actions = '';
		// When each recorded move happened, if the caller passed times (ms since the game began).
		this.times = [];
		this.won = false;
		// Play state lives here, not on the cells, so one maze can be replayed many times.
		this.openDoors = new Set();
		this.fallenWalls = new Set();
		this.takenKeys = new Set();
		// Holes: pits that are known now, holes with a rope tied, and ropes in the pack.
		this.revealedPits = new Set();
		this.ropedHoles = new Set();
		this.ropes = 0;
	}

	get moves() {
		return this.actions.length;
	}

	cell() {
		return this.maze.grid[this.z][this.y][this.x];
	}

	// The opening a cell's entrance goes through. The UI draws these as the outside.
	isOutside(cell, dir) {
		const entrance = this.maze.entranceList.find(e => e.cell === cell);
		return !!entrance && entrance.dir == dir && cell.data[dir] === null;
	}

	isDoorOpen(cell, dir) {
		return this.openDoors.has(`${cell.loc}${dir}`);
	}

	canWalk(cell, dir) {
		return cell.data[dir] === null || (cell.data[dir] > 0 && this.isDoorOpen(cell, dir));
	}

	/*
	Does one action. Returns what happened, or null when nothing did (no move is counted):
		{type: 'move'}               walked forward, back, up or down
		{type: 'turn'}
		{type: 'fall', via}          dropped one floor through a hole. `via` is 'step' when walking onto
		                             an unseen pit (the player also moved across), 'drop' for D
		{type: 'rope'}               tied a rope to the hole underfoot
		{type: 'door', key}          opened the door ahead, which took key number `key`
		{type: 'close', key}         dungeon only: closed the open door ahead (its key number)
		{type: 'wait'}               dungeon only: let a move pass
		{type: 'trap'}               tried to leave by an entrance that is not the exit;
		                             its wall drops and that costs one move, once
		{type: 'win'}                walked out of the exit
	A move, turn or door also picks up a key on the player's cell; then `pickedUp` holds
	its number. `time` (optional) is recorded with the move; the rules ignore it.
	*/
	act(action, time = null) {
		if (this.won) return null;
		const result = this.tryAction(action);
		if (!result) return null;
		this.actions += action;
		if (time !== null) this.times.push(time);
		if (result.type == 'move' || result.type == 'turn' || result.type == 'door' || result.type == 'fall') {
			const cell = this.cell();
			const key = cell.data.item.key;
			if (key && !this.takenKeys.has(`${cell.loc}`)) {
				this.takenKeys.add(`${cell.loc}`);
				this.keys.push(key);
				result.pickedUp = key;
			}
		}
		// Last, so the hook sees the finished result (including pickedUp).
		if (this.onMove) this.onMove(action, result);
		return result;
	}

	tryAction(action) {
		const cell = this.cell();
		const dir = this.dir;
		switch (action) {
			case 'F':
				if (this.canWalk(cell, dir) || (this.debug && !this.isOutside(cell, dir))) {
					if (this.isOutside(cell, dir)) {
						if (cell !== this.maze.entranceList[this.maze.entrances - 1].cell) {
							// Only the first try at a wrong entrance counts; after that it's a wall.
							const wall = `${cell.loc}${dir}`;
							if (this.fallenWalls.has(wall)) return null;
							this.fallenWalls.add(wall);
							return { type: 'trap' };
						}
						this.won = true;
						return { type: 'win' };
					}
					this.x += dx[dir];
					this.y += dy[dir];
					return this.landOn();
				}
				if (cell.data[dir] > 0 && this.keys.includes(cell.data[dir])) {
					const next = this.maze.getNextCell(cell, dir);
					this.openDoors.add(`${cell.loc}${dir}`);
					this.openDoors.add(`${next.loc}${opposite[dir]}`);
					return { type: 'door', key: cell.data[dir] };
				}
				return null;
			case 'C':
				// Only a door that is open can be closed. The key stays with the player.
				if (this.dungeon && cell.data[dir] > 0 && this.isDoorOpen(cell, dir)) {
					const next = this.maze.getNextCell(cell, dir);
					this.openDoors.delete(`${cell.loc}${dir}`);
					this.openDoors.delete(`${next.loc}${opposite[dir]}`);
					return { type: 'close', key: cell.data[dir] };
				}
				return null;
			case 'W':
				return this.dungeon ? { type: 'wait' } : null;
			case 'B': {
				const back = opposite[dir];
				if ((cell.data[back] === null && !this.isOutside(cell, back)) || (cell.data[back] > 0 && this.isDoorOpen(cell, back))) {
					this.x -= dx[dir];
					this.y -= dy[dir];
					return this.landOn();
				}
				return null;
			}
			case 'L':
				this.dir = MazePlayer.turnLeft[dir];
				return { type: 'turn' };
			case 'R':
				this.dir = MazePlayer.turnRight[dir];
				return { type: 'turn' };
			case 'U':
				// A ladder, or the rope tied to the hole above.
				if (this.z < this.maze.floors - 1 && (cell.data.U === null || this.isRoped(this.maze.grid[this.z + 1][this.y][this.x]))) {
					++this.z;
					return { type: 'move' };
				}
				return null;
			case 'D':
				if (this.z > 0 && cell.data.D === null) {
					if (!cell.data.hole || this.isRoped(cell)) {
						--this.z;
						return { type: 'move' };
					}
					this.fall(cell);
					return { type: 'fall', via: 'drop' };
				}
				return null;
			case 'T':
				if (cell.data.hole && this.ropes > 0 && !this.isRoped(cell)) {
					--this.ropes;
					this.ropedHoles.add(`${cell.loc}`);
					this.revealedPits.add(`${cell.loc}`);
					return { type: 'rope' };
				}
				return null;
		}
		return null;
	}

	isRoped(cell) {
		return !!cell && this.ropedHoles.has(`${cell.loc}`);
	}

	// The player has just walked onto a new cell. An unseen pit swallows them.
	landOn() {
		const cell = this.cell();
		if (cell.data.pit && !this.revealedPits.has(`${cell.loc}`)) {
			this.fall(cell);
			return { type: 'fall', via: 'step' };
		}
		return { type: 'move' };
	}

	// Drops one floor from a hole. Whoever fell knows about the hole from now on.
	fall(cell) {
		this.revealedPits.add(`${cell.loc}`);
		--this.z;
	}
}

/*
The tick trigger (the dungeon's clock). Install it on a player and it counts a tick for every
move whose type the policy allows, then calls onTick(tick, action, result) so the dungeon can
let monsters act. The policy is content data: changing it changes the game, so records say
which rules version they were played under.
*/
class TickLayer {
	// Every kind of move costs a tick, turns included, as the design starts out.
	static defaultPolicy = { move: true, turn: true, door: true, close: true, wait: true, trap: true, win: false };

	constructor(player, onTick = null, policy = TickLayer.defaultPolicy) {
		this.policy = policy;
		this.onTick = onTick;
		this.ticks = 0;
		player.onMove = (action, result) => {
			if (!this.policy[result.type]) return;
			++this.ticks;
			if (this.onTick) this.onTick(this.ticks, action, result);
		};
	}
}

/*
Replays a finished game. Every action must count as a move and the last one must walk out
of the exit, so a valid game's score is simply actions.length.
Returns {valid: true, moves} or {valid: false, reason}.
Pass {dungeon: true} to allow C and W and count ticks; the result then also has `ticks`.
Other options: tickPolicy (see TickLayer) and onTick(tick, action, result).
*/
function replayGame(maze, actions, options = {}) {
	if (typeof actions != 'string' || actions.length == 0) {
		return { valid: false, reason: 'no actions' };
	}
	const dungeon = !!options.dungeon;
	const player = new MazePlayer(maze, false, dungeon);
	const layer = dungeon ? new TickLayer(player, options.onTick, options.tickPolicy) : null;
	for (let i = 0; i < actions.length; ++i) {
		if (player.won) {
			return { valid: false, reason: `actions continue after the win at ${i}` };
		}
		if (!player.act(actions[i])) {
			return { valid: false, reason: `action ${i} (${actions[i]}) does nothing` };
		}
	}
	if (!player.won) {
		return { valid: false, reason: 'the player never left the maze' };
	}
	return layer ? { valid: true, moves: player.moves, ticks: layer.ticks } : { valid: true, moves: player.moves };
}

/*
HP lost to one fall through a hole: a tenth of max HP, never less than 1.
`halved` is the Warrior's Iron Skin; `immune` is the Monk's Feather Fall. The player's rules above
only say a fall happened ({type: 'fall'}); the dungeon turns that into damage with this.
*/
function fallDamage(maxHp, { halved = false, immune = false } = {}) {
	if (immune) { return 0; }
	return Math.max(1, Math.round(maxHp * 0.1 * (halved ? 0.5 : 1)));
}
