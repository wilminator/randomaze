// Configuration 
const oneWayWallDistance = 1;

// Constants
const dx = { 'E':  1, 'W': -1, 'N':  0, 'S':  0 , 'U':  0, 'D':  0 };
const dy = { 'E':  0, 'W':  0, 'N': -1, 'S':  1 , 'U':  0, 'D':  0 };
const dz = { 'E':  0, 'W':  0, 'N':  0, 'S':  0 , 'U':  1, 'D': -1 };
const opposite = { 'E': 'W', 'W': 'E', 'N': 'S', 'S': 'N', 'U': 'D', 'D': 'U' };

function getDir(dx, dy, dz = 0) {
	return dx != 0 ? ['W', '', 'E'][dx + 1] : dy != 0 ? ['N', '', 'S'][dy + 1] : ['D', '', 'U'][dz + 1];
}

class Maze {
	constructor(seed, floors, columns, rows, doorTypes, entrances, oneWayWalls) {
		this.seed = seed;
		this.generator = new Math.seedrandom(seed);
		this.generateInt = generateIntegerWrapper(this.generator);
		this.floors = floors;
		this.columns = columns;
		this.rows = rows;
		this.doorTypes = doorTypes;
		this.entrances = entrances;
		this.oneWayWalls = oneWayWalls;
		this.buildGrid();
		this._debug = false;
	}
	
	debug(mazehtml) {	
		var hasMap = 'map' in this.grid[0][0][0];
		this._debug = mazehtml && hasMap;
		this._mazehtml = this._debug ? mazehtml : false;
		if (mazehtml) {
			mazehtml.debug(this._debug);
			mazehtml.renderMap();
		}
		return this._debug;
	}
	
	buildGrid(){
		// Define the grid property.
		this.grid = [];
		// Create the grid array.
		for (var f = 0; f < this.floors; ++f) {
			// Add floor.
			const floorArray = [];
			this.grid.push(floorArray);			
			for (var r = 0; r < this.rows; ++r) {
				// Add row
				const rowArray = [];
				floorArray.push(rowArray);
				for (var c = 0; c < this.columns; ++c) {
					/* 
					Comments on cell data structure:
					
					Core values are in the data property.
					Additional properties are used for display, maze building, etc.
					
					N, S, E, W, U, D are walls in 3 dimensions. 
					null is no wall. 
					0 = solid wall.
					1 = unlocked door.
					>= 2 = door requiring a key item.
					U and D will always be wither null or 0.
					
					item is the item present.
					null is no object here.
					Otherwise should be a object. Properties define the object type,
					values define the object of that type.
					
					loc is an array of the floor, row, and column of this cell.
					It is used as a lookup into the grid for pathing purposes.
					
					dist is the distance from the starting/ending point.
					positive values are from the starting point.
					negative values are from the ending point.
					*/
					// rowArray.push({'e':cell,'data':{'N':0,'S':0,'E':0,'W':0,'U':0,'D':0,'mark':null,'item':null},'work':{'dist':null,'ent':null},'loc':[f,r,c]});
					rowArray.push({'data':{'N':0,'S':0,'E':0,'W':0,'U':0,'D':0,'item':{}},'loc':[f,r,c],'play':{'visited':false,'item':{}}});
				}	
			}
		}
		
		// Create a flat list of all grid cells.
		this.cellList = this.grid.flat(3);
		
	}
	
	generateWorkProperty(initial={}) {
		this.cellList.map(x=>x.work=Object.assign({}, initial));
	}

	clearWorkProperty() {
		this.cellList.map(x=>delete x.work);
	}

	getNextCell(cell, dir){
		// Get the cell location.
		var [f, r, c] = cell.loc;
		// Get the adjacent location.
		f += dz[dir];
		r += dy[dir];
		c += dx[dir];
		if (r >= 0 && r < this.rows && c >= 0 && c < this.columns && f >= 0 && f < this.floors) {			
			return this.grid[f][r][c];
		}
		return null;
	}

	availablePaths(cell, entrance = [null], skipStairs = false){
		// Location format:
		// floor, row, column (z,y,x)
		const result = [];
		const dirs = ['N','S','E','W','U','D'];
		if (skipStairs) { dirs.splice(4,2); }
		for (const dir of dirs) {
			const nextCell = this.getNextCell(cell, dir);
			if (this._debug) {
				if (nextCell) {console.log(`Current: ${cell.loc} ${cell.work.ent} Next ${nextCell.loc} ${nextCell.work.ent}`);}
			}
			if (nextCell && entrance.includes(nextCell.work.ent)) {
				if ((dir != 'U' && dir != 'D') || 
					cell.data[opposite[dir]] !== null && (this.availablePaths(nextCell, entrance, true).length > 0)) {
					result.push([dir, nextCell]);
				}
			}
		}
		return result;
	}

	setWall(cell, dir, wallValue = null){	
		// Remove the wall.
		cell.data[dir] = wallValue;	
		if (this._debug) {
			// Update the cell color.
			this._mazehtml.renderMapDebug(cell, dir, {'background-color':'#FFF'});
		}
	}

	getDistance(c1, c2){
		var [f1, r1, c1] = c1.loc;
		var [f2, r2, c2] = c2.loc;
		return Math.abs(f1 - f2) + Math.abs(r1 - r2) + Math.abs(c1 - c2)
	}

	countHorizontalPaths(cell){
		return ['N','S','E','W'].filter(dir => cell.data[dir] === null).length
	}

	getStairCount(cell, dir){
		const f = cell.loc[0];
		const floor = this.grid[f].flat(2);
		const noStairs = floor.filter(c => c.data[dir]===null);
		return noStairs.length;
	}

	getUnusedCellCount(cell){
		const f = cell.loc[0];
		const floor = this.grid[f].flat(2);
		const freeCells = floor.filter(c => c.work.ent===null);
		return freeCells.length;
	}

	/*
	Return true if this cell is still useful and false if not.
	*/
	filterStairs (cell, available, have, free, dir){
		var index;
		// This is a hack: Up or Down will always be the last two options, if present.
		for (index = Math.max(0, available.length - 2); index < available.length; ++index){
			// Exit the loop if index points at dir.
			if (available[index][0] == dir) { break; }
		}
		if (index < available.length){
			// Check how many stairs go this direction on this floor.
			const stairs = this.getStairCount(cell, dir);
			// If there are too many stairs, then remove this direction as an option. 
			if (stairs >= Math.sqrt(this.rows * this.columns) * 0.5) {
				// Remove this direction as a choice.
				available.splice(index, 1);
				// Flag this cell as no longer useful.
				return false;
			}
			// Also factor in if there are additional floors beyond the one to move into.
			const f = cell.loc[0];
			const toEndFloor = dir == 'U' ? this.floors - f - 1: f;
			// Count the free cells on this floor.
			const floorFree = this.getUnusedCellCount(cell);		
			// Calculate the odds of allowing this stair to be an option.
			const area = this.rows * this.columns;
			const ratio = (area - floorFree) * toEndFloor / area  / ((stairs + 1) * (stairs + 1));
			// If there are too many stars or we fail our probability roll, then
			// remove this direction as an option.
			if (this.generator() > ratio) {
				// Remove this direction as a choice.
				available.splice(index, 1);
			}		
			// Return true that this cell is still useful.
			return true;
		}
		// This direction was not found as available. This cell is not useful.
		return false;
	}

