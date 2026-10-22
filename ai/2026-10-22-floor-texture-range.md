# Draw floor images only near the player

- **Pull request:** #30
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-22
- **Note written:** 2026-10-22, after the fact, from the pull request

## What and why

On two Android browsers (Chrome and DuckDuckGo) the maze drew flat tan floors with patches of
texture, and the map and inventory panels broke up or vanished. Every floor tile in view is its own
3D-transformed layer, and since the floor art arrived each one carries a texture; tiles near the
camera are scaled up hugely and need a lot of graphics memory. A phone that runs out drops layers,
first floors, then ordinary page parts.

New `mazehtml.textureRange` (default 1): floor and ceiling images are drawn only within that many
steps of the player. Farther ground gets a `far` class and shows the look's plain background colour.
`hideOutOfRangeCells` updates it on every move and ladder. 99 textures everything.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.
It reproduced the bug in headless Chromium by limiting graphics memory
(`--force-gpu-mem-available-mb=48`) on a phone-sized screen, on the real daily maze.

## What Mike did

Asked for the fix and merged it.

## Look closely at

The bug was reproduced only in an emulator with limited memory, not on a real phone, so the fix
needs checking on phones after release. If range 1 looks too plain, 2 is a middle road.
