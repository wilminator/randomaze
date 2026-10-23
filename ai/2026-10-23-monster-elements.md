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

## Follow-up: band elements and armor (same PR)

Mike settled the open questions (2026-10-23, "Combat balance bot"): band 1 Fire+Frost, 2 Earth+Storm, 3 Fire+Earth,
4 Frost+Storm+Dark, 5 Fire+Earth+Dark; skeleton and wraith always Dark; a random 5-15% of monsters (drawn per board, no guarantee) take an element from
outside their band's set. `dungeonRollElement` rolls each monster's element from its own seeded stream
`${seed}:elements:${first}`, so every player on a board sees the same elements and the dice are untouched.
`dungeonArmorMultiplier` gives armor 16% per piece, compounding (16 / 29.4 / 40.7 / 50.2%), and a weakness mirrors it.
Still unused in fights until heroes have gear.

## Look closely at

Light monsters are still undecided. A board's band is taken from the band its monsters start in (`bandWidth` 4),
so a Hard board past level 20 uses band 5. Armor pieces that help and hurt against the same attacker cancel one for one
(Mike did not say; the other reading multiplies the two sides). Off-element monsters pick equally among the
other elements (including Dark in bands 1-3).
