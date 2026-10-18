// Balance bot, part 1: the model of one dungeon run (combat-design.md 3.5, 3.6, 4.3, 4.5, 7.1, 7.2b, 7.3a).
//
// The engine has no dungeon yet, so this is an ABSTRACT model: it follows the design's rules and
// numbers, but it does not walk a real maze. A run is a list of fights in depth order, with
// walking steps between them (which refill SP). When the engine's Dungeon exists, the same
// questions should be re-asked of the real thing; the knobs in CONFIG stay the same.
//
// Everything marked ASSUMPTION is a guess the design doesn't pin down. Read results as shapes.

'use strict';

// ---------- seeded random numbers (same generator as inventory_sim.js, so runs repeat) ----------
function mulberry32(a) {
	return () => {
		a |= 0; a = a + 0x6D2B79F5 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}

// ---------- knobs ----------
const CONFIG = {
	bandWidth: 3,           // levels per band (3.6). THE open question; the report sweeps it.
	statGrowth: 0.15,       // heroes: stats x (1 + 0.15 x (level - 1)) (3.6, 7.3)
	monsterGrowth: 0.15,    // monsters: same curve in the design; TUNED by tune.js (skills make heroes outgrow 15%)
	monsters: 24,           // per dungeon (inventory sim; roughly one per 12 cells)
	clearFraction: 0.85,    // ASSUMPTION: share of monsters a regular player actually fights
	stepsBetweenFights: 14, // ASSUMPTION: walking between fights; 1 SP back per 8 steps (7.1)
	firstStrikeChance: 0.35,// ASSUMPTION: you walk into an unaware monster and swing first (4.1)
	monsterXpGrowth: 1.10,  // monster XP x growth^(monster level - 1) (7.3a "monster ratio")
	gearBonus: 0,           // ASSUMPTION: equipment adds nothing here (gear is capped to the band anyway)
	// TUNED by tune.js: monster HP and ATK are each multiplied by sqrt(tierPower[tier]); a class's damage
	// output (every swing, spell, shot and poison tick) is multiplied by classPower[class].
	tierPower: {1: 1, 2: 1, 3: 1},
	classPower: {Warrior: 1, Rogue: 1, Mage: 1, Cleric: 1, Ranger: 1, Monk: 1},
	// loot (from the inventory sim's "middle" setting, ~16 items a run)
	dropChance: 0.45, chests: 4, chestItems: 2, bagCap: 8,
	shopPotionsCarried: 3, shopPotionHeal: 0.30, dungeonPotionHeal: 1.0,
	restHeal: 0,            // share of max HP regained after each fight (the design has none; a lever to test)
	drinkBelow: 0.45,       // drink after a fight when HP falls below this share
	portalRate: 0.30,
	potionBonusCap: 0.20,   // potion XP never exceeds 20% of a run's XP (7.3a suggestion)
};

// ---------- classes (7.1) ----------
const CLASSES = {
	Warrior: {hp: 30, sp: 6,  atk: 7, def: 5, spd: 4, crit: 0.05, skip: 0.00},
	Rogue:   {hp: 20, sp: 10, atk: 6, def: 2, spd: 8, crit: 0.12, skip: 0.25}, // skip: Shadow Step / sneaking past
	Mage:    {hp: 16, sp: 16, atk: 4, def: 1, spd: 5, crit: 0.05, skip: 0.00, spell: 9},
	Cleric:  {hp: 24, sp: 12, atk: 5, def: 4, spd: 4, crit: 0.05, skip: 0.00},
	Ranger:  {hp: 22, sp: 10, atk: 6, def: 3, spd: 7, crit: 0.05, skip: 0.00},
	Monk:    {hp: 22, sp: 10, atk: 5, def: 3, spd: 9, crit: 0.05, skip: 0.00},
};
const CLASS_NAMES = Object.keys(CLASSES);

// ---------- bestiary (3.5): level-1 stats ----------
const MONSTERS = {
	rat:      {tier: 1, hp: 6,  atk: 3,  def: 0, spd: 6},
	slime:    {tier: 1, hp: 12, atk: 3,  def: 2, spd: 1},
	bat:      {tier: 1, hp: 5,  atk: 2,  def: 0, spd: 9},
	goblin:   {tier: 2, hp: 14, atk: 5,  def: 2, spd: 5},
	skeleton: {tier: 2, hp: 18, atk: 6,  def: 4, spd: 3, undead: true},
	spider:   {tier: 2, hp: 12, atk: 5,  def: 1, spd: 7},
	orc:      {tier: 3, hp: 28, atk: 8,  def: 4, spd: 4},
	wraith:   {tier: 3, hp: 20, atk: 7,  def: 6, spd: 6, undead: true},
};
const BY_TIER = {1: ['rat', 'slime', 'bat'], 2: ['goblin', 'skeleton', 'spider'], 3: ['orc', 'wraith']};

// ---------- level bands (3.6) ----------
const bandOf = (level, w) => Math.floor((level - 1) / w);
const bandFirstLevel = (band, w) => band * w + 1;
const scale = (level, cfg) => 1 + cfg.statGrowth * (level - 1);

// Monster level = first level of the monsters' band + depth (0..width) + random -1..+1 (3.6).
function monsterLevel(rand, depth, heroLevel, diffBands, cfg) {
	const base = bandFirstLevel(bandOf(heroLevel, cfg.bandWidth) + diffBands, cfg.bandWidth);
	return Math.max(1, base + Math.round(depth * cfg.bandWidth) + Math.floor(rand() * 3) - 1);
}

// Tier decides WHERE a species stands: tier 1 near the start, tier 3 deep (3.5).
function pickSpecies(rand, depth) {
	const w1 = Math.max(0, 1 - 2 * depth), w3 = Math.max(0, 2 * depth - 1), w2 = 1 - Math.abs(2 * depth - 1);
	let r = rand() * (w1 + w2 + w3);
	const tier = (r -= w1) < 0 ? 1 : (r -= w2) < 0 ? 2 : 3;
	const list = BY_TIER[tier];
	return list[Math.floor(rand() * list.length)];
}

// Monster XP at level 1 is 4 x tier^2 + HP/4 (7.3). It grows with the monster's level.
const baseMonsterXp = name => 4 * MONSTERS[name].tier ** 2 + MONSTERS[name].hp / 4;
const monsterXp = (name, level, cfg) => baseMonsterXp(name) * cfg.monsterXpGrowth ** (level - 1);

// ---------- one fight (4.3) ----------
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const hitChance = (aSpd, dSpd) => clamp(0.90 + 0.02 * (aSpd - dSpd), 0.60, 0.98);

function makeHero(clsName, level, cfg) {
	const c = CLASSES[clsName], s = scale(level, cfg), g = 1 + cfg.gearBonus;
	const h = {cls: clsName, level, spd: c.spd, crit: c.crit, power: cfg.classPower[clsName],
		maxHp: c.hp * s, atk: c.atk * s * g, def: c.def * s * g,
		maxSp: c.sp * s, spell: (c.spell ?? 0) * s * g};
	h.hp = h.maxHp; h.sp = h.maxSp;
	return h;
}

function makeMonster(name, level, cfg) {
	const m = MONSTERS[name], s = 1 + cfg.monsterGrowth * (level - 1);
	// tierPower is monster STRENGTH: a fight's danger grows with HP x ATK, so each gets the square root.
	const tp = Math.sqrt(cfg.tierPower[m.tier]);
	return {name, level, undead: !!m.undead, spd: m.spd, hp: m.hp * s * tp, maxHp: m.hp * s * tp, atk: m.atk * s * tp, def: m.def * s};
}

const damage = (rand, atk, def, mult, ignoreDef = 0) => Math.max(1, atk * mult * (0.85 + 0.3 * rand()) - def * (1 - ignoreDef) / 2);

// One swing at the monster. Returns damage dealt (0 on a miss).
function swing(rand, hero, mon, mult, opts = {}) {
	if (rand() >= hitChance(hero.spd, mon.spd)) return 0;
	const crit = rand() < (opts.crit ?? hero.crit) ? 1.5 : 1;
	const atk = opts.spell ? hero.spell : hero.atk;
	return damage(rand, atk, mon.def, mult * crit * hero.power, opts.ignoreDef ?? 0);
}

// What the hero does this round, by class and level (7.2b). SP costs are ASSUMPTIONS.
// Returns total damage dealt this round and may spend SP / set hero flags.
function heroAction(rand, hero, mon, st) {
	const L = hero.level;
	const hits = (n, mult, opts) => { let d = 0; for (let i = 0; i < n; ++i) d += swing(rand, hero, mon, mult, opts); return d; };
	switch (hero.cls) {
		case 'Warrior': {
			if (hero.sp >= 3) {
				hero.sp -= 3;
				return hits(1, L >= 12 ? 2.4 : L >= 3 ? 2.0 : 1.8, {ignoreDef: L >= 6 ? 0.5 : 0});
			}
			return hits(1, 1);
		}
		case 'Rogue': {
			if (st.first && !st.usedFirst && hero.sp >= 3) {   // Backstab: only on a first strike
				st.usedFirst = true; hero.sp -= 3;
				return hits(1, L >= 12 ? 4 : L >= 3 ? 3.5 : 3);
			}
			if (L >= 11 && !st.evade && hero.sp >= 3) { hero.sp -= 3; st.evade = true; }   // Evade: next hit misses
			if (L >= 14 && !st.poison && hero.sp >= 3) { hero.sp -= 3; st.poison = true; }
			return hits(1, 1);
		}
		case 'Mage': {
			if (L >= 5 && !st.frosted && hero.sp >= 7) { hero.sp -= 4; st.frosted = true; st.skipMonster = true; }
			if (hero.sp >= 3) {
				hero.sp -= 3;
				return hits(1, (L >= 3 ? 1.25 : 1) * (L >= 12 ? 1.25 : 1), {spell: true, ignoreDef: 1});
			}
			return hits(1, 1);
		}
		case 'Cleric': {
			if (hero.hp < hero.maxHp * 0.5 && hero.sp >= 4) {   // Heal: costs the round
				hero.sp -= 4; hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * (L >= 3 ? 0.5 : 0.4));
				return 0;
			}
			if (L >= 5 && hero.sp >= 3) {
				hero.sp -= 3;
				return hits(1, mon.undead ? 2.5 : L >= 7 ? 1.5 : 1);
			}
			return hits(1, 1);
		}
		case 'Ranger': {
			if (L >= 8 && hero.sp >= 3) { hero.sp -= 3; return hits(L >= 18 ? 4 : L >= 10 ? 3 : 2, 1 * (L >= 3 ? 1.25 : 1)); }
			return hits(1, L >= 3 ? 1.25 : 1);
		}
		case 'Monk': {
			if (hero.sp >= 2) {
				hero.sp -= 2;
				return hits(L >= 12 ? 5 : L >= 3 ? 4 : 3, 0.5, {crit: L >= 6 ? hero.crit * 2 : hero.crit});
			}
			return hits(1, 1);
		}
	}
}

