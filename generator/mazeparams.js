/*
Game parameters for each maze type, derived from a seed.
Kept in its own file so the page and the Node tests share one copy.
*/

/*
Today's maze seed in local time, e.g. 15 Oct 2026 -> 202601015.
Uses getDate() (day of the month). getDay() is the day of the week, which made
every Tuesday in a month share one maze.
*/
function dailySeed(date = new Date()) {
	return date.getFullYear() * 100000 + (date.getMonth() + 1) * 100 + date.getDate();
}

/*
Optional extras a maze can switch on, all off by default.
`features` is an object of booleans; keys it doesn't know are ignored, and leaving it out
(or passing {}) gives exactly the maze every earlier version gave for that type and seed.
  plainDoors: true  also scatter keyless doors through the maze (see Maze.generatePlainDoors).
The server decides which features a day's maze gets; the browser never does.
*/
class MazeParameters{
	constructor(type, seed = null, features = {}){
		if (!seed){
			seed = dailySeed();
		}

		// Create a seed generator.
		const generator = new Math.seedrandom(seed);
		const generateInt = generateIntegerWrapper(generator);
		const generateSine = generateSineDistributedIntegerWrapper(generator);
		const generateBinom =generateBinomialDistributedIntegerWrapper(generator);
		
		// Create the seeds for the maze and html objects
		this.mazeSeed = generateInt(Number.MAX_SAFE_INTEGER);
		this.htmlSeed = generateInt(Number.MAX_SAFE_INTEGER);

		const [floorMean, floorRange, 
			colTries, colSuccess, colBase,
			rowTries, rowSuccess, rowBase,
			doorTries, doorSuccess, doorBase,
			entTries, entSuccess, entBase,
			oneTries, oneSuccess
		] = [
			[2.3, 1.6,   8, 0.25, 6,   8, 0.25, 6,    8, 0.65, 6,   4, 0.25, 2,   2, 0.25],
			[1.5, 0.5,   4, 0.35, 6,   4, 0.35, 6,    4, 0.45, 4,   1, 0.25, 2,   2, 0.05],
			[2.5, 1.0,   6, 0.45, 6,   6, 0.45, 6,    8, 0.55, 4,   2, 0.45, 2,   2, 0.25],
			[3.5, 1.0,   8, 0.55, 8,   8, 0.35, 8,   16, 0.65, 8,   4, 0.45, 2,   2, 0.55],
		][type];
		
		// Parameters		
		// Todo: generate these from the seed.
		// The sine range for type 0 starts at 0.7, which floors down to 0 about 2% of the time.
		// Clamp instead of changing the table: every seed that already worked keeps its maze.
		this.floors = Math.max(1, generateSine(floorMean, floorRange)); // 4;
		this.columns = generateBinom(colTries, colSuccess, colBase); // 10;
		this.rows = generateBinom(rowTries, rowSuccess, rowBase); // 10;
		this.doorTypes = generateBinom(doorTries, doorSuccess, doorBase);// 14;
		this.entrances = generateBinom(entTries, entSuccess, entBase) // 3;
		this.oneWayWalls = generateBinom(oneTries, oneSuccess);

		// Feature counts. Their numbers come from a second generator, never from `generator`
		// above, so switching a feature on or off cannot shift any number drawn before it.
		// 0 means none. Same field name staging-combat uses for the dungeon.
		this.plainDoors = 0;
		if (features && features.plainDoors === true) {
			const featureBinom = generateBinomialDistributedIntegerWrapper(new Math.seedrandom(`${seed}:features`));
			this.plainDoors = featureBinom(12, 0.5, 8);
		}
	}
}

/*
Builds the whole maze for some parameters: the one place that knows the steps and their order.
The site, the server's replay and the demo all call this, so a feature applies everywhere at once.
*/
function buildMaze(params) {
	const maze = new Maze(params.mazeSeed, params.floors, params.columns, params.rows,
		params.doorTypes, params.entrances, params.oneWayWalls);
	maze.generateMaze();
	maze.generateDoors();
	if (params.plainDoors > 0) {
		maze.generatePlainDoors(params.plainDoors);
	}
	return maze;
}
