# Inviting README with a demo GIF

- **Pull request:** #
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code

## What and why

Mike chose to let people find the engine on their own (GitHub topics and search, the link from
randomazegame.com) rather than announce it. That makes the top of the README the first thing a
visitor sees, so it should show what the engine does in a few seconds.

- `demo/demo.gif` replaces the still `demo/screenshot.png`: a 20-second run through a two-floor
  medium maze, picking up a key, climbing a ladder and walking out the exit.
- The README opens with test and license badges, a one-line "plain JavaScript, no build step",
  three short reasons to care, and links to play, build your own, and contribute.

## What the AI did

Claude Code wrote the README text and made the GIF. It searched seeds for a short solution that
opens a door and uses a ladder (type 2, seed 79, 37 moves), played that solution in the demo in
headless Chromium with Playwright's video recording at 1400x800, then used ffmpeg to play it at
double speed, crop to the game, and convert to a 640-pixel-wide, 64-colour GIF (about 3 MB).

## What Mike did

Chose the quiet route and asked for the repository to look inviting.

## Look closely at

- The GIF is about 3 MB, and the site vendors the whole engine folder, so it is copied into
  wilminator/randomaze-site with the next engine update.
- In a 960x540 window the demo's map spills over the Moves panel; at 1400x800 it doesn't. The GIF
  was recorded at the larger size. That layout issue is unchanged here.