// Fight to the end. `bag` holds potions. Returns {won, fled}; mutates hero, bag.
function fight(rand, hero, mon, bag, cfg) {
	const st = {first: rand() < cfg.firstStrikeChance};
	let poisonTicks = 0, deflect = 0;
	// Ranger: shots while the monster walks up a corridor; Aimed Shot II fires twice (7.2b).
	if (hero.cls === 'Ranger' && rand() < 0.6) {
		const shots = hero.level >= 12 ? 2 : 1;
		for (let i = 0; i < shots; ++i) mon.hp -= swing(rand, hero, mon, hero.level >= 3 ? 1.25 : 1);
	}
	if (hero.cls === 'Monk' && hero.level >= 14) deflect = 2;
	// A free first-strike round (4.1): the hero attacks, the monster does nothing yet.
	if (st.first) mon.hp -= heroAction(rand, hero, mon, st);
	for (let round = 0; round < 80; ++round) {
		if (mon.hp <= 0) return {won: true};
		const heroFirst = hero.spd >= mon.spd;
		const heroTurn = () => {
			// Emergency: drink a potion rather than die, or try to flee with nothing left.
			// Careful policy: drink when the monster's next big hit (about 1.7x its ATK with a crit) could kill.
			if (hero.hp < Math.max(hero.maxHp * 0.25, cfg.carefulDrink ? mon.atk * 1.7 : 0)) {
				const i = bag.findIndex(b => b.kind === 'shopPotion'), d = bag.findIndex(b => b.kind === 'dungeonPotion');
				const k = d >= 0 ? d : i;
				if (k >= 0) {
					hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * (bag[k].kind === 'dungeonPotion' ? cfg.dungeonPotionHeal : cfg.shopPotionHeal));
					bag.splice(k, 1);
					return;
				}
				if (rand() < clamp(0.5 + 0.05 * (hero.spd - mon.spd), 0.1, 0.9)) { st.fled = true; return; }
			}
			mon.hp -= heroAction(rand, hero, mon, st);
			if (poisonTicks > 0 || st.poison) mon.hp -= 0.3 * hero.atk * hero.power;
		};
		const monTurn = () => {
			if (st.skipMonster) { st.skipMonster = false; return; }
			if (st.evade) { st.evade = false; return; }
			if (rand() >= hitChance(mon.spd, hero.spd)) return;
			let d = damage(rand, mon.atk, hero.def, rand() < 0.05 ? 1.5 : 1);
			if (deflect > 0) { --deflect; d *= 0.5; }
			hero.hp -= d;
		};
		if (heroFirst) { heroTurn(); if (st.fled) return {fled: true}; if (mon.hp <= 0) return {won: true}; monTurn(); }
		else { monTurn(); if (hero.hp <= 0) return {won: false}; heroTurn(); if (st.fled) return {fled: true}; }
		if (hero.hp <= 0) return {won: false};
	}
	return {won: false};
}

