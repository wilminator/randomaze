/*
A minimal game: build a maze from a seed and play it in first person.

Try demo/index.html?type=2&seed=1234
  type: 0 = daily-sized, 1 = small, 2 = medium, 3 = large (see generator/mazeparams.js)
  seed: any number; leave it out for today's maze. The same seed always builds the same maze.

Controls: arrow keys to walk and turn, Page Up / Page Down for ladders, and
Up arrow at a door to open it if you carry its key.
*/

// A key drawn as an SVG data URL, so the demo ships no artwork of its own.
function keyImage(color) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
		<g fill="${color}" stroke="black" stroke-width="3">
			<circle cx="30" cy="50" r="18"/>
			<rect x="46" y="44" width="44" height="12"/>
			<rect x="72" y="56" width="8" height="14"/>
			<rect x="84" y="56" width="6" height="10"/>
		</g>
		<circle cx="30" cy="50" r="8" fill="black"/>
	</svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const KEY_COLORS = [
	['Red', '#FF0000'], ['Orange', '#FF7F00'], ['Yellow', '#FFFF00'], ['Green', '#00FF00'],
	['Cyan', '#00FFFF'], ['Blue', '#0000FF'], ['Violet', '#7F00FF'], ['Magenta', '#FF00FF'],
	['Pink', '#FF7F7F'], ['White', '#DDDDDD'], ['Iron', '#666666'],
];

function startDemo() {
	const query = new URLSearchParams(location.search);
	const type = Number(query.get('type') || 0);
	const seed = query.get('seed') ? Number(query.get('seed')) : null;

	// The parameters (size, floors, doors...) come from the seed, so one number describes a whole maze.
	const params = new MazeParameters(type, seed);
	const maze = new Maze(params.mazeSeed, params.floors, params.columns, params.rows,
		params.doorTypes, params.entrances, params.oneWayWalls);
	const mazehtml = new MazeHtml(params.htmlSeed, maze);
	// The UI's own images live in ui/img/, one folder up from this page.
	mazehtml.assetRoot = '../ui/';

	// Art: the UI picks from whatever you load, by tag. Here it is all drawn with CSS.
	mazehtml.loadWall({name: 'stone', tags: ['wall'],
		css: 'background: repeating-linear-gradient(0deg, #777 0 9vmin, #555 9vmin 10vmin);'});
	mazehtml.loadWall({name: 'moss', tags: ['wall'],
		css: 'background: repeating-linear-gradient(90deg, #4a6b3a 0 12vmin, #3a5530 12vmin 13vmin);'});
	mazehtml.loadDoor({tags: ['up', 'down', 'left', 'right', 'split'],
		css: 'background: linear-gradient(#8a5a2b, #5c3a1a); border: 1vmin solid #2b1a0a;'});
	for (const [name, color] of KEY_COLORS) {
		const img = keyImage(color);
		mazehtml.loadItem({name: `${name} Key`, initials: `${name[0]}K`, src: img, invsrc: img,
			css: 'background-repeat: no-repeat; background-position: center; background-size: 40%;',
			tags: ['key'], doorcolor: color});
	}
	// No sounds are loaded; add some with mazehtml.loadClip({url, tags: ['maze']}) and so on.

	// The UI calls this for the cog button, and again when it clears itself away after a win.
	const onMenu = state => {
		if (state.state === 'win') {
			const next = `?type=${type}&seed=${Math.floor(Math.random() * 100000)}`;
			$('#gamewindow').html(`<div class="textWindow">You escaped in ${state.moves} moves.<br><br>
				<a href="${next}" style="color:white">Play another maze</a></div>`);
		}
	};
	mazehtml.generateGameUi('gamewindow', onMenu);
	maze.generateMaze();
	maze.generateDoors();
	mazehtml.playGame();
}

startDemo();