	measureDistanceFromPath(startCell, path, outward = false , keys = [1]){
		// This sets the value of dist to its number of steps away from startCell.
		// If endCell is defined, when it is reached this algorithm stops.
		// Outward determines if the path is being built inward towards start (E2S),
		// or outward from start (S2E).
		// Keys are a list of keys the travler has; allows doors to be traversed.
		// Default for keys allows unlocked doors to be traveled.
		
		// push all points on the path onto the stack.
		const stack = [startCell];
		var currentCell = startCell;
		while (path.length > 0) {
			// Get the direction to travel.
			const dir = path[0];
			path = path.slice(1);
			// Get the next cell.
			currentCell = this.getNextCell(currentCell, dir);
			// Add this cell to the stack.
			stack.push(currentCell);
		}
		// Call the core measuring function.
		this.measureDistanceCore(stack, null, outward, keys);
	}

	measureDistance(startCell, endCell = null, outward = false , keys = [1], stack = null){
		// This sets the value of dist to its number of steps away from startCell.
		// If endCell is defined, when it is reached this algorithm stops.
		// Outward determines if the path is being build inward towards start,
		// or outward from start.
		// Keys are a list of keys the travler has; allows doors to be traversed.
		// Default for keys allows unlocked doors to be traveled.
		
		var reset = false;
		// Next, find the shortest distance to the start from the end.
		if (stack === null) {
			stack = [startCell];
			reset = true;
		}
		this.measureDistanceCore(stack, endCell, outward, keys, reset);
		return stack;
	}

	measureDistanceAgain(startCell, outward = false , keys = [1]){
		// This measures from a second point. The smaller of the two values is kept.
		// The largest values are the furthest from all points.
		
		// Abort if there is not already a measurement.
		if (startCell.work.dist === null){
			return null;
		}
		
		const stack = [startCell];
		startCell.work.dist = 0
		this.measureDistanceCore(stack, null, outward, keys, false);
		return stack;
	}

	measureDistanceCore(stack, endCell = null, outward = false , keys = [1], reset = true){
		if (reset) {
			// First reset the dist value on all cells. This will be used to
			// indicate the distance from the end cell.		
			this.cellList.forEach(cell => cell.work.dist=null);
			// Set the distance of all points on the stack to 0.
			stack.forEach(cell => cell.work.dist = 0);
			// Render debug HTML if needed.
			if (this._debug) { 
				this._mazehtml.debugResetToStack(stack);
			};
			
		}
		while (stack.length > 0){
			/*
			The algorithm concept is simple.
			Set the start cell(s) to 0 distance.
			Flag all unflagged adjcaent cells as one more distance from the start cell(s).
			Repeat the adjacency test and flagging until the ending cell is reached
			or all options are exhausted.
			*/
			// Get the next cell to work on.
			const cell = stack.shift();
			// Get all directions available from this cell.		
			for (const dir of ['N','S','E','W','U','D']) {
				// Get the next cell in this direction.
				const nextCell = this.getNextCell(cell, dir);
				// If the next cell has not yet been visited and can reach this cell,
				// set it 1 farther from the end					
				if (nextCell && (nextCell.work.dist === null || nextCell.work.dist > cell.work.dist + 1)) {
					const cellValue = outward ? cell.data[dir] : nextCell.data[opposite[dir]];
					if (cellValue === null || keys.includes(cellValue)) {
						nextCell.work.dist = cell.work.dist + 1;
						if (this._debug) { 
							this._mazehtml.renderMapDebug(nextCell, null, null, nextCell.work.dist);
						}
						// If this is not the start cell, then 
						// add it to the stack for processing.
						// This test will always be true if no endCell is defined.
						if (nextCell !== endCell) {
							stack.push(nextCell);
						}
						else { 
							// Empty the stack to end the outer loop and break the inner loop.
							stack.splice(0, stack.length);
							break; 
						}	
					}
				}
			}
		}
	}

	pathfind(startCell, endCell, outward = false, mapAll = false, keys = [1]){
		/*
		pathfind
		See if a traversable path exists between a start and end point.

		startCell (Array[int]) - x,y,z coordinates to start from
		endCell (Array[int]) - x,y,z coordinates to try to navigate to
		outward (bool) - The pathfinding algorithm can be worked from start to end or from 
			end to start. The order matters for one-way wall support. The default of false 
			is opposite what is expected by the player for traversing to a goal- it works 
			from end to start seeing if the adjacent cell can enter the current cell. 
		mapAll (bool) - The function by default will stop calculations when the path finds a 
			working path. Setting this to true will continue path distance calcualtions for 
			all reachable cells, which may be desireable when looking for adjacent reachable 
			spaces to place related objects.
		keys (Array[int]) - The doors that will be allowed to be traversed in this pass. 
			1 is "no wall" and should always be included if any value is provided.
		*/
		// Set the cell measurments from the end to the start.
		this.measureDistance(endCell, mapAll ? null : startCell, outward, keys);
		// Starting at the start cell, identify the path to the end
		// by always following the neighbor with the smallest distance to the end.
		var path = "";
		var currentCell = startCell;
		while (currentCell !== endCell) {
			var unmoved = true;
			// In all cases, the first neighbor with a distance that's less than 
			// the current cell is the shortest path back.
			const dirs = ['N','S','E','W','U','D'].filter(dir => currentCell.data[dir] === null || keys.includes(currentCell.data[dir]));
			for (const dir of dirs) {
				// Get the next cell in this direction.
				const nextCell = this.getNextCell(currentCell, dir);
				if (nextCell && nextCell.work.dist !== null && nextCell.work.dist < currentCell.work.dist) {
					// Add the correct move to get to where you need to go.
					path += dir;					
					// Flag as moved.
					unmoved = false;
					if (this._debug) {
						// Highlight the path.
						this._mazehtml.renderMapDebug(currentCell, null, {'background-color':'#0FF'});
						this._mazehtml.renderMapDebug(nextCell, null, {'background-color':'#F80'});
					}
					// Make the nextCell the currentCell.
					currentCell = nextCell;
					// Abort this loop.
					break;
				}
			}
			if (unmoved) {
				// No path present.
				return null;
			}
		}		
		// We have reached the end.
		if (this._debug) {
			// Mark the start as blue.			
			this._mazehtml.renderMapDebug(startCell, null, {'background-color':'#00F'});
			// Mark the end as green.
			this._mazehtml.renderMapDebug(currentCell, null, {'background-color':'#0F0'});
		}
		return path;
	}

	ensureSolvable(entranceStart, entranceEnd) {
		/*
		The maze will always be solvable, unless there are one-way walls...
		*/
		const solution = this.pathfind(this.entranceList[entranceStart].cell, this.entranceList[entranceEnd].cell);
		if (!solution) {
			//alert(`Maze cannot be traversed from entrance ${entranceStart+1} to ${entranceEnd+1}`);
			// So let's fix the maze. pathfind measures backwards from the end, so at this point
			// there is a distance marker for every cell that can still REACH entranceEnd.
			// Reset the tag on all cells.
			this.cellList.map(x=>{x.work.tag=null;});
			// Tag these cells in work so we can find cells that are connected to the other entrance.
			const enders = this.cellList.filter(x=>x.work.dist!==null);
			enders.forEach(x=>{x.work.tag=entranceEnd;});
			// Now walk outward from the start (outward = true).
			// This will mark the cells the player can get to from the start.
			const moonwalk = this.pathfind(this.entranceList[entranceEnd].cell, this.entranceList[entranceStart].cell, true);
			// Now all cells with a distance and no tag get tagged for this entrance.
			const starters = this.cellList.filter(x=>x.work.dist!==null && x.work.tag == null);
			starters.forEach(x=>{x.work.tag=entranceStart;});
			// Generate a list of all start tagged cells that are adjacent to end tagged cells.
			// Opening a wall from a start cell into an end cell joins the two: the player
			// reaches the start cell, steps through, and can carry on to the end.
			const adjacent = starters.map(c=>{return {cell: c, dir:['N','S','E','W','U','D'].filter(d=>{const n = this.getNextCell(c, d); return n && n.work.tag == entranceEnd;})};}).filter(x=>x.dir.length > 0);
			// Pick one.
			const opener = adjacent[this.generateInt(adjacent.length)];
			// Open sesame!
			const cell = opener.cell;
			const dir = opener.dir[this.generateInt(opener.dir.length)];
			console.log(`Creating opening to fix unsolvable maze path loc:${cell.loc} dir:${dir}`);
			this.setWall(cell, dir);
			// If the opener is a ladder, then reciprocate.
			if (dir == 'U' || dir == 'D') {
				const other = this.getNextCell(cell, dir);
				this.setWall(other, opposite[dir]);		
			}

			// Retry the solve
			return this.ensureSolvable(entranceStart, entranceEnd);
		}
		return solution;
	}

