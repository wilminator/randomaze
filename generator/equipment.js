/*
Equipment: rolling and naming gear, with no page code and no hero or fight code.

Everything here is a pure function of its arguments. The dice are passed in as `rng`, a function that
returns a number from 0 up to (not including) 1, like Math.random or a seedrandom generator. The same
rng in gives the same item out, so a server can roll a drop or the day's shop item and a replay can
roll it again. Nothing here reads the clock or a global random stream.

An item is plain data (it round-trips through JSON):
	{ slot, base, kind, tier, enchantments: [{stat, rung}, ...], element }
	slot          'weapon' | 'head' | 'body' | 'cloak' | 'shield'
	base          the plain name, "Sword"
	kind          'weapon' | 'armor' | 'casterWeapon' | 'casterArmor', which stat weights it rolls with
	tier          1-5, one per monster band. It decides which rungs of each ladder the item can roll.
	enchantments  0-3 steps in the order they were rolled. A stat may repeat. Element takes one step,
	              so an item with an element has at most 2 stat steps.
	element       null or 'fire' | 'frost' | 'earth' | 'storm' | 'light'

The design is in equipment-naming.md and equipment-words.md (project notes). In short: 7 stats with an
adjective ladder of 7 rungs each; a tier-t item draws its steps from rungs t to t+2 (the sliding window), except
power, which is fixed at rungs 1-3 (+5/10/15%);
the name shows the shape of the item, not a list of it.

Every number and word below is in EQUIPMENT_CONTENT, passed into everything, so the balance work can
tune it without touching the rules. The word lists are placeholders until Mike edits them, and the
RUNG VALUES (what each rung is worth in the game) are not decided at all: see `rungValues`.
*/