// ---------- items and the bag (inventory sim, trimmed) ----------
const DROPS = [['dungeonPotion', 0.30], ['gear', 0.40], ['scroll', 0.20], ['shopTierJunk', 0.10]];
const PRICE = {shopPotion: 10, gear: 60, scroll: 20, shopTierJunk: 10};
function pick(rand, table) { let r = rand(); for (const [n, w] of table) if ((r -= w) < 0) return n; return table[table.length - 1][0]; }
function keepValue(b) {
	switch (b.kind) { case 'dungeonPotion': return 100; case 'gear': return b.quality * 60; case 'scroll': return 25; case 'shopPotion': return 15; default: return 5; }
}
function takeItem(bag, item, cap) {
	if (bag.length < cap) { bag.push(item); return; }
	let low = item, at = -1;
	bag.forEach((b, i) => { if (keepValue(b) < keepValue(low)) { low = b; at = i; } });
	if (at >= 0) bag[at] = item;
}
function makeItem(rand) { const kind = pick(rand, DROPS); return kind === 'gear' ? {kind, quality: rand()} : {kind}; }
function portalGold(bag, cfg) {
	let g = 0;
	for (const b of bag) if (b.kind !== 'dungeonPotion') g += cfg.portalRate * (PRICE[b.kind] ?? 0) * (b.kind === 'gear' ? 0.5 + b.quality : 1);
	return g;
}

