# A frame for a game's own rules, holes, and a monster-hunt example

- **Pull request:** #PR
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code

## What and why

Mike wants the engine to be tools, and the rules and content of his own game to live outside it.
So the engine gets a frame that any game's rules plug into, and nothing that says what those rules are.

- `generator/gamelayer.js`: `Dice`, `Contents` (things in the maze: spawn, remove, find), `RuleGame`
  (runs a ruleset one action letter at a time) and `replayRun` (the server's check of a finished game).
  The hooks are `place`, `start`, `allows`, `onArrive`, `onTick`, custom action letters and `summary`.
  `game.moveTo(cell)` is the movement hook, so a ruleset can add teleporters; a loop of them throws.
- `generator/mazeplayer.js` gains what a game on a clock needs: the `onMove` hook, `TickLayer`, the
  optional actions `C` (close a door) and `W` (wait) behind the `extraActions` argument, holes with
  falls and ropes, and `moveTo(cell)`. Without those arguments the classic game is unchanged.
- `generator/mazegen.js` gains `generateHoles(count, pits)` (one-way drops, some hidden). It uses its own
  random stream and checks the maze stays winnable.
- `buildMaze(params)` now accepts `holes` and `pits`, and its comment says the params may come from
  anywhere: the site that hosts the game chooses the numbers, the engine builds what it is given.
- `examples/monsterhunt.js`: one monster, a trophy, two teleport pads, no classes or items.

## What the AI did

Wrote all of it. The holes, ticks and rope code is moved over from the older staging branch and
reworked to sit on the current `MazePlayer.resolve` (so `canAct` still never disagrees with `act`).
The game layer and the example are new. Names that belonged to one game ("dungeon") were made neutral.

## What I did

Wrote the tests: `test/gamelayer.test.js`, `test/holes.test.js`, `test/ticks.test.js`. Checked the
tests by breaking the code: removing the pad guard and swapping arrive/tick order each fail a test.
`npm test` and `npm run check` pass.

## Look closely at

- `moveTo` runs `onArrive` again for the new cell with a result of type `teleport`. A ruleset that
  wants to act on a teleported arrival can; one that does not should ignore that type.
- A fall does no damage in the engine. What a fall costs is for the game's rules to decide.
- No UI changes: drawing holes and the C/W keys in `ui/mazehtml.js` are not part of this change.
