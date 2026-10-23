# Mage Bolt menu: choose an element

- **Pull request:** #TBD (into `staging-combat`)
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code

## What and why

Design item 16: the Mage knows Fire, Frost, Earth and Storm from level 1 and picks one through a menu: "Bolt", then the element,
with the list opening on the current element. Out of a fight a choice only switches the element (a message, one tick, no SP). In a
fight it casts the bolt in that element as the round's action; a different element than the current one costs 50% more SP
(4 becomes 6), the same again costs the normal 4. There is no standalone switch in a fight. The element carries over between fights.

The rules went into `generator/dungeon.js`, because the server replays them. The menu went into `ui/combat/boltmenu.js`, an
optional add-on that the core engine never loads (a test reads the core files and fails if they mention it).

## What the AI did

Claude Code planned the change and wrote the code, the tests and this note: `DUNGEON_CONTENT.elements`, the element state and
four new record letters in `DungeonGame`, `BoltMenu` (menu logic) and `renderBoltMenu` (drawing), and three test files.

## What Mike did

Set the rules in the design talk (2026-10-22/23). Reviews and merges.

## Look closely at

- **Placeholders.** The record letters `5 6 7 8` are mine, not agreed with the backend. The backend's action whitelist
  (`DUNGEON_ACTIONS` in `lambda/server/replay.mjs`) already accepts any digit, so it needs no change, but `1` still means
  "Bolt in the current element" and old records replay the same. The icon shapes and colours are text stand-ins until icon art exists.
- **Element damage is not here yet.** `DungeonGame.elementMultiplier` returns 1. The element loop and the +/-25% helper come from the
  "Combat elements in engine" work; when it lands, that one method calls its helper. Until then every bolt does the same damage.
- **No game page uses the menu yet.** There is no combat UI in the engine, so this adds the add-on and its tests only. The page
  wires `new BoltMenu(game)`, `menu.open()` and `renderBoltMenu(menu, container, ...)` to its skill button, and can put
  `boltBadge()` on that button and `boltTint(element)` on the bolt.
- **Fight round order.** A bolt cast in a fight is the hero's action for the round and the monster still swings, same as Firebolt.