	generateMaze(){
		// This adds the work propery to cells. It is used as cell-related working data.		
		this.generateWorkProperty({'dist':null,'ent':null});
	
		/*
		This is an array of lists. 
		Each array corresponds with the connected cells from each respective entrance.
		*/
		var mazeCells = [];		

		// These are the entrances.
		this.entranceList = [];

		for (var e = 0; e < this.entrances; ++e){
			// This is a check to ensure the same entrance is not picked twice.
			findEntrances: while (true) {
				var f = this.generateInt(this.floors);
				const s = this.generateInt(4);
				const dir = ['N','W','S','E'][s];
				var r,c,pos;
				if (s % 2 == 0){
					r = s==0 ? 0 : this.rows - 1;
					c = this.generateInt(this.columns);
					pos = c;
				}
				else {
					c = s==1 ? 0 : this.columns - 1;
					r = this.generateInt(this.rows);
					pos = r;
				}
				const cell = this.grid[f][r][c];
				// Check here for prior use. Compare cells, not sides: a corner cell sits on two sides,
				// and two entrances sharing it would leave one entrance with no cells of its own.
				for (var i = 0; i < e; ++i) {
					if (this.entranceList[i].cell === cell) {
						continue findEntrances
					}
				}
				// Record this entrance.
				this.entranceList.push({'cell':cell,'floor':f,'dir':dir,'pos':pos});
				// Add this starting cell to known maze cells.
				mazeCells.push({'entrance':e, 'path':[cell], 'count':1});
				// Flag the entrance for filtering later.
				cell.work.ent = e;			
				// The distance from the entrance is 0
				cell.work.dist = 0;
				// Debugging data
				if (this._debug) {
					// Update the entrance cell.
					this._mazehtml.renderMapDebug(cell, null, {'background-color':'#FFF'}, cell.work.ent);								
					// Update the entrance grid.
					this._mazehtml.debugEntranceGrid(f, dir, pos, e+1);				
				}
				// Open the outside of the maze.	
				this.setWall(cell, dir);
				// Now escape the endless loop
				break
			}
		}

		// Define the number of remaining unused cells in this maze.
		var remainingCells = this.floors * this.rows * this.columns - this.entrances;

		// Start the Growing Tree algorithm.
		while (mazeCells.length > 0) {
			const removePath = []
			for (const entPathIdx in mazeCells){
				const entSet = mazeCells[entPathIdx];
				const entPath = entSet.path;
				if (entPath.length == 0) {
					removePath.push(entPathIdx);
					continue;
				}
				// Get a cell of the stack. 
				// We want to weigh more heavily on the most recent cells.		
				const cellIdx = Math.floor(Math.sqrt(this.generateInt(entPath.length * entPath.length)));
				const cell = entPath[cellIdx];
				// Check if this cell has unused neighbors.		
				const available = this.availablePaths(cell);
				// Next, if the option to create a stair exists, we weight it so stairs are rare.
				// Also taken into consideration the distance to the top or bottom.		
				const useful = this.filterStairs (cell, available, entSet.count, remainingCells, 'D') | this.filterStairs (cell, available, entSet.count, remainingCells, 'U');
				// If there are available direction options, then we make a new path.
				if (available.length > 0) {
					const [dir, nextCell] = available[this.generateInt(available.length)];
					// Remove this wall.
					this.setWall(cell, dir);
					// Mark the entrance set this is a part of.
					nextCell.work.ent = cell.work.ent;
					if (this._debug){
						this._mazehtml.renderMapDebug(nextCell, null, null, nextCell.work.ent);						
					}
					// Remove the next cell's opposite wall.
					this.setWall(nextCell, opposite[dir]);			
					// Set the distance from the entrance.
					nextCell.work.dist = cell.work.dist + 1;
					//nextCell.map.tooltip({title:nextCell.work.dist,placement:'right'});
					// Add the new location to the list.
					entPath.push(nextCell);
					// Add one to the entrance cell count.
					entSet.count += 1
					// Remove one from the unused cells counter.
					remainingCells -= 1
				}
				// Otherwise remove this location from the list.
				else {
					entPath.splice(cellIdx, 1);
					// If the cell is still useful, place it on the top of the list (least likely to be picked).
					// Useful is defined as a stair COULD be placed here, but was filtered out.
					if (useful) {
						entPath.unshift(cell);
					}
				}		
			}
			while (removePath.length > 0) {
				mazeCells.splice(removePath.pop(), 1);
			}			
		}

		// If there was more than one entrance, then link path sets.
		// Find the wall with different entrance sets that have the highest distance sum from the entrances (longest path).
		const joinedEntrances = [0];
		const connectedEntrances = [];
		while (joinedEntrances.length < this.entrances) {
			// Get the next unjoined entrance.
			var nextEntrance=0;
			while (joinedEntrances.includes(nextEntrance)) { ++nextEntrance; }
			const results = [];
			while (results.length < 1) {
				const ordered = this.cellList.filter(cell => cell.work.ent == nextEntrance).sort((a, b) => a.work.dist - b.work.dist);
				// Get at least 10 candidates. Get 20 more for each pair of one way walls asked for.
				while (ordered.length > 0 && results.length < 10 * (this.oneWayWalls + 1)) {
					const cell = ordered.pop();
					for (const [dir, nextCell] of this.availablePaths(cell, joinedEntrances, this.oneWayWalls > 0)) {
						results.push([cell.work.dist + nextCell.work.dist + this.generateInt(5), dir, cell, nextCell]);
					}		
				}
				if (ordered.length == 0 && results.length == 0) {
					nextEntrance++;
					while (joinedEntrances.includes(nextEntrance)) { ++nextEntrance; }
					if (nextEntrance >= this.entrances) {
						this.oneWayWalls = 0;
						nextEntrance = 0;
						break;
					}
				}
			}
			if (results.length == 0)  { continue; }
			// Update joined entrances.
			joinedEntrances.push(nextEntrance);
			// Sort results by the longest distance.
			results.sort((a, b) => a[0] - b[0] );
			// Note the entrances joined.
			connectedEntrances.push([results[0][2].work.ent, results[0][3].work.ent]);
			// If no one-way walls are asked for, then make the longest distance making path.
			if (this.oneWayWalls == 0) {
				const [dist, dir, cell, nextCell] = results.pop();
				// Remove this wall.
				this.setWall(cell, dir);
				// Remove the next cell's opposite wall.
				this.setWall(nextCell, opposite[dir]);			
				if (this._debug) {
					// Highlight them
					this._mazehtml.renderMapDebug(cell, null, {'background-color':'#FF2'});
					this._mazehtml.renderMapDebug(nextCell, null, {'background-color':'#FF2'});
				}
			}
			else {
				// For each one way wall asked for, get a pair of cells.
				for (var way = 0; way < this.oneWayWalls; ++way){
					// Each one-way pair needs two candidate walls: one out, one back in.
					// Filtering below can use up the candidates, so stop early when it does.
					if (results.length < 2) {
						// If not even one pair was made, the areas are still unconnected.
						// Fall back to a normal two-way opening.
						if (way == 0) {
							const [dist, dir, cell, nextCell] = results.pop();
							this.setWall(cell, dir);
							this.setWall(nextCell, opposite[dir]);
						}
						break;
					}
					// Get the longest cell pair. This is the outbound wall.
					const [farDist, farDir, farCell, farNextCell] = results.shift();
					// Get the shortest cell pair. This is the inbound wall.
					const [nearDist, nearDir, nearCell, nearNextCell] = results.pop();
					// Remove the far wall out to the other entrance.
					this.setWall(farCell, farDir);
					// Remove the near next cell's opposite wall back into this area.
					this.setWall(nearNextCell, opposite[nearDir]);
					// Add arrows if debugging.
					if (this._debug) {
						// Highlight far cell
						this._mazehtml.renderMapDebug(farCell, null, {'background-color':'#FF2'});
						this._mazehtml.renderMapDebug(farNextCell, null, {'background-color':'#F82'});
						// Highlight near cell
						this._mazehtml.renderMapDebug(nearNextCell, null, {'background-color':'#FF2'});
						this._mazehtml.renderMapDebug(nearCell, null, {'background-color':'#F82'});
						// Make direction pointers.
						this._mazehtml.debugOneWayArrow(farCell, farDir);
						this._mazehtml.debugOneWayArrow(nearNextCell, opposite[nearDir]);
					}
					for (var idx = results.length -1; idx >= 0; --idx){
						const c1 = results[idx][2];
						const c2 = results[idx][3];
						if (this.getDistance(c1, nearCell) <= oneWayWallDistance ||
							this.getDistance(c1, farCell) <= oneWayWallDistance ||
							this.getDistance(c2, nearNextCell) <= oneWayWallDistance ||
							this.getDistance(c2, farNextCell) <= oneWayWallDistance) {
							// This cell is too close to the one way door. Remove it.
							results.splice(idx, 1);
						}
					}
				}
			}
		}
		// Now identify which entrances have more than one connection to other entrances.
		// These should not be the first or last entrance.
		

		// Next remove cells that only one way up or down but all four walls (stairways to nowhere)
		// These can be safely annexed to any adjacent cell.
		// Loop until no changes are done.
		do {	
			var changed = false;
			for (const cell of this.cellList) {
				// xor of stair check trips if only one stair is in the cell.
				if (this.countHorizontalPaths(cell) == 0 && (cell.data.U === null ^ cell.data.D === null)) {
					changed=true;
					// First, remove the stairs.
					const stairDir = cell.data.U === null ? 'U' : 'D';
					const stairCell = this.getNextCell(cell, stairDir);
					cell.data[stairDir] = 0;
					stairCell.data[opposite[stairDir]] = 0;
					// Next pick a wall and break through to the other side.
					var nextCell, dir;
					do {
						dir = ['N','S','W','E'][this.generateInt(4)];
						nextCell = this.getNextCell(cell, dir);
					} while (!nextCell);
					// Break down the wall.
					// Remove this wall.
					this.setWall(cell, dir);
					// Mark the entrance set this is a part of.
					cell.work.ent = nextCell.work.ent;
					// Remove the next cell's opposite wall.
					this.setWall(nextCell, opposite[dir]);			
					// Set the distance from the entrance.
					nextCell.work.dist = cell.work.dist + 1;
					if (this._debug) {
						// Update the display to remove the stairs.
						this._mazehtml.renderMapDebug(cell, null, {'background-color':'#F88'}, cell.work.ent);
						this._mazehtml.renderMapDebug(stairCell, null, null, stairCell.work.ent);
					}
				}
			}
		} while (changed);

		// Now pathfind between successive entrances to verify that the maze is solvable.		
		for (var e = 0; e < this.entrances - 1; ++e) {
			const solution = this.ensureSolvable(e, e + 1);
			const rsolution = this.ensureSolvable(e + 1, e);
		}
		// This cleans up the work propery of cells.
		this.clearWorkProperty();
	}
	
