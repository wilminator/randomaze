# Hide touch buttons for moves that would only bump

- **Pull request:** #20
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-21
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

A touch button is drawn only when pressing it would do something. `MazePlayer.canAct(action)` answers
"would this do anything?" without changing anything. `tryAction` and `canAct` share one
`resolve(action, commit)`, so they cannot disagree. The UI marks blocked Forward/Back/Up/Down with
`touchBlocked`; they are not drawn but still catch taps.

Covered: locked doors with and without the key, the trap entrance before and after its wall drops, a
closed door behind you, the way in, ladders, and after winning.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Raised the idea (hide moves that are visibly blocked) and merged it.

## Look closely at

`resolve(..., false)` must never change state; a unit test checks this, and another checks `canAct` agrees with `act` at every step of solved real mazes.
