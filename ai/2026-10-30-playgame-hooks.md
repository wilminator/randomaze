# Hooks so the first-person view can show a game layer

- **Pull request:** #TBD
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code (Sonnet 5.5)

## What and why

`MazeHtml.playGame` built its own `MazePlayer` and called it directly, so a game with its own rules
(`generator/gamelayer.js`: monsters, fights, ticks) could not use the first-person view. This adds the
smallest set of hooks that lets it, and nothing that says what a game's rules are.

`playGame(winFunc, loseFunc, options)`, every option optional (no options: the classic game, unchanged):

- `player`: a `MazePlayer`-shaped object to play instead of a new one (a game layer's own player).
- `act(action, time)`: how an action is done. The game routes it through its own rules and answers what
  `MazePlayer.act` answers, or `null` for a bump.
- `canAct(action)`: whether an action would do anything, for the touch buttons and swipes.
- `onAction(action, result)`: an action was accepted; called before its animation.
- `onSettled()`: the view is standing still again.
- `mazehtml.syncPlayer()`: snaps the view to where the player is now (position, facing, floor) with no animation. A game
  calls it after it moves the player itself (a flee, a teleport). During an animation it waits for the end.

Also fixed on the way: stepping onto an unseen pit moves the player and drops them a floor in one action; the view
did not follow the floor change. It now snaps to the new floor.

## What the AI did

Wrote the options, `syncPlayer`, the pit-step handling and five browser tests in `test/ui/game.test.mjs`.

## What I did

Not reviewed by Mike. Ran the UI tests in headless Chromium and `npm test`.

## Look closely at

- `syncPlayer` resets `transition` to `none` for one frame so the snap does not slide; check it on a real phone.
- Drawing a game's own things (monster sprites in cells) is not in this change. A game adds its elements to `cell.html.contents`,
  the same place keys live, and calls `setItemHtmlRotation` as keys do.
- Close door (C) and Wait (W) have no keys here yet; a game can run them through `game.act` and call `syncPlayer()`.
