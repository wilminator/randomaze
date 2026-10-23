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

- **Rung values are Mike's (2026-10-23)**: rung N is +N attack, defense, speed and crit points, +4N health, +2N SP. **Power** (formerly spell power) is fixed at +5%, +10%, +15% and does not slide with tier; it rolls strength 1-3 with the tier 1 weights at every tier (my choice, the notes only say it is fixed).
- Power also applies to skills and nudges odds, but this file only stores the number; using it is for the skills code.
- Base names (Sword, Helm, Mail, Cloak, Shield; casters Staff, Hood, Robe, Cape, Bracer) are made up, and off-class gear is still undecided.
- The element takes one of the 3 enchantment steps (as written in the naming doc), so an elemental item has at most 2 stat steps.
- Naming ties (two stats on the same rung) go to the stat rolled first.
- Element ids are lowercase strings (`fire`, `frost`, `earth`, `storm`, `light`, `dark`). Light and Dark gear mirror each other (each beats the other, weak to itself); Dark's creature (Nightmare) and the 12-each odds for Light and Dark are placeholders. The 25% damage multiplier is not here.
- A caster and a fighter get different daily bonus items (the kit is part of the seed). The design does not say either way.
- Element strength (`itemElementStrength`): 25% weapon, 16% per armor piece, as settled 2026-10-23. Compounding across the four armor slots and the weakness sign are the damage code's job, not this file's.
