# High contrast mode for the maze view

- **Pull request:** #21
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-21
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

An accessibility option. `mazehtml.setHighContrast(true)` draws solid, strongly contrasting colours
instead of textured art. Each lock gets a colour and a pattern plus the key's letters, so no one relies
on hue alone; colours come from the Okabe-Ito colour-blind-safe set. JavaScript only sets a class on
`<html>`, and `ui/css/maze.css` does the rest, so it can be toggled mid-game.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description. It chose the colour set and the colour-plus-pattern rule.

## What Mike did

Asked for an accessibility mode and merged it; the site Settings option was a separate site pull request.

## Look closely at

Off by default. Tests read computed styles in real Chromium.