const EQUIPMENT_CONTENT = {
	// Stat ids in a fixed order (ties are broken by this order, so naming never depends on object key order).
	stats: ['attack', 'defense', 'speed', 'health', 'sp', 'crit', 'power'],

	// Each stat: its 7 adjectives (rung 1 first), the colour it takes in second place, the creature it takes in third place.
	words: {
		attack:     { adjectives: ['Sharp', 'Keen', 'Fierce', 'Brutal', 'Savage', 'Ruthless', 'Merciless'],            colour: 'Red',    creature: 'Bear' },
		defense:    { adjectives: ['Sturdy', 'Stout', 'Solid', 'Hardy', 'Steadfast', 'Resolute', 'Unyielding'],        colour: 'Grey',   creature: 'Tortoise' },
		speed:      { adjectives: ['Nimble', 'Quick', 'Swift', 'Fleet', 'Rapid', 'Blistering', 'Breakneck'],           colour: 'Yellow', creature: 'Hare' },
		health:     { adjectives: ['Healthy', 'Hale', 'Robust', 'Vigorous', 'Vital', 'Hearty', 'Everlasting'],         colour: 'Green',  creature: 'Ox' },
		sp:         { adjectives: ['Calm', 'Clear', 'Lucid', 'Focused', 'Serene', 'Attuned', 'Transcendent'],          colour: 'Blue',   creature: 'Owl' },
		crit:       { adjectives: ['Pointed', 'Precise', 'Deadly', 'Piercing', 'Lethal', 'Unerring', 'Fatal'],         colour: 'Black',  creature: 'Viper' },
		power: { adjectives: ['Charged', 'Potent', 'Arcane', 'Mystic', 'Empowered', 'Eldritch', 'Sublime'],       colour: 'Violet', creature: 'Raven' },
	},

	// What each rung is worth (Mike, 2026-10-23). Rung N adds +N attack, defense and speed; health +4 and sp +2 per
	// rung; crit +1 percentage point per rung. Power is different: it is a fixed percentage that does not slide with
	// tier (like the elements), so it has only 3 strengths, +5%, +10% and +15%, and no rung above 3. It applies to
	// every skill that damages or heals.
	rungValues: {
		attack:  [1, 2, 3, 4, 5, 6, 7],
		defense: [1, 2, 3, 4, 5, 6, 7],
		speed:   [1, 2, 3, 4, 5, 6, 7],
		health:  [4, 8, 12, 16, 20, 24, 28],
		sp:      [2, 4, 6, 8, 10, 12, 14],
		crit:    [1, 2, 3, 4, 5, 6, 7],
		power:   [0.05, 0.10, 0.15],
	},
	// Stats whose strength does not slide with tier: they roll strength 1-3 with the tier 1 weights at every tier.
	fixedStats: ['power'],

	// Elements. `beats` is the one it deals +25% to and takes 25% less from; light has no downside.
	// The 25% itself lives in the damage helper (the elements thread); this file only hands out the id.
	elements: {
		fire:  { creature: 'Salamander', beats: 'frost', losesTo: 'storm' },
		frost: { creature: 'Yeti',       beats: 'earth', losesTo: 'fire' },
		earth: { creature: 'Mole',       beats: 'storm', losesTo: 'frost' },
		storm: { creature: 'Eagle',      beats: 'fire',  losesTo: 'earth' },
		light: { creature: 'Unicorn',    beats: 'dark',  losesTo: null },
	},

	// How strong an item's element is (Mike, 2026-10-23): a weapon's is 25%; each armor piece's is 16%, and the
	// damage math compounds the four armor slots (1 - 0.84^n, so 50.2% for four) with the opposite sign for a weakness.
	// That compounding is the damage code's job; here it is only each piece's own strength. Fixed at every tier.
	elementStrength: { weapon: 0.25, armor: 0.16 },

	// Weights (placeholders from equipment-words.md; tuned later).
	// Number of enchantments on a drop at tier 1. `tierShift` moves that much weight per tier above 1
	// from 0 enchantments to 3 enchantments (tier 5: 10 / 35 / 25 / 30).
	countWeights: { 0: 30, 1: 35, 2: 25, 3: 10 },
	countTierShift: 5,
	// Chance that a drop with at least one enchantment spends one of them on an element, and which one.
	elementChance: 0.2,
	elementWeights: { fire: 22, frost: 22, earth: 22, storm: 22, light: 12 },
	// Which rung of the 3-rung window a step lands on (lowest, middle, highest) at tier 1. Each tier above 1
	// moves `strengthTierShift` from the lowest to the highest (tier 5: 26 / 35 / 39).
	strengthWeights: [50, 35, 15],
	strengthTierShift: 6,
	// Stat weights by gear kind. The four core stats never weigh less than 1, so every piece can roll them.
	statWeights: {
		weapon:       { attack: 5, defense: 1,   speed: 2, health: 1, sp: 1, crit: 3,   power: 1 },
		armor:        { attack: 1, defense: 5,   speed: 2, health: 4, sp: 1, crit: 1,   power: 1 },
		casterWeapon: { attack: 1, defense: 1,   speed: 2, health: 1, sp: 3, crit: 1,   power: 4 },
		casterArmor:  { attack: 1, defense: 2.5, speed: 2, health: 2, sp: 3, crit: 0.5, power: 3 },
	},
	coreStats: ['attack', 'defense', 'speed', 'power'],
	coreStatFloor: 1,

	// The five slots. `base` is the plain item for a fighter's kit and `casterBase` for a caster's kit.
	// PLACEHOLDER base names: nothing says what they are called yet (and off-class gear is still open).
	slots: {
		weapon: { base: 'Sword',  kind: 'weapon', casterBase: 'Staff',  casterKind: 'casterWeapon' },
		head:   { base: 'Helm',   kind: 'armor',  casterBase: 'Hood',   casterKind: 'casterArmor' },
		body:   { base: 'Mail',   kind: 'armor',  casterBase: 'Robe',   casterKind: 'casterArmor' },
		cloak:  { base: 'Cloak',  kind: 'armor',  casterBase: 'Cape',   casterKind: 'casterArmor' },
		shield: { base: 'Shield', kind: 'armor',  casterBase: 'Bracer', casterKind: 'casterArmor' },
	},

	// The daily shop bonus item: how many enchantments, and which slot (weighted toward the weapon).
	shopBonus: {
		countWeights: { 1: 60, 2: 40 },
		slotWeights: { weapon: 40, head: 15, body: 15, cloak: 15, shield: 15 },
	},

	tiers: 5,
	windowSize: 3,
};