	generateDoors() {
		/*
		Door placement is tricky. This is in part because this is how we create 
		situations where the player cannot solve the maze by
		1. Trapping them (because of one-way walls)
		2. Putting keys behind doors they need the keys for.

		To work through this, door placement is handled with the following overall algorithm:
		1. Determine the shortest path from the first entrance to the last entrance.
		2. Place doors along that path to prevent progress.
		3. Hide keys for those doors in the maze where the player can find them.
		4. Optionally, repeat steps 2 and 3 for keys to further obstruct the player.

		When chosing to place a key, it may be placed anywhere on the player's side of the maze.
		However, the key may either be placed in a part of the maze that is available only when the
		dorr that the key opens is reachable to the player or it may be placed in an earlier part of 
		the maze. Generally speaking, putting the key closer to the door allows for a quicker 
		progression.
		*/
		// This adds the work propery to cells. It is used as cell-related working data.		
		this.generateWorkProperty({'dist':null,'ent':null,'key':null});
		// Pathfind between successive entrances to verify that the maze is solvable.
		const solvedPaths = []
		for (var e = 0; e < this.entrances - 1; ++e) {
			if (this._debug) {
				this._mazehtml.renderMap();
			}
			const solution = this.pathfind(this.entranceList[e].cell, this.entranceList[e + 1].cell);
			solvedPaths.push(solution);
			// If debug is enabled, clean up the map.
		}
		if (this._debug) {
			this._mazehtml.renderMap();
		}
		
		// Setup doorways as desired.
		/*
		Identify initial door points until we run out of doorTypes:
		1. Place on the correct path to the next entrance.
		2. Must be placed after the path is no longer backtracking from the prior entrance.
		3. Place keys somewhere reachable but remote.

		Unused doorTypes can be used to bait and switch the keys for the above doors.
		1. Pathfind to the key.
		2. Put a door up on the way to the key.
		3. Hide the new key somewhere remote that the player can get to.

		Also consider doors and keys with no purpose.
		   
		So the overall process for deploying doors and keys is:
		1. Pathfind from the expected starting point to the destination.
		2. Throw up a door on this path.
		3. Identify all cells that can still be reached from the starting point.
		4. Put the key in a reachable cell.
		*/

		// Define the maze start and stop parameters.
		const startCell = this.entranceList[0].cell;
		const endCell = this.entranceList[this.entranceList.length - 1].cell;

		// Find the average number of cells per entrance beyond the first one.
		const cellsPerEnt = this.floors * this.rows * this.columns / (this.entrances - 1);
		// Find an estimate for the total number of doors to put into the maze.
		const tgtDoors = this.floors * this.rows * this.columns / 30;
		// Identify how many doors will be dedicated to entrances, hiding keys, and fake outs.
		const kProb = [this.generateInt(30,60), this.generateInt(30,60), this.generateInt(30,60)];
		const kTot = kProb.reduce((t, c)=> t + c, 0);
		var [kEnt, kKeys, kFake] = kProb.map(c=>Math.floor(c * this.doorTypes / kTot));
		// Adjust kEnt by any missing keys caused by rounding.
		kEnt += this.doorTypes - (kEnt + kKeys + kFake);
		
		// Calculate the number of entrance blocking keys desired.		
		const tgtEnt = this.generateInt(this.entrances - 1,(this.entrances - 1) * 2);		
		
		// If there are not enough keys for between each entrance, steal some from kFake.
		if (kEnt < tgtEnt) {
			const delta = Math.min(tgtEnt - kEnt, kFake);
			kEnt += delta;
			kFake -= delta;
		}
		// If there are still not enough keys for between each entrance, steal some from kKeys.
		if (kEnt < tgtEnt) {
			const delta = Math.min(tgtEnt - kEnt, kKeys);
			kEnt += delta;
			kKeys -= delta;
		}
		// If there are more keys for entrances than are needed, give them to extra keys.		
		else if (kEnt > tgtEnt) {
			const delta = kEnt - tgtEnt;
			kEnt -= delta;
			kKeys += delta;
		}

		// Next, identify the entrances to get doors.
		var keyEntranceFilter = this.entranceList.length-1-kEnt > 0 ? 
			this.entranceList
				.slice(1)
				.map(value => ({ value, sort: this.generator() }))
				.sort((a, b) => a.sort - b.sort)
				.map(({ value }) => value)
				.slice(this.entranceList.length-1-kEnt) :
			this.entranceList.slice(1);

		// Reset the map so we can track overlapping paths.
		this.cellList.forEach(c => c.work.ent = []);
		if (this._debug) {
			this._mazehtml.debugResetToEmpty(); 
		}
		// Update the map with the paths that each cell is a part of.
		for (var e=0; e < this.entranceList.length - 1; ++e){	
			const endCell = this.entranceList[e+1].cell;
			var path = solvedPaths[e];
			var currentCell = this.entranceList[e].cell;
			currentCell.work.ent.push(e);
			if (this._debug) {
				this._mazehtml.renderMapDebug(currentCell, null, null, currentCell.work.ent.join(','));
			}
			while (currentCell !== endCell) {
				const dir = path[0];
				path = path.slice(1);
				currentCell = this.getNextCell(currentCell, dir);
				currentCell.work.ent.push(e);
				if (this._debug) {
					this._mazehtml.renderMapDebug(currentCell, null, null, currentCell.work.ent.join(','));
				}
			}
		}
		// An array of currently held keys.
		// 1 is a gimme- it is unlocked doors.
		const currentKeys = [1];
		var nextKey = 2;
		const placedKeys = [];
		var entrancesWithDoors = 0;		
		for (var e=0; e < this.entranceList.length - 1; ++e) {
			const startCell = this.entranceList[e].cell;
			const endCell = this.entranceList[e+1].cell;
			if (!keyEntranceFilter.includes(this.entranceList[e+1])) {
				continue;
			}
			// We're adding doors here.
			++entrancesWithDoors;			
			var currentStartCell = startCell;
			var path = solvedPaths[e];
			var currentCell = startCell;
			var travelable;
			while (currentCell !== endCell) {
				// Get the direction to travel.
				const dir = path[0];
				path = path.slice(1);
				// Get the next cell.
				const nextCell = this.getNextCell(currentCell, dir);
				// Only if there is not overlap with a previous path,
				if (currentCell.work.ent.filter(c => c<e).length == 0 
					&& nextCell.work.ent.filter(c => c<e).length == 0
					&& dir != 'U'
					&& dir != 'D'){
					// Block the wall with a door.
					this.setWall(currentCell, dir, nextKey);
					this.setWall(nextCell, opposite[dir], nextKey);
					// Do a full pathfind from the starting cell. 
					// We're counting how many cells can be traveled without this key.
					// !!!**** this.measureDistance(currentStartCell, null, true, currentKeys);
					// New and improved! Find the largest distance from the path needed
					// to travel from the last point to this door.
					const shortPath = this.pathfind(currentStartCell, currentCell, true);
					// If there's a path from the door to the current starting cell, then continue.
					if (shortPath){						
						this.measureDistanceFromPath(currentStartCell, shortPath, true , currentKeys);
						// Flag all cells that have a distance and are not part of another keyset as belonging to this key.
						this.cellList.forEach(function (cell){ if (cell.work.key === null && cell.work.dist !== null) { cell.work.key = nextKey; } });
						// Perform a check that none of the remaining entrances were tagged by this last fill.
						// If so, then we are done placing doors for this entrance.
						var entIdx = e+1;
						for (; entIdx < this.entranceList.length; ++entIdx) {
							if (this.entranceList[entIdx].cell.work.key == nextKey) { break; }
						}
						// If the loop was broke, then we have a clear path to the real end.
						if (entIdx != this.entranceList.length) {
							// Unpaint cells.
							if (this._debug) {
								const _mazehtml = this._mazehtml;
								this.cellList.forEach(function (cell){ 
									if (cell.work.key == nextKey) { 
										_mazehtml.renderMapDebug(cell, null, {'background-color':'white'}); 
									}
								});
							}
							// Unflag all cells that have this key.
							this.cellList.forEach(function (cell){ if (cell.work.key == nextKey) { cell.work.key = null; } });
							// Remove door.
							this.setWall(currentCell, dir);
							this.setWall(nextCell, opposite[dir]);
							// Break the walking loop.
							break;
						}
						// Paint cells.
						if (this._debug) {
							const _mazehtml = this._mazehtml;
							this.cellList.forEach(function (cell){ 
								if (cell.work.key == nextKey) { 
									_mazehtml.renderMapDebug(cell, null, {'background-color':_mazehtml.debugKeyColor(nextKey)}); 
								}
							});
						}
						// Count the cells with a measurement over 1. This makes the player look harder for a key.
						travelable = this.cellList.filter(cell => cell.work.dist !== null && cell.work.dist > 1 && cell.work.key == nextKey);
						if (travelable.length >= 20) {
							// Place the key somewhere reachable. 
							// There must be open paths between the key and the door in both directions!						
							const culDeSac = travelable.filter(c => ['N','S','E','W','U','D'].filter(dir=>c.data[dir] === null).length == 1 && Object.keys(c.data.item).length == 0).sort((a,b) => a.work.dist - b.work.dist);
							culDeSac.splice(0,Math.floor(culDeSac.length * .75));
							const keyPlace = culDeSac[this.generateInt(culDeSac.length)];
							keyPlace.data.item.key = nextKey;
							placedKeys.push({key:nextKey, 
								start:startCell, 
								end:endCell, 
								door: currentCell,
								doorDir: dir,
								lastDoor:currentStartCell, 
								keyPlace:keyPlace});
							
							// Display the key on the map.
							if (this._debug) {							
								this._mazehtml.renderMapDebugKey(keyPlace, nextKey, {'background-color':'white'}); 
							}
							nextKey += 1;
							
							// If we have not placed enough doors to meet the quota
							// for entrance doors so far, then place another one.
							if (placedKeys.length < (kEnt * entrancesWithDoors / keyEntranceFilter.length)){
								// Advance to the next cell to get past this door.
								currentCell = nextCell;
								currentStartCell = currentCell;
								continue;
							}
							else {
								break;
							}
						}
					}
					// Remove door.
					this.setWall(currentCell, dir);
					this.setWall(nextCell, opposite[dir]);
				}
				currentCell = nextCell;
			}
		}

		// Mark the index of the last main path door.
		const lastMainPathDoor = nextKey - 1;
		
		// The main paths have now been blocked. Now hide those keys.
		// If not all keys were used to block the main path, then add them for hiding.
		if (placedKeys.length < kEnt) {
			kKeys += kEnt - placedKeys.length;
		}		
				
		// If there are not enough keys for hiding entrance keys, steal some from kFake.
		const tgtKKeys = Math.max(Math.floor(this.cellList.length / 25) - kEnt, 0);
		if (kKeys < tgtKKeys) {
			const delta = Math.min(tgtKKeys - kKeys, kFake);
			kKeys += delta;
			kFake -= delta;
		}
		// If there are more keys for hiding entrance keys than are needed, give them to kFakes.
		else if (kKeys > tgtKKeys) {
			const delta = kKeys - tgtKKeys;
			kKeys -= delta;
			kFake += delta;
		}
		// If there are too many fakes, then reduce the count.
		const tgtKFake = Math.max(0, this.doorTypes - kEnt - kKeys);
		if (kFake > tgtKFake) { kFake = tgtKFake; }
		
		/*
		IMPORTANT:
		This is to add doors between the last door placed and the true exit.
		It will be removed after hiding doors are placed.
		*/
		placedKeys.push({key:-1, 
			start: placedKeys.length > 0 ? placedKeys[placedKeys.length -1].lastDoor : this.entranceList[0].cell, 
			end: this.entranceList[this.entranceList.length -1].cell, 
			door: this.entranceList[this.entranceList.length -1].cell,
			doorDir: null,
			lastDoor: placedKeys.length > 0 ? this.getNextCell(placedKeys[placedKeys.length -1].door, placedKeys[placedKeys.length -1].doorDir) : this.entranceList[0].cell, 
			keyPlace: this.entranceList[this.entranceList.length -1].cell})
		
		// Now place key hiding doors.
		// Identify the keys to get blocking doors.
		const keyKeyFilter = placedKeys.length-kKeys > 0 ?
			placedKeys
				.map(value => ({ value, sort: this.generator() }))
				.sort((a, b) => a.sort - b.sort)
				.map(({ value }) => value.key)
				.slice(placedKeys.length-kKeys) :
			placedKeys.map(v=>v.key);

		/*
		TODO: This assumes minimal backtracking. That is, the key for the next
		door will always be behind the current door. Develop a branch that 
		allows for this current key to be placed in a previous area if the
		next door will block this key.
		*/
		// Loop through the keys we may hide.
		const morePlacedKeys = [];
		var keyPass = 0;
		const collectedKeys = [];
		for (const placedKey of placedKeys) {		
			if (!keyKeyFilter.includes(placedKey.key)) {
				// Add this key to the keychain.
				collectedKeys.push(placedKey.key);
				continue;
			}
			var iteration = 0;
			++keyPass;
			var startingKeyLocation = placedKey.keyPlace;
			while (morePlacedKeys.length <  kKeys * keyPass / keyKeyFilter.length) {
				// This time we have three places of interest: starting entrance, ending entrance, and the location of the key.
				// Start by blocking this key. Find the path from this key to the entrance.
				// If there is no path, then abort.
				const entranceInsteadOfDoor = this.generator() < .2;
				var path = this.pathfind(startingKeyLocation, placedKey.start, true, false, collectedKeys);				
				if (path === null) { break; }
				var currentCell = startingKeyLocation;
				var lastCell = currentCell;
				var travelable;
				while (currentCell !== placedKey.start) {
					// Get the direction to travel.
					const dir = path[0];
					path = path.slice(1);
					// Get the next cell.
					const nextCell = this.getNextCell(currentCell, dir);
					if (dir != 'U' 
						&& dir != 'D' 
						&& currentCell.data[dir] === null
						&& nextCell.data[opposite[dir]] === null
						) {
						// Block the wall with a door.
						this.setWall(currentCell, dir, nextKey);
						this.setWall(nextCell, opposite[dir], nextKey);
						// Do a full pathfind from the starting cell. 
						// We're counting how many cells are behind this door.
						this.measureDistance(startingKeyLocation, null, false, []);
						// Count the cells with a measurement.
						travelable = this.cellList.filter(c => c.work.dist !== null);
						const travelableBehind = travelable.length;
						// Now count how many cells are before this door.
						this.measureDistance(nextCell, null, false, []);
						// Count the cells with a measurement.
						travelable = this.cellList.filter(c => c.work.dist !== null);
						// For each iteration, reduce the space needed by 5.
						if (travelableBehind >= Math.max(5, 15 - iteration * 5) && travelable.length >= 5) {							
							if (entranceInsteadOfDoor) {
								// Recalculate travelable from the entrance starting point.
								// Use collected keys. This will be a long run unless the 
								// player stumbles onto the key early.
								this.measureDistance(placedKey.start, null, true, collectedKeys);
								// Measure again from the door.
								this.measureDistanceAgain(nextCell, true, collectedKeys);
							}
							else {
								// Place the key after the last main door.
								// Forces exploration of the new area.
								this.measureDistance(placedKey.lastDoor, null, true);
								// Measure again from the door.
								this.measureDistanceAgain(nextCell, true);
							}
							// Count the cells with a measurement.
							travelable = this.cellList.filter(c => c.work.dist !== null);					
							// Place the key somewhere reachable.
							const culDeSac = travelable.filter(c => ['N','S','E','W','U','D'].filter(dir=>c.data[dir] === null).length == 1 && Object.keys(c.data.item).length == 0).sort((a,b) => a.work.dist - b.work.dist);
							culDeSac.splice(0,Math.floor(culDeSac.length * .75));
							// With no dead end left to hide the key in, skip this door and try the next one.
							var pathExists = null, keyPlace;
							while (culDeSac.length > 0 && pathExists === null) {
								const placeIdx = this.generateInt(culDeSac.length);
								keyPlace = culDeSac[placeIdx];
								culDeSac.splice(placeIdx,1);
								// Confirm that with all keys acquired prior to this door that the player can still navigate from the starting point to the key.
								if (this._debug) {
									this._mazehtml.renderMap();
								}
								pathExists = this.pathfind(this.entranceList[0].cell, keyPlace, false, false, collectedKeys);
								if (this._debug) {
									this._mazehtml.renderMap();
								}
								pathExists = pathExists && this.pathfind(nextCell, keyPlace, false, false, collectedKeys);
							}
							if (pathExists !== null) {
								// Place this key as planned.
								morePlacedKeys.push(nextKey);
								keyPlace.data.item.key = nextKey;
								// Display the key on the map.
								if (this._debug) {							
									this._mazehtml.renderMapDebugKey(keyPlace, nextKey); 
								}
								nextKey += 1;
								// Update the startingKeyLocation for another pass if the outer while loop holds.
								startingKeyLocation = keyPlace;
								iteration += 1;
								break;
							}
						}
						// Remove door.
						this.setWall(currentCell, dir);
						this.setWall(nextCell, opposite[dir]);
					}
					lastCell = currentCell;
					currentCell = nextCell;					
				}
				if (currentCell === placedKey.start) {
					// reached the end.
					break;
				}
			}
			// Add found keys.
			collectedKeys.push(placedKey.key);
			morePlacedKeys.forEach( function (key){ if (!collectedKeys.includes(key)) {collectedKeys.push(key);} } );
		}	

		// Now fix the maze as needed. This usually happens if there are one-way walls.
		while (true) {
			// Exact check: once the maze is solvable, also guarantee no one-way wall can trap the player.
			if (this.removeOneWayTraps(startCell, endCell).solvable) {
				break;
			}
			var failed = this.mazeFail(startCell, endCell);
			if (failed === false) {
				// mazeFail assumes the player can gather every key they can reach. A one-way wall
				// can force a choice between keys, which breaks that assumption. Making every wall
				// two-way lets the player always go back, so both checks agree again.
				console.log('One-way walls make the maze unsolvable. Opening them both ways.');
				// With no one-way walls left the checks always agree, but never loop forever.
				if (!this.openAllOneWayWalls()) { break; }
				continue;
			}
			if (failed[0]== "door") {
				// The player can get to the door, but if they don't have the key, 
				// they may not be able to get back home...
				// Ensure that there is a return path for the player.
				const foundKeys = failed[2];
				const stuckDoor = failed[3];
				// Find all cells that we are trapped in
				// NOTE: outward true to prevent walking through walls
				this.measureDistance(stuckDoor, null, true, foundKeys);
				// dist 0 is the stuck cell itself. It must count too: when the trap is a single
				// cell, it is the only entrapped cell, and the only place a breakout can start.
				const entrappedCells = this.cellList.filter((cell)=> cell.work.dist !== null);
				// Find all cells that we can navigate from start
				// NOTE: outward false to ALLOW walking trhough walls towards start
				this.measureDistance(startCell, null, false, foundKeys);
				const availableCells = this.cellList.filter((cell)=> cell.work.dist > 0);
				// Identify cells that are availble but not trapped
				const freeCells = availableCells.filter((cell)=>!entrappedCells.includes(cell));
				const breakouts = entrappedCells
					// return an array of the entrapped cell and any adjacent free cells on the same floor
					.map((entrapped) => [entrapped, freeCells.filter((cell)=>entrapped.loc[0]==cell.loc[0] && 
					((entrapped.loc[1] == cell.loc[1] && Math.abs(entrapped.loc[2] - cell.loc[2]) == 1) ||
					(entrapped.loc[2] == cell.loc[2] && Math.abs(entrapped.loc[1] - cell.loc[1]) == 1)) )
					// Further filter adjacent cells by if we can path from the other side to start.
					//.filter((cell)=>this.pathfind(cell, startCell, true, false, foundKeys))
					])
					// filter out items with no free cells
					.filter((x)=>x[1].length > 0);
				if (breakouts.length == 0) {
					// No trapped cell touches a cell that can get back to the start, e.g. the one-way
					// wall into the trap comes from an area that is itself cut off. Open them all.
					console.log('No wall to knock down. Opening one-way walls both ways.');
					if (!this.openAllOneWayWalls()) {
						throw new Error('Maze is unsolvable and no wall can be opened to fix it.');
					}
					continue;
				}
				const breakoutCellPair = breakouts[this.generateInt(breakouts.length)];
				const breakoutCell = breakoutCellPair[0];
				const breakinCell = breakoutCellPair[1][this.generateInt(breakoutCellPair[1].length)];
				// Figure out which wall to break down.
				const deltax = breakinCell.loc[2] - breakoutCell.loc[2];
				const deltay = breakinCell.loc[1] - breakoutCell.loc[1];
				// Get the direction of this wall.
				const dir = getDir(deltax, deltay);
				if (this._debug) {
					this.cellList.forEach((cell)=>this._mazehtml.renderMapDebug(cell, null, {'background-color':'#000'}));
					entrappedCells.forEach((cell)=>this._mazehtml.renderMapDebug(cell, null, {'background-color':'#F00'}));
					freeCells.forEach((cell)=>this._mazehtml.renderMapDebug(cell, null, {'background-color':'#0F0'}));
					this._mazehtml.renderMapDebug(stuckDoor, null, {'background-color':'#FFF'});
					this._mazehtml.renderMapDebug(breakoutCell, null, {'background-color':'#0FF'});
					this._mazehtml.renderMapDebug(breakinCell, null, {'background-color':'#0F0'});
				}		
				console.log('Adding opening '+dir+' at '+breakoutCell.loc);
				// Bring down the wall.				
				this.setWall(breakoutCell, dir);
			}
			else if (failed[0]== "key") {
				const foundKeys = failed[2];
				const stuckKey = failed[3];
				// Find all cells that we are trapped in
				// NOTE: outward true to prevent walking through walls
				this.measureDistance(stuckKey, null, true, foundKeys);
				// dist 0 is the stuck cell itself. It must count too: when the trap is a single
				// cell, it is the only entrapped cell, and the only place a breakout can start.
				const entrappedCells = this.cellList.filter((cell)=> cell.work.dist !== null);
				// Find all cells that we can navigate from start
				// NOTE: outward false to ALLOW walking trhough walls towards start
				this.measureDistance(startCell, null, false, foundKeys);
				const availableCells = this.cellList.filter((cell)=> cell.work.dist > 0);
				// Identify cells that are availble but not trapped
				const freeCells = availableCells.filter((cell)=>!entrappedCells.includes(cell));
				const breakouts = entrappedCells
					// return an array of the entrapped cell and any adjacent free cells on the same floor
					.map((entrapped) => [entrapped, freeCells.filter((cell)=>entrapped.loc[0]==cell.loc[0] && 
					((entrapped.loc[1] == cell.loc[1] && Math.abs(entrapped.loc[2] - cell.loc[2]) == 1) ||
					(entrapped.loc[2] == cell.loc[2] && Math.abs(entrapped.loc[1] - cell.loc[1]) == 1)) )
					// Further filter adjacent cells by if we can path from the other side to start.
					//.filter((cell)=>this.pathfind(cell, startCell, true, false, foundKeys))
					])
					// filter out items with no free cells
					.filter((x)=>x[1].length > 0);
				if (breakouts.length == 0) {
					// No trapped cell touches a cell that can get back to the start, e.g. the one-way
					// wall into the trap comes from an area that is itself cut off. Open them all.
					console.log('No wall to knock down. Opening one-way walls both ways.');
					if (!this.openAllOneWayWalls()) {
						throw new Error('Maze is unsolvable and no wall can be opened to fix it.');
					}
					continue;
				}
				const breakoutCellPair = breakouts[this.generateInt(breakouts.length)];
				const breakoutCell = breakoutCellPair[0];
				const breakinCell = breakoutCellPair[1][this.generateInt(breakoutCellPair[1].length)];
				// Figure out which wall to break down.
				const deltax = breakinCell.loc[2] - breakoutCell.loc[2];
				const deltay = breakinCell.loc[1] - breakoutCell.loc[1];
				// Get the direction of this wall.
				const dir = getDir(deltax, deltay);
				if (this._debug) {
					this.cellList.forEach((cell)=>this._mazehtml.renderMapDebug(cell, null, {'background-color':'#000'}));
					entrappedCells.forEach((cell)=>this._mazehtml.renderMapDebug(cell, null, {'background-color':'#F00'}));
					freeCells.forEach((cell)=>this._mazehtml.renderMapDebug(cell, null, {'background-color':'#0F0'}));
					this._mazehtml.renderMapDebug(stuckKey, null, {'background-color':'#FFF'});
					this._mazehtml.renderMapDebug(breakoutCell, null, {'background-color':'#0FF'});
					this._mazehtml.renderMapDebug(breakinCell, null, {'background-color':'#0F0'});
				}		
				console.log('Adding opening '+dir+' at '+breakoutCell.loc);
				// Bring down the wall.				
				this.setWall(breakoutCell, dir);
			}
			else if (failed[0]== "pass") {
				/*
					This one is going to hurt...
					We have detected a sccenario where keys can no longer be collected. 
					The player needs to be given a break.
					*/
				// Identify the doors that can be reached but don't have keys.
				const foundKeys = failed[1];
				this.measureDistance(startCell, null, true, foundKeys);
				const availableCells = this.cellList.filter((cell)=> cell.work.dist > 0);
				const keylessDoors =  [...new Set(availableCells // Start with the cells we can get to
					.map((cell)=>['N','S','E','W'].map((dir)=>cell.data[dir])) // get all the wall data as an array of arrays
					.flat(2))] // flatten to a single array, pack into a set making unique values only, then expand back to an array
					.filter((key)=>key !== null && key > 1 && !foundKeys.includes(key)); // Then filter to key values we don't have.
				// Check if any available doors are not main path doors
				const notMainDoors = keylessDoors.filter((door)=>door > lastMainPathDoor);
				// Prefer moving a key for a door off the main path. If only main path doors block
				// the player (their keys locked behind each other), move one of those keys instead,
				// or nothing would change and this loop would never end.
				const movableDoors = notMainDoors.length > 0 ? notMainDoors : keylessDoors;
				if (movableDoors.length > 0) {
					// Let's move the key. Pick one to start.
					const key = movableDoors[this.generateInt(movableDoors.length)];

					// Remove the old key.
					this.cellList.forEach(function (cell){if (cell.data.item.key === key){delete cell.data.item.key;}});

					// Find available cells that only have one way in or out.
					// Also exclude cells with the matching door, and cells that already hold an item:
					// putting the key there would overwrite another key and lock its door for good.
					const newKeyCells = availableCells.filter( 
						(cell)=>['N','S','E','W','U','D'].filter((dir)=>cell.data[dir] === null || cell.data[dir] === key || foundKeys.includes(cell.data[dir])).length == 1
							&& Object.keys(cell.data.item).length == 0
					);
					if (newKeyCells.length > 0){
						// Pick a new place for the key and put it there.
						const keyPlace = newKeyCells[this.generateInt(newKeyCells.length)];
						keyPlace.data.item.key = key;
					}
					else {
						// There are no dead ends. Just remove the door instead.  The key is already gone.
						this.cellList.map((cell)=>['N','S','E','W'].forEach(function(dir){if(cell.data[dir] === key){cell.data[dir] = null;}}));
					}
				}
				else {
					// Nothing locked is in reach, yet the maze cannot be solved. Fail loudly instead of looping.
					throw new Error('Maze is unsolvable and no locked door can be fixed.');
				}
			}
		}
		
		// This cleans up the work propery of cells.
		this.clearWorkProperty();
	}

