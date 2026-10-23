# Monster elements and the element damage multiplier

- **Pull request:** #TBD (into `staging-combat`)
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Note written:** 2026-10-23

## What and why

The combat design gives every monster an element and has gear and spells deal +25% or -25% damage by element
(Fire > Frost > Earth > Storm > Fire, and Light +25% against Dark). This adds the data and the one helper
other changes will call: `dungeonElementMultiplier(content, attacker, defender)` in `generator/dungeon.js`.
Rules are in `DUNGEON_CONTENT.elements` (the loop, the 25% bonus, the names Light and Dark), so the balance
work can tune them. Each species in `DUNGEON_CONTENT.monsters` has an `element` (default `neutral`), and a
monster in a game carries it as `monster.element`.

Nothing in a fight uses the multiplier yet, because heroes and gear have no element. Replays are unchanged,
so `rules` stays at 3.

## What the AI did

Claude Code wrote the code, `test/elements.test.js` (the loop in all four rotations, Light against Dark,
neutral and unknown elements, tuning through content, every species has a known element) and the pull request.

## What Mike did

Set the element rules (the loop, plus Light against Dark with no downside) and left the open questions below
undecided on purpose.

## Look closely at

The species-to-element table is a PLACEHOLDER, marked in the code. Which elements each band features, which
species carry them, and Light monsters are all undecided (being discussed in the "Combat balance bot" thread).
Skeleton and wraith are Dark only so the Light counter has something to hit in tests.
