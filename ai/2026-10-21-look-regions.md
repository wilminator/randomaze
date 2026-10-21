# Paired wall and floor looks over door-bounded regions

- **Pull request:** #23
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-21
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

Mike disliked the patchwork from #11 ("random Legos"). Now each maze floor is cut into regions and every
cell in a region shares one look, a wall image paired with a floor image. Doors are the borders; a big
door-free area is cut into large pieces grown from far-apart seeds; any region under 12 cells joins its
neighbour, so there are no small outcrops. `mazehtml.loadLook({wall, floor})` lists allowed pairs, and
touching regions avoid sharing a wall, floor or pair. Still a hash of the seed and layout only.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description.

## What Mike did

Described what looked wrong and set the rule that he picks the pairs and any pair that looks good is allowed. Merged it; the pair list lives in the site.

## Look closely at

`mazehtml.regionSize = {target: 45, min: 12}` is the knob. As of the merge it had not been looked at in a browser by a person.
