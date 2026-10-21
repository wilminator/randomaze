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
	D  climb a ladder down
Actions that do nothing (bumping a wall, a locked door, a missing ladder) are free and
are not recorded, so a game's move count is always the length of its action string.
The page can also pass the time of each move, which is kept alongside in `times`.
*/
class MazePlayer {
	static turnLeft = { 'N': 'W', 'W': 'S', 'S': 'E', 'E': 'N' };
	static turnRight = { 'N': 'E', 'E': 'S', 'S': 'W', 'W': 'N' };

	// debug lets the player walk through walls (never through the outside walls).
	constructor(maze, debug = false) {
		this.maze = maze;
		this.debug = debug;
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
		{type: 'door', key}          opened the door ahead, which took key number `key`
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
		if (result.type == 'move' || result.type == 'turn' || result.type == 'door') {
			const cell = this.cell();
			const key = cell.data.item.key;
			if (key && !this.takenKeys.has(`${cell.loc}`)) {
				this.takenKeys.add(`${cell.loc}`);
				this.keys.push(key);
				result.pickedUp = key;
			}
		}
		return result;
	}

	// Would this action do anything right now? It asks the same question tryAction answers but
	// changes nothing, so the touch buttons can hide the moves that would only bump.
	canAct(action) {
		return !this.won && this.resolve(action, false) !== null;
	}

	tryAction(action) {
		return this.resolve(action, true);
	}

	// The one place that knows what an action does. With commit false it only reports the
	// result and leaves the player alone, so canAct and tryAction can never disagree.
	resolve(action, commit) {
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
							if (commit) this.fallenWalls.add(wall);
							return { type: 'trap' };
						}
						if (commit) this.won = true;
						return { type: 'win' };
					}
					if (commit) {
						this.x += dx[dir];
						this.y += dy[dir];
					}
					return { type: 'move' };
				}
				if (cell.data[dir] > 0 && this.keys.includes(cell.data[dir])) {
					if (commit) {
						const next = this.maze.getNextCell(cell, dir);
						this.openDoors.add(`${cell.loc}${dir}`);
						this.openDoors.add(`${next.loc}${opposite[dir]}`);
					}
					return { type: 'door', key: cell.data[dir] };
				}
				return null;
			case 'B': {
				const back = opposite[dir];
				if ((cell.data[back] === null && !this.isOutside(cell, back)) || (cell.data[back] > 0 && this.isDoorOpen(cell, back))) {
					if (commit) {
						this.x -= dx[dir];
						this.y -= dy[dir];
					}
					return { type: 'move' };
				}
				return null;
			}
			case 'L':
				if (commit) this.dir = MazePlayer.turnLeft[dir];
				return { type: 'turn' };
			case 'R':
				if (commit) this.dir = MazePlayer.turnRight[dir];
				return { type: 'turn' };
			case 'U':
				if (this.z < this.maze.floors - 1 && cell.data.U === null) {
					if (commit) ++this.z;
					return { type: 'move' };
				}
				return null;
			case 'D':
				if (this.z > 0 && cell.data.D === null) {
					if (commit) --this.z;
					return { type: 'move' };
				}
				return null;
		}
		return null;
	}
}

/*
Replays a finished game. Every action must count as a move and the last one must walk out
of the exit, so a valid game's score is simply actions.length.
Returns {valid: true, moves} or {valid: false, reason}.
*/
function replayGame(maze, actions) {
	if (typeof actions != 'string' || actions.length == 0) {
		return { valid: false, reason: 'no actions' };
	}
	const player = new MazePlayer(maze);
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
	return { valid: true, moves: player.moves };
}