// ---------- a whole run ----------
// The hero is fixed at `level` for the run (no mid-run level-ups): the XP the run is worth is
// measured here, and the career model (careers.js) adds the levelling on top.
function playRun(rand, clsName, level, diffBands, cfg) {
	const hero = makeHero(clsName, level, cfg), skip = CLASSES[clsName].skip;
	const bag = [];
	for (let i = 0; i < cfg.shopPotionsCarried; ++i) bag.push({kind: 'shopPotion'});
	const events = [];
	for (let m = 0; m < cfg.monsters; ++m) events.push('fight');
	for (let c = 0; c < cfg.chests; ++c) events.push('chest');
	// Chests and fights are spread through the maze; depth is each event's position.
	for (let i = events.length - 1; i > 0; --i) { const j = Math.floor(rand() * (i + 1)); [events[i], events[j]] = [events[j], events[i]]; }

	const gList = cfg.gList ?? [cfg.monsterXpGrowth];   // XP is reported for each growth rate in gList
	const rawXpG = gList.map(() => 0), potentialG = gList.map(() => 0);
	let rawXp = 0, potential = 0, fights = 0, died = false, spSteps = 0, hpLost = 0, deaths = 0;
	for (let e = 0; e < events.length; ++e) {
		const depth = e / (events.length - 1);
		spSteps += cfg.stepsBetweenFights;
		while (spSteps >= 8) { spSteps -= 8; hero.sp = Math.min(hero.maxSp, hero.sp + 1); }
		if (events[e] === 'chest') { for (let i = 0; i < cfg.chestItems; ++i) takeItem(bag, makeItem(rand), cfg.bagCap); continue; }
		const name = pickSpecies(rand, depth), mLevel = monsterLevel(rand, depth, level, diffBands, cfg);
		const xp = monsterXp(name, mLevel, cfg);
		potential += xp;
		const xpG = gList.map(g => baseMonsterXp(name) * g ** (mLevel - 1));
		xpG.forEach((x, i) => potentialG[i] += x);
		if (rand() >= cfg.clearFraction || rand() < skip) continue;   // not engaged
		const mon = makeMonster(name, mLevel, cfg);
		const hp0 = hero.hp;
		const res = fight(rand, hero, mon, bag, cfg);
		hpLost += Math.max(0, hp0 - hero.hp) / hero.maxHp;
		++fights;
		if (hero.hp <= 0) {
			if (!cfg.immortal) { died = true; break; }
			++deaths; hero.hp = hero.maxHp;   // tuning mode: count the death, restore HP, keep going
			continue;
		}
		if (res.won) {
			rawXp += xp;
			xpG.forEach((x, i) => rawXpG[i] += x);
			if (rand() < cfg.dropChance) takeItem(bag, makeItem(rand), cfg.bagCap);
		}
		if (res.won || res.fled) hero.hp = Math.min(hero.maxHp, hero.hp + cfg.restHeal * hero.maxHp);
		// Drink after a fight when low: shop potions first (worthless at the exit anyway).
		while (hero.hp < hero.maxHp * cfg.drinkBelow) {
			let i = bag.findIndex(b => b.kind === 'shopPotion');
			if (i < 0) i = bag.findIndex(b => b.kind === 'dungeonPotion');
			if (i < 0) break;
			hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * (bag[i].kind === 'dungeonPotion' ? cfg.dungeonPotionHeal : cfg.shopPotionHeal));
			bag.splice(i, 1);
		}
	}
	return {
		died, deaths, rawXp, potential, rawXpG, potentialG, fights, hpLost,
		potions: bag.filter(b => b.kind === 'dungeonPotion').length,
		gold: died ? 0 : portalGold(bag, cfg),
	};
}

// Share of XP held back until you escape (4.5): (start level - 1) x 3% + difficulty bands x 15%, capped.
const lossShare = (level, diffBands) => Math.min(1, (level - 1) * 0.03 + diffBands * 0.15);

module.exports = {CONFIG, CLASSES, CLASS_NAMES, MONSTERS, mulberry32, playRun, fight, makeHero, makeMonster, lossShare, bandOf, bandFirstLevel, monsterXp, baseMonsterXp};