// Picks a key from {key: weight}. Keys come out in insertion order, so a given rng gives a given key.
// A weight of 0 is never picked. Always draws exactly one number from rng.
function pickWeighted(weights, rng) {
	const keys = Object.keys(weights);
	let total = 0;
	for (const k of keys) total += weights[k];
	let roll = rng() * total;
	for (const k of keys) {
		if (weights[k] <= 0) continue;
		if (roll < weights[k]) return k;
		roll -= weights[k];
	}
	// Only reachable if rng returned 1 (or float rounding): the last pickable key.
	return keys.filter(k => weights[k] > 0).pop();
}

function checkTier(tier, content) {
	if (!Number.isInteger(tier) || tier < 1 || tier > content.tiers) {
		throw new Error(`tier must be a whole number 1-${content.tiers}, got ${tier}`);
	}
}

function slotInfo(slot, caster, content) {
	const s = content.slots[slot];
	if (!s) throw new Error(`unknown slot ${slot}`);
	return caster ? { base: s.casterBase, kind: s.casterKind } : { base: s.base, kind: s.kind };
}

// Chances of 0-3 enchantments on a drop of this tier: weight moves from 0 to 3 as the tier rises.
function enchantmentCountWeights(tier, content = EQUIPMENT_CONTENT) {
	const t = tier - 1;
	const w = { ...content.countWeights };
	w[0] -= content.countTierShift * t;
	w[3] += content.countTierShift * t;
	return w;
}

// Weights of the lowest, middle and highest rung of the window at this tier.
function strengthWeights(tier, content = EQUIPMENT_CONTENT) {
	const t = tier - 1;
	const [low, mid, high] = content.strengthWeights;
	return [low - content.strengthTierShift * t, mid, high + content.strengthTierShift * t];
}

// Stat weights for a kind of gear, with the floor on the core stats applied.
function statWeightsFor(kind, content = EQUIPMENT_CONTENT) {
	const w = { ...content.statWeights[kind] };
	for (const s of content.coreStats) w[s] = Math.max(w[s], content.coreStatFloor);
	return w;
}

// A plain +0 piece for a slot: what the shop sells in every slot.
function plainItem(slot, caster = false, tier = 1, content = EQUIPMENT_CONTENT) {
	checkTier(tier, content);
	const { base, kind } = slotInfo(slot, caster, content);
	return { slot, base, kind, tier, enchantments: [], element: null };
}

/*
Rolls an item. `spec` is {slot, tier, caster = false, count = undefined}. With no `count` the number of
enchantments is drawn from the tier's weights; the daily shop bonus item passes its own.
Draw order (so a replay stays in step): count (unless given), element chance, element, then for each
stat step the stat and then the rung. Nothing is ever rerolled: once an element is drawn it takes one
of the steps and the remaining steps only choose from the stats.
*/
function rollItem(spec, rng, content = EQUIPMENT_CONTENT) {
	const { slot, tier, caster = false } = spec;
	checkTier(tier, content);
	const item = plainItem(slot, caster, tier, content);
	const count = spec.count === undefined ? Number(pickWeighted(enchantmentCountWeights(tier, content), rng)) : spec.count;
	if (!Number.isInteger(count) || count < 0 || count > 3) throw new Error(`count must be 0-3, got ${count}`);
	let statSteps = count;
	if (count >= 1 && rng() < content.elementChance) {
		item.element = pickWeighted(content.elementWeights, rng);
		statSteps -= 1;
	}
	const statWeights = statWeightsFor(item.kind, content);
	const rungWeights = strengthWeights(tier, content);
	for (let i = 0; i < statSteps; ++i) {
		const stat = pickWeighted(statWeights, rng);
		// Fixed stats (power) ignore the tier: strength 1-3 from the tier 1 weights.
		const fixed = content.fixedStats.includes(stat);
		const w = fixed ? strengthWeights(1, content) : rungWeights;
		const offset = Number(pickWeighted({ 0: w[0], 1: w[1], 2: w[2] }, rng));
		item.enchantments.push({ stat, rung: (fixed ? 1 : tier) + offset });
	}
	return item;
}