	mazeFail(startCell, endCell) {
		/*
		This function test solves a maze in it's current state.
		It has a few goals:
		1. Ensure that all keys to all doors can be reached.
		2. Ensure that all doors can be reached.
		3. Ensure that players cannot be trapped.
		*/

		// This is the starting "key"- no wall
		var keysFound = [1];
		while (true) {
			// See if the maze can be solved given the start and end points with the given keys.			
			const pathExists = this.pathfind(startCell, endCell, false, false, keysFound);
			if (pathExists) { 
				// This maze can be solved.
				return false;
			}

			// Build a list of all collectable keys.
			this.measureDistance(startCell, null, true, keysFound);
			const keyCells = this.cellList.filter((cell)=> (cell.work.dist > 0 && cell.data.item.key > 1));
			
			// Perform checks per key:
			for (var keyCellindex in keyCells){
				const keyCell = keyCells[keyCellindex];
				// This is the key's id
				const key = keyCell.data.item.key
				// Ensure that all key locations can get back to the starting point.
				// NOTE: First true ensures that we don't walk through one-way walls.
				if (!this.pathfind(keyCell, startCell, false, false, keysFound)){
					console.log('A key '+key+' at '+keyCell.loc+ ' entraps the player.');
					return ['key', key, keysFound, keyCell];
				}
				
				// Find the corresponding door.
				this.measureDistance(startCell, null, true, keysFound);
				const doorCells = this.cellList.filter((cell)=>cell.work.dist > 0 && ['N','S','E','W'].filter((dir)=>cell.data[dir] === key).length > 0);				
				for (var doorCellindex in doorCells){
					const doorCell = doorCells[doorCellindex];
					// Ensure that from this door, the player can get back.
					if (!this.pathfind(doorCell, startCell, false, false, keysFound)){
						console.log('A door at  '+doorCell.loc+ ' entraps the player.');
						return ['door', key, keysFound, doorCell];
					}
				}
			}

			// Build the new list of keys
			const newKeysFound = [1].concat(keyCells.map((cell)=>cell.data.item.key));
			// If there are not new keys, then we are unable to find new keys to progress.
			if (newKeysFound.filter((x)=>!keysFound.includes(x)).length == 0){
				console.log('Consecutive passes were unable to find additional keys.');
				return ['pass', newKeysFound];
			}
			keysFound = newKeysFound;
		}
	}

