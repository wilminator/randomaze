# Equipment generator and naming

- **Pull request:** #34 (into `staging-combat`)
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code

## What and why

The combat game needs gear: five slots, five tiers, 0-3 enchantments, at most one element, and a name
that shows the shape of the item. `generator/equipment.js` adds pure functions to roll an item, roll the
daily shop bonus item, total an item's stats, and name it. No UI, no hero or fight code; it only needs a
dice function (`rng`, a number from 0 up to but not including 1), so a server can roll the same item
again. Words and weights come from the project's `equipment-naming.md` and `equipment-words.md`.
Everything lives in `EQUIPMENT_CONTENT`, like `DUNGEON_CONTENT`, so balance can tune it.

## What the AI did

Claude Code planned the change and wrote the code, the tests (`test/equipment.test.js`) and this note.
It also added `equipment.js` to the file list in `tools/check_mazes_lib.js` and a line to the README.

## What Mike did

Nothing yet. He wrote the design decisions this implements.

## Look closely at

- **Rung values are placeholders** (`rungValues`): not decided, so they are simple 1-7 counts (health x5, SP x2).
- Base names (Sword, Helm, Mail, Cloak, Shield; casters Staff, Hood, Robe, Cape, Bracer) are made up, and off-class gear is still undecided.
- The element takes one of the 3 enchantment steps (as written in the naming doc), so an elemental item has at most 2 stat steps.
- Naming ties (two stats on the same rung) go to the stat rolled first.
- Element ids are lowercase strings (`fire`, `frost`, `earth`, `storm`, `light`). The 25% damage multiplier is not here; it belongs with the elements work, which should use the same ids.
- A caster and a fighter get different daily bonus items (the kit is part of the seed). The design does not say either way.
