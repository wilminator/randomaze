# Randomaze

A seeded random maze generator for multi-floor 3D mazes with keys, locked doors,
ladders and one-way walls, plus the first-person browser UI that plays them.

This is the engine behind the game at [randomazegame.com](https://randomazegame.com).
The same seed always builds the same maze, so everyone can play today's maze, or share a seed.

![demo](demo/screenshot.png)

## Try it

Open `demo/index.html` in a browser. No build step and no server needed.

Add `?type=2&seed=1234` to the address to pick a maze size (0 to 3) and a seed.
Arrow keys walk and turn, Up opens a door you have the key for, and
Page Up / Page Down climb ladders.

## What's here

| Folder | What it is | Needs |
|---|---|---|
| `generator/` | Builds the maze: layout, doors, keys, ladders, one-way walls, and the checks that keep every maze winnable. Plain JavaScript, no DOM. | [seedrandom](https://github.com/davidbau/seedrandom) |
| `ui/` | Draws a maze in 3D with CSS transforms, the map, the inventory, and handles play. `music.js` plays sounds; `title.js` is the colour-cycling title effect. | jQuery (slim is fine), seedrandom, [Font Awesome Free](https://fontawesome.com) icons |
| `demo/` | A complete small game using only the files above. | |
| `test/`, `tools/` | Generator tests, and a checker that builds thousands of mazes looking for crashes and traps. | Node 18+ |

The files are classic browser scripts (no modules). Load them in this order:
`generator/mazeutil.js`, `generator/mazegen.js`, `generator/mazeparams.js`, then
`ui/music.js`, `ui/mazehtml.js`. `demo/index.html` shows the whole setup.

## Using the generator

```js
// Size, floor count, doors and so on all come from one seed.
const params = new MazeParameters(type, seed);   // type 0-3; seed null = today's maze
const maze = new Maze(params.mazeSeed, params.floors, params.columns, params.rows,
	params.doorTypes, params.entrances, params.oneWayWalls);
maze.generateMaze();   // carve the passages
maze.generateDoors();  // add locked doors and hide their keys
```

`maze.grid[floor][row][column]` is a cell. `cell.data.N`, `S`, `E`, `W`, `U` and `D`
describe each side: `null` is open, `0` is a wall, `1` is a plain door, and `2` or more
is a door that needs key number N. `cell.data.item.key` is the key lying in that cell.
If a side is open but the neighbour's matching side is not, that is a one-way wall.
`maze.entranceList[0]` is the start and the last entrance is the exit.

`maze.findTraps(startCell, exitCell)` (pass `maze.entranceList[0].cell` and the last entrance's `cell`) reports whether a maze is solvable and whether a player
could get stuck; `generateDoors()` already repairs any maze where they could.

## Using the UI

```js
const mazehtml = new MazeHtml(params.htmlSeed, maze);
mazehtml.assetRoot = '../ui/';   // where ui/img/ is, relative to your page
mazehtml.loadWall({name: 'stone', css: 'background: gray;', tags: ['wall']});
mazehtml.loadDoor({css: 'background: brown;', tags: ['up', 'down', 'left', 'right', 'split']});
mazehtml.loadItem({name: 'Red Key', initials: 'RK', src: 'red.png', invsrc: 'red.png',
	css: '', tags: ['key'], doorcolor: '#FF0000'});
mazehtml.loadClip({url: 'music.mp3', tags: ['maze']});   // optional sounds
mazehtml.generateGameUi('gamewindow', state => { /* menu button, and game over */ });
maze.generateMaze();
maze.generateDoors();
mazehtml.playGame();
```

Load at least `params.doorTypes` key items: a maze never hides more keys than that.
With fewer, the UI reuses items, so two different doors can look alike. The page needs
`ui/css/maze.css` and one inline `<style>` element, which the UI adds its rules to.

## Images

`ui/img/` holds the only images the UI loads by itself: the ladder and the player
marker on the map. They are plain stand-ins; replace the files to give your game its own look.

## Tests

```sh
npm ci
npm test                 # unit tests
npm run check            # build 200 mazes of each type and look for problems
npm run check -- 2000 1  # more mazes, starting at seed 1

npx playwright install chromium   # once, for the browser tests
npm run test:ui          # play the demo in headless Chromium
```

## Releases

A release is a version tag on `main`, like `v0.2.0` ([semantic versioning](https://semver.org):
bump the last number for fixes, the middle one for new features, the first for breaking changes).

```sh
git tag v0.2.0
git push origin v0.2.0
```

Tags with a suffix, like `v0.3.0-beta.1`, are pre-releases. Sites that track the latest
stable release skip them.

## Credits

- **Barcade Brawl** font by zephram, released under CC0 (public domain).
  Included as `ui/css/barcade-brawl.woff`.
- **Font Awesome Free** icons by Fonticons, Inc., loaded from a CDN by the demo, not
  included here. Icons are licensed CC BY 4.0, fonts SIL OFL 1.1, code MIT.
  See <https://fontawesome.com/license/free>.
- **seedrandom** by David Bau (MIT) and **jQuery** (MIT), loaded from a CDN by the demo.

## License

Randomaze is licensed under the **GNU AGPL version 3**, with an exception for code that uses it.
See [LICENSE](LICENSE) and [LICENSE-EXCEPTION.md](LICENSE-EXCEPTION.md). In plain words:

- **Using it:** a game or site that loads these files unchanged and calls them can be under
  any license, closed source included, and does not have to publish its own code.
- **Changing it:** if you modify the files in this repository and run them on a server
  people use, you must offer those people the source of your modified Randomaze files.

Copyright (C) 2024-2026 Michael Wilmes. The art, music and sounds of the Randomaze game
itself are not part of this repository.