/*
The day's bonus item for the shop: 1 or 2 enchantments, in a slot weighted toward the weapon, at the
tier of the hero's band. The same day, tier and kit always gives the same item, so everyone shopping
in that band that day sees it. (Whether casters and fighters see different items is not decided; here
`caster` picks the kit and is part of the seed.)
*/
function shopBonusItem(daySeed, tier, caster = false, content = EQUIPMENT_CONTENT) {
	checkTier(tier, content);
	const rng = new Math.seedrandom(`${daySeed}:shopbonus:${tier}:${caster ? 'c' : 'f'}`);
	const slot = pickWeighted(content.shopBonus.slotWeights, rng);
	const count = Number(pickWeighted(content.shopBonus.countWeights, rng));
	return rollItem({ slot, tier, caster, count }, rng, content);
}

// The totals of an item's enchantments, using rungValues: {attack, defense, speed, health, sp, crit, power}.
// Power is a fraction (0.15 is +15%); the rest are points.
function itemStats(item, content = EQUIPMENT_CONTENT) {
	const totals = {};
	for (const s of content.stats) totals[s] = 0;
	for (const e of item.enchantments) totals[e.stat] += content.rungValues[e.stat][e.rung - 1];
	return totals;
}

/*
The name. Stat steps are grouped by stat. The front adjective is the stat that repeats (its word is the
strongest rung rolled on it) or, if none repeats, the stat with the highest rung. The next stat gives its
colour. A third stat gives "of the <creature>" unless the item has an element, which takes that place.
A "+" follows the base for each repeat. Ties go to the stat that was rolled first.
	Savage Sword+                      two steps of attack
	Savage Grey Sword+                 two of attack, one of defense
	Swift Red Sword of the Owl         speed, attack, sp (no repeat, no element)
	Savage Sword+ of the Salamander    two of attack and a fire element
	Sword of the Unicorn               an element and nothing else
*/
function itemName(item, content = EQUIPMENT_CONTENT) {
	if (item.enchantments.length == 0 && !item.element) return item.base;
	// One entry per stat: its best rung and how many steps it has, in the order each stat first appeared.
	const groups = [];
	for (const e of item.enchantments) {
		const g = groups.find(g => g.stat == e.stat);
		if (g) {
			g.steps += 1;
			g.rung = Math.max(g.rung, e.rung);
		} else {
			groups.push({ stat: e.stat, rung: e.rung, steps: 1 });
		}
	}
	// Front: the repeating stat if there is one, else the highest rung. The rest follow by rung, highest first
	// (Array.sort is stable, so ties stay in rolled order).
	const repeat = groups.find(g => g.steps > 1);
	const front = repeat || groups.slice().sort((a, b) => b.rung - a.rung)[0];
	const rest = groups.filter(g => g != front).sort((a, b) => b.rung - a.rung);

	const words = [];
	if (front) words.push(content.words[front.stat].adjectives[front.rung - 1]);
	if (rest[0]) words.push(content.words[rest[0].stat].colour);
	let name = words.concat(item.base).join(' ');
	if (front) name += '+'.repeat(front.steps - 1);
	if (item.element) {
		name += ` of the ${content.elements[item.element].creature}`;
	} else if (rest[1]) {
		name += ` of the ${content.words[rest[1].stat].creature}`;
	}
	return name;
}

// Tooltip lines with the exact numbers, one per enchantment step plus the element.
function describeItem(item, content = EQUIPMENT_CONTENT) {
	const lines = item.enchantments.map(e => {
		const v = content.rungValues[e.stat][e.rung - 1];
		const amount = content.fixedStats.includes(e.stat) ? `${Math.round(v * 100)}%` : v;
		return `${content.words[e.stat].adjectives[e.rung - 1]}: +${amount} ${e.stat}`;
	});
	if (item.element) lines.push(`Element: ${item.element}`);
	return lines;
}

// The strength of the item's element as a fraction (0.25 for a weapon, 0.16 for an armor piece), or 0 with no element.
// Casters' staffs and robes count as weapon and armor. The same number applies as a weakness, with the opposite sign.
function itemElementStrength(item, content = EQUIPMENT_CONTENT) {
	if (!item.element) return 0;
	return content.elementStrength[item.slot == 'weapon' ? 'weapon' : 'armor'];
}