	openAllOneWayWalls() {
		// Give every one-way wall its missing other side. Returns false if there were none.
		var opened = false;
		for (const cell of this.cellList) {
			for (const dir of ['N','S','E','W','U','D']) {
				const nextCell = this.getNextCell(cell, dir);
				if (nextCell && cell.data[dir] !== 0 && nextCell.data[opposite[dir]] === 0) {
					this.setWall(nextCell, opposite[dir], cell.data[dir]);
					opened = true;
				}
			}
		}
		return opened;
	}

	findTraps(startCell, endCell) {
		/*
		Exactly simulate every situation a player can get into and find the ones they cannot finish from.

		A situation (a "state") is the cell the player stands in plus the set of keys they hold.
		Keys are never used up, so holding more keys can only open more doors.

		1. Walk forward from the start to find every reachable state, remembering how each was entered.
		2. Walk backward from every state standing on the exit to find the states that can still win.
		3. Any reachable state that cannot win is a trap: the player is stuck there for good.

		Returns {solvable, trapped, exits}. exits lists the moves [cell, dir] that lead from a
		state that can still win into a trapped one: the "point of no return" moves.
		*/
		const dirs = ['N','S','E','W','U','D'];
		// Keys are stored as bits of a BigInt so a set of keys is a single value.
		const keyBit = (key) => 1n << BigInt(key);
		const pickUp = (cell, keys) => cell.data.item.key ? keys | keyBit(cell.data.item.key) : keys;
		const index = new Map(this.cellList.map((cell, i) => [cell, i]));
		const stateId = (cell, keys) => `${index.get(cell)}:${keys}`;

		// 1. Breadth-first search forward over states.
		const states = new Map();
		const first = {cell: startCell, keys: pickUp(startCell, 0n), entries: []};
		states.set(stateId(first.cell, first.keys), first);
		const queue = [first];
		for (var q = 0; q < queue.length; ++q) {
			const state = queue[q];
			// Standing at the exit means the player can walk out and win.
			if (state.cell === endCell) { continue; }
			for (const dir of dirs) {
				const wall = state.cell.data[dir];
				const nextCell = this.getNextCell(state.cell, dir);
				// Same rule as the game: open, unlocked, or a door we hold the key for.
				if (!nextCell || !(wall === null || wall === 1 || (wall > 1 && (state.keys & keyBit(wall))))) { continue; }
				const keys = pickUp(nextCell, state.keys);
				const id = stateId(nextCell, keys);
				var next = states.get(id);
				if (!next) {
					next = {cell: nextCell, keys: keys, entries: []};
					states.set(id, next);
					queue.push(next);
				}
				next.entries.push([state, dir]);
			}
		}

		// 2. Walk backward from the winning states.
		const canWin = new Set();
		const stack = [...states.values()].filter(state => state.cell === endCell);
		stack.forEach(state => canWin.add(state));
		while (stack.length > 0) {
			for (const [prior, dir] of stack.pop().entries) {
				if (!canWin.has(prior)) {
					canWin.add(prior);
					stack.push(prior);
				}
			}
		}

		// 3. Collect the moves that cross from a winnable state into a trapped one.
		const exits = [];
		for (const state of states.values()) {
			if (canWin.has(state)) { continue; }
			for (const [prior, dir] of state.entries) {
				if (canWin.has(prior)) { exits.push([prior.cell, dir]); }
			}
		}
		return {solvable: canWin.has(first), trapped: states.size - canWin.size, exits: exits};
	}

	removeOneWayTraps(startCell, endCell) {
		/*
		Make sure no one-way wall can strand the player.

		Why only one-way walls can trap: every two-way move can be undone, and keys are never lost.
		So a move into a trapped state must be one the player cannot walk back through; if they
		could, they would be back where they were with at least the same keys, which can still win.
		That means each "point of no return" found by findTraps is a one-way wall.

		The repair: give that wall its missing other side so it becomes two-way. Each pass removes
		one one-way wall. A maze with no one-way walls left can never trap the player, so this
		always finishes, and it only removes the one-way walls that actually cause trouble.
		Opening walls never blocks a path, so a solvable maze stays solvable.
		*/
		while (true) {
			const result = this.findTraps(startCell, endCell);
			if (!result.solvable || result.trapped == 0) {
				return result;
			}
			// Pick one point of no return and open its other side.
			const [cell, dir] = result.exits[this.generateInt(result.exits.length)];
			const nextCell = this.getNextCell(cell, dir);
			console.log(`Opening one-way wall ${dir} at ${cell.loc} both ways; it stranded the player in ${result.trapped} situations.`);
			this.setWall(nextCell, opposite[dir], cell.data[dir]);
		}
	}
}
