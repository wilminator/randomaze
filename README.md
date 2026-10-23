# Randomaze

A seeded random maze generator for multi-floor 3D mazes with keys, locked doors,
ladders and one-way walls, plus the first-person browser UI that plays them.

This is the engine behind the game at [randomazegame.com](https://randomazegame.com).
The same seed always builds the same maze, so everyone can play today's maze, or share a seed.

![demo](demo/screenshot.png)

## Try it

Open `demo/index.html` in a browser. No build step and no server needed.

Add `?type=2&seed=1234` to the address to pick a maze size (0 to 3) and a seed, and `&doors=10`
to add 10 plain (keyless) doors.
Arrow keys walk and turn, Up opens a door you have the key for, and
Page Up / Page Down climb ladders.

## What's here

| Folder | What it is | Needs |
|---|---|---|
| `generator/` | Builds the maze: layout, doors, keys, ladders, one-way walls, and the checks that keep every maze winnable. `mazeplayer.js` holds the rules of play, so a server can replay a game. Plain JavaScript, no DOM. | [seedrandom](https://github.com/davidbau/seedrandom) |
| `ui/` | Draws a maze in 3D with CSS transforms, the map, the inventory, and handles play. `music.js` plays sounds; `title.js` is the colour-cycling title effect. | jQuery (slim is fine), seedrandom, [Font Awesome Free](https://fontawesome.com) icons |
| `demo/` | A complete small game using only the files above. | |
| `test/`, `tools/` | Generator tests, and a checker that builds thousands of mazes looking for crashes and traps. | Node 18+ |

The files are classic browser scripts (no modules). Load them in this order:
`generator/mazeutil.js`, `generator/mazegen.js`, `generator/mazeparams.js`,
`generator/mazeplayer.js`, `generator/dungeon.js` and `generator/equipment.js` (only for the dungeon game), then
`ui/music.js`, `ui/mazehtml.js`. `demo/index.html` shows the whole setup.

## Using the generator

```js
// Size, floor count, doors and so on all come from one seed.
const params = new MazeParameters(type, seed);   // type 0-3; seed null = today's maze
const maze = new Maze(params.mazeSeed, params.floors, params.columns, params.rows,
	params.doorTypes, params.entrances, params.oneWayWalls);
maze.generateMaze();   // carve the passages
maze.generateDoors();  // add locked doors and hide their keys
maze.generatePlainDoors(10);  // optional: up to 10 doors that need no key
```

`maze.grid[floor][row][column]` is a cell. `cell.data.N`, `S`, `E`, `W`, `U` and `D`
describe each side: `null` is open, `0` is a wall, `1` is a plain door, and `2` or more
is a door that needs key number N. Plain doors (`1`) need no key: the player always holds key 1.
`generatePlainDoors()` uses its own random stream, so it adds doors without moving anything else,
and a maze built without it is unchanged. `cell.data.item.key` is the key lying in that cell.
If a side is open but the neighbour's matching side is not, that is a one-way wall.
`maze.entranceList[0]` is the start and the last entrance is the exit.

`maze.findTraps(startCell, exitCell)` (pass `maze.entranceList[0].cell` and the last entrance's `cell`) reports whether a maze is solvable and whether a player
could get stuck; `generateDoors()` already repairs any maze where they could.

## Checking a finished game

`MazePlayer` in `generator/mazeplayer.js` holds the rules of play: what each action does,
which count as moves, and when keys are picked up. The UI uses it for every key press,
and records each move as one letter: `F` forward or open a door, `B` back, `L`/`R` turn,
`U`/`D` ladder. Bumping into a wall is free and isn't recorded, so the move count is
always the length of that string.

When the player wins, the state passed to the `generateGameUi` callback carries it:
`{state: 'win', moves, cells, actions, times}`, where `times[i]` is when move `i` was
made, in milliseconds since the game began. A server can rebuild the same maze from its
type and seed and replay the game, without trusting the page's move count:

```js
const result = replayGame(maze, actions);
// {valid: true, moves: 57}, or {valid: false, reason: 'action 12 (F) does nothing'}
```

## The dungeon (monsters and fights)

`generator/equipment.js` rolls and names gear (`rollItem`, `shopBonusItem`, `itemName`) from a dice function you pass in. It has no UI and the rung values in it are placeholders.

`generator/dungeon.js` is a layer on top of a finished maze: monsters that wander and chase,
damage traps, and one-on-one fights. It is turn based (monsters act when you move) and every roll
comes from a seeded stream, so a server can replay a finished run and get the same fights.

```js
const { maze, dungeon, seed } = buildDungeon(dailySeed());   // the day's dungeon
const hero = {cls: 'warrior', level: 1, xp: 0, safeShare: 1, xpTable, monsters: {first: 1, width: 3}};
const result = replayDungeon(maze, dungeon, hero, nonce, actions);
// {valid: true, outcome: 'escaped' | 'died', ticks, floor, xp, kills, ...}
// or {valid: false, reason: 'action 212 (A): no fight in progress'}
```

Exploring uses the classic letters plus `W` (wait) and `C` (close the open door ahead). In a
fight, `A` attacks, `G` guards and `X` flees. All the numbers (classes, monsters, XP, trap damage)
are in `DUNGEON_CONTENT`. For play, create a `DungeonGame` and call `act(letter)`; with
`{events: true}` each call returns a list of what happened, for the page to animate.

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
