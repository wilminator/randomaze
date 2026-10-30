# Thinner Up/Down buttons, bump feedback, a Comfort option and letter keys

- **Pull request:** #39
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code

## What and why

Three touch-control ideas Mike had parked, built while he is away (he asked threads to keep going
without his input; the choices made are listed in the project's decision log).

- **Thinner Up and Down.** Mike wanted Forward to be the main target. Up and Down shrink from 25%
  and 20% of the height to 15% each, and Forward grows from 40% to 55%. On a cell with no ladder up
  or down (most cells), Forward also takes over the empty band, and the hidden box lets touches
  through to it, so a tap there walks forward instead of doing nothing.
- **Bump feedback**, `setBumpFeedback(on)`, on by default. A press that would do nothing (a wall,
  a locked door without its key, no ladder) gives the view a quick shake. It costs no move. A held
  key bumps once, not over and over; a clear swipe the rules refuse bumps too.
- **Comfort**, `setComfort(on)`, off by default, for players who feel motion sick: dark edges
  around the view, turns that fade through dark instead of sweeping, ladder climbs without the
  dip before the rise, and a bump that flashes the edges instead of shaking. Every animation keeps
  its length, because the server checks the pace of a game. A device set to reduce motion also
  gets the flash instead of the shake.

- **Letter keys**, `setLetterKeys(on)`, on by default. W A S D walk and turn and R / F climb, as
  well as the arrows and Page Up / Page Down, because most laptops (every MacBook) have no Page
  keys. A letter is turned into the key it stands for as it arrives, so the rest of the game is
  unchanged. With Ctrl, Alt or Cmd held the letter is left to the browser (Ctrl+W, Ctrl+R).

## What the AI did

Claude Code planned the change and wrote all of the code, the browser tests and this note.

## What Mike did

Asked for the three ideas in the touch-controls design talk, and asked threads to build without
waiting for him.

## Look closely at

- The sizes are a guess made without an iPad; they are one CSS block in ui/css/maze.css.
- Forward taking over an empty Up band means a tap near the top of the screen walks forward on a
  cell without a ladder. That seemed better than a dead zone, but it is a choice.
- A game built on the engine that wants W (or another of these letters) for its own action
  must call `setLetterKeys(false)` or pick other letters.
- The turn fade covers most of the turn, so the sweep is mostly hidden rather than removed.
