const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const seedrandom = require('seedrandom');
const { ctx } = require('./helpers.js');

const get = (name) => vm.runInContext(name, ctx);
const EQ = get('EQUIPMENT_CONTENT');
const rollItemIn = get('rollItem');
const shopBonusItemIn = get('shopBonusItem');
const plainItemIn = get('plainItem');
const itemName = get('itemName');
const itemStats = get('itemStats');
const describeItem = get('describeItem');
const itemElementStrength = get('itemElementStrength');
const pickWeighted = get('pickWeighted');
const enchantmentCountWeights = get('enchantmentCountWeights');
const strengthWeights = get('strengthWeights');
const statWeightsFor = get('statWeightsFor');

// Items come out of the engine's realm; copy them so deepStrictEqual can compare them.
const plain = (x) => JSON.parse(JSON.stringify(x));
const rollItem = (...a) => plain(rollItemIn(...a));
const shopBonusItem = (...a) => plain(shopBonusItemIn(...a));
const plainItem = (...a) => plain(plainItemIn(...a));

// Dice you control: rolls come from the list in order. A roll of 0 picks the first choice, 0.999 the last.
function dice(...rolls) {
	const q = rolls.slice();
	const f = () => { assert.ok(q.length > 0, 'ran out of scripted rolls'); return q.shift(); };
	f.left = () => q.length;
	return f;
}
// A hand-made item for the naming tests.
const item = (enchantments, element = null, base = 'Sword') => ({ slot: 'weapon', base, kind: 'weapon', tier: 1, enchantments, element });
const e = (stat, rung) => ({ stat, rung });

test('weights: count and strength shift toward richer drops per tier, and always add up', () => {
	assert.deepStrictEqual(plain(enchantmentCountWeights(1)), { 0: 30, 1: 35, 2: 25, 3: 10 });
	assert.deepStrictEqual(plain(enchantmentCountWeights(5)), { 0: 10, 1: 35, 2: 25, 3: 30 });
	assert.deepStrictEqual(plain(strengthWeights(1)), [50, 35, 15]);
	assert.deepStrictEqual(plain(strengthWeights(5)), [26, 35, 39]);
	for (let t = 1; t <= 5; ++t) {
		const c = enchantmentCountWeights(t);
		assert.strictEqual(c[0] + c[1] + c[2] + c[3], 100);
		assert.strictEqual(strengthWeights(t).reduce((a, b) => a + b), 100);
	}
});

test('stat weights: the four core stats never weigh under 1, and armor rarely adds attack', () => {
	for (const kind of Object.keys(EQ.statWeights)) {
		const w = statWeightsFor(kind);
		for (const s of EQ.coreStats) assert.ok(w[s] >= 1, `${kind} ${s}`);
	}
	// Crit on caster armor stays at its low table weight: only the core stats get the floor.
	assert.strictEqual(statWeightsFor('casterArmor').crit, 0.5);
	assert.ok(statWeightsFor('armor').attack < statWeightsFor('weapon').attack);
});

test('pickWeighted: follows the weights, skips weight 0, and survives a roll of exactly 1', () => {
	assert.strictEqual(pickWeighted({ a: 1, b: 3 }, dice(0)), 'a');
	assert.strictEqual(pickWeighted({ a: 1, b: 3 }, dice(0.24)), 'a');
	assert.strictEqual(pickWeighted({ a: 1, b: 3 }, dice(0.26)), 'b');
	assert.strictEqual(pickWeighted({ a: 0, b: 3 }, dice(0)), 'b');
	assert.strictEqual(pickWeighted({ a: 3, b: 0 }, dice(1)), 'a');
});

test('plainItem: every slot has a plain +0 piece, with a caster version', () => {
	for (const slot of Object.keys(EQ.slots)) {
		const fighter = plainItem(slot);
		const caster = plainItem(slot, true);
		assert.deepStrictEqual(fighter.enchantments, []);
		assert.strictEqual(fighter.element, null);
		assert.strictEqual(itemName(fighter), EQ.slots[slot].base);
		assert.strictEqual(caster.base, EQ.slots[slot].casterBase);
		assert.deepStrictEqual(Object.values(itemStats(fighter)), [0, 0, 0, 0, 0, 0, 0]);
	}
	assert.throws(() => plainItem('boots'), /unknown slot/);
	assert.throws(() => plainItem('weapon', false, 6), /tier/);
	assert.throws(() => plainItem('weapon', false, 0), /tier/);
});

test('rollItem: scripted dice give the item they should', () => {
	// Tier 1. Count roll 0.99 is the "3" bucket (weights 30 35 25 10). Element roll 0.5 is no element.
	// Then three steps of (stat roll, rung roll). Stat weights for a weapon: attack 5 first.
	const it = rollItem({ slot: 'weapon', tier: 1 }, dice(0.99, 0.5, 0, 0, 0, 0.6, 0, 0.99));
	assert.strictEqual(it.enchantments.length, 3);
	assert.deepStrictEqual(it.enchantments[0], e('attack', 1));
	assert.deepStrictEqual(it.enchantments[1], e('attack', 2));   // 0.6 of 100 weights: 50 + 35 > 60, middle
	assert.deepStrictEqual(it.enchantments[2], e('attack', 3));
	assert.strictEqual(it.element, null);
	assert.strictEqual(itemName(it), 'Fierce Sword++');   // the word shows the strongest of the three (rung 3)
});

test('rollItem: zero enchantments is a plain item and draws only the count', () => {
	const d = dice(0);
	const it = rollItem({ slot: 'head', tier: 3 }, d);
	assert.strictEqual(it.enchantments.length, 0);
	assert.strictEqual(it.element, null);
	assert.strictEqual(d.left(), 0);
	assert.strictEqual(itemName(it), 'Helm');
});

test('rollItem: an element takes one of the steps, and an elemental drop leaves fewer stat steps', () => {
	// count 1, element chance hit (0.1 < 0.2), element roll 0 = fire. No stat step is left.
	const it = rollItem({ slot: 'weapon', tier: 1 }, dice(0.5, 0.1, 0));
	assert.strictEqual(it.element, 'fire');
	assert.strictEqual(it.enchantments.length, 0);
	assert.strictEqual(itemName(it), 'Sword of the Salamander');
	// count 3 with an element leaves two stat steps.
	const three = rollItem({ slot: 'weapon', tier: 1 }, dice(0.99, 0.1, 0.999, 0, 0, 0, 0));
	assert.strictEqual(three.element, 'light');
	assert.strictEqual(three.enchantments.length, 2);
});

test('rollItem: an explicit count skips the count roll', () => {
	const d = dice(0.9, 0, 0);
	const it = rollItem({ slot: 'weapon', tier: 2, count: 1 }, d);   // 0.9 is no element; step: attack, lowest rung
	assert.deepStrictEqual(it.enchantments, [e('attack', 2)]);
	assert.strictEqual(d.left(), 0);
	assert.throws(() => rollItem({ slot: 'weapon', tier: 1, count: 4 }, dice(0)), /count/);
});

test('rollItem: an item never has more than three enchantments, element included', () => {
	for (let s = 0; s < 300; ++s) {
		const it = rollItem({ slot: 'body', tier: 2 }, seedrandom(`z${s}`));
		const total = it.enchantments.length + (it.element ? 1 : 0);
		assert.ok(total <= 3, 'at most three enchantments including the element');
	}
});

test('rollItem: rungs stay inside the tier window (tier t draws from t to t+2), for every tier', () => {
	for (let tier = 1; tier <= 5; ++tier) {
		for (let s = 0; s < 400; ++s) {
			const it = rollItem({ slot: 'weapon', tier, count: 3 }, seedrandom(`w${tier}:${s}`));
			for (const en of it.enchantments) {
				if (en.stat == 'power') continue;   // fixed: see the power test
				assert.ok(en.rung >= tier && en.rung <= tier + 2, `tier ${tier} rolled rung ${en.rung}`);
				assert.ok(EQ.stats.includes(en.stat));
			}
		}
	}
});

test('rollItem: same dice, same item; different dice, a different spread', () => {
	const a = rollItem({ slot: 'cloak', tier: 4 }, seedrandom('same'));
	const b = rollItem({ slot: 'cloak', tier: 4 }, seedrandom('same'));
	assert.deepStrictEqual(a, b);
	const names = new Set();
	for (let s = 0; s < 50; ++s) names.add(itemName(rollItem({ slot: 'cloak', tier: 4 }, seedrandom(`d${s}`))));
	assert.ok(names.size > 10);
});

test('rollItem: distribution matches the weights (counts, elements, stats by gear type)', () => {
	const N = 20000;
	const rng = seedrandom('stats');
	const counts = [0, 0, 0, 0];
	let withElement = 0, eligible = 0, light = 0;
	const stat = { weapon: {}, armor: {} };
	for (let i = 0; i < N; ++i) {
		const w = rollItem({ slot: 'weapon', tier: 1 }, rng);
		const total = w.enchantments.length + (w.element ? 1 : 0);
		counts[total] += 1;
		if (total >= 1) { eligible += 1; if (w.element) { withElement += 1; if (w.element == 'light') light += 1; } }
		for (const en of w.enchantments) stat.weapon[en.stat] = (stat.weapon[en.stat] || 0) + 1;
		const a = rollItem({ slot: 'body', tier: 1 }, rng);
		for (const en of a.enchantments) stat.armor[en.stat] = (stat.armor[en.stat] || 0) + 1;
	}
	// Tier 1 count weights 30/35/25/10, each within 2 points.
	[30, 35, 25, 10].forEach((want, i) => assert.ok(Math.abs(counts[i] / N * 100 - want) < 2, `count ${i}: ${counts[i] / N * 100}`));
	// Element chance 20% of drops with 1+; light is 12 of 100 of those.
	assert.ok(Math.abs(withElement / eligible - 0.2) < 0.02);
	assert.ok(Math.abs(light / withElement - 0.12) < 0.03);
	// Weapons roll attack far more than defense; armor the other way round.
	assert.ok(stat.weapon.attack > stat.weapon.defense * 3);
	assert.ok(stat.armor.defense > stat.armor.attack * 3);
	// Every stat appears (the floor means the core ones are never impossible).
	for (const s of EQ.stats) assert.ok(stat.weapon[s] > 0, `weapon never rolled ${s}`);
});

test('rollItem: higher tiers roll richer drops than tier 1', () => {
	const avg = (tier) => {
		let sum = 0;
		for (let s = 0; s < 4000; ++s) sum += rollItem({ slot: 'weapon', tier }, seedrandom(`t${tier}:${s}`)).enchantments.length;
		return sum / 4000;
	};
	assert.ok(avg(5) > avg(1) + 0.2);
});

test('shopBonusItem: 1 or 2 enchantments, band tier, repeatable per day, varies by day', () => {
	const seen = new Set();
	const slots = {};
	for (let day = 0; day < 400; ++day) {
		const it = shopBonusItem(20260100 + day, 3);
		const total = it.enchantments.length + (it.element ? 1 : 0);
		assert.ok(total == 1 || total == 2, `got ${total}`);
		assert.strictEqual(it.tier, 3);
		for (const en of it.enchantments.filter(x => x.stat != 'power')) assert.ok(en.rung >= 3 && en.rung <= 5);
		assert.deepStrictEqual(it, shopBonusItem(20260100 + day, 3));
		seen.add(itemName(it));
		slots[it.slot] = (slots[it.slot] || 0) + 1;
	}
	assert.ok(seen.size > 30, 'the bonus item changes with the day');
	// Weapon is drawn the most (placeholder weight 40 of 100); every slot shows up.
	for (const s of Object.keys(EQ.slots)) assert.ok(slots[s] > 0, `${s} never came up`);
	assert.ok(slots.weapon > slots.head && slots.weapon > slots.body);
	// The caster kit gets caster bases.
	assert.strictEqual(shopBonusItem(20260101, 1, true).base, EQ.slots[shopBonusItem(20260101, 1, true).slot].casterBase);
	assert.throws(() => shopBonusItem(20260101, 9), /tier/);
});

test('itemName: the name shows the shape of the item', () => {
	// No enchantments.
	assert.strictEqual(itemName(item([])), 'Sword');
	// A repeat takes the front word at its strongest rung, with one + per repeat.
	assert.strictEqual(itemName(item([e('attack', 5), e('attack', 3)])), 'Savage Sword+');
	assert.strictEqual(itemName(item([e('attack', 1), e('attack', 1), e('attack', 2)])), 'Keen Sword++');
	// Repeat plus another stat: the other stat is the colour.
	assert.strictEqual(itemName(item([e('attack', 5), e('defense', 7), e('attack', 4)])), 'Savage Grey Sword+');
	// No repeat: highest rung in front, then colour, then creature.
	assert.strictEqual(itemName(item([e('speed', 3), e('attack', 4), e('sp', 2)])), 'Brutal Yellow Sword of the Owl');
	// A single stat.
	assert.strictEqual(itemName(item([e('crit', 6)])), 'Unerring Sword');
	// Element alone, and with stats.
	assert.strictEqual(itemName(item([], 'light')), 'Sword of the Unicorn');
	assert.strictEqual(itemName(item([e('attack', 5), e('attack', 3)], 'fire')), 'Savage Sword+ of the Salamander');
	assert.strictEqual(itemName(item([e('defense', 2), e('health', 4)], 'storm')), 'Vigorous Grey Sword of the Eagle');
	// The base changes with the item.
	assert.strictEqual(itemName(item([e('power', 7)], null, 'Staff')), 'Sublime Staff');
});

test('itemName: ties go to the stat rolled first, and the result never has more than 3 words plus the base', () => {
	assert.strictEqual(itemName(item([e('defense', 3), e('attack', 3), e('speed', 3)])), 'Solid Red Sword of the Hare');
	for (let s = 0; s < 500; ++s) {
		const it = rollItem({ slot: 'weapon', tier: 1 + (s % 5) }, seedrandom(`n${s}`));
		const name = itemName(it);
		assert.ok(name.startsWith(it.base) || name.includes(it.base), name);
		// Words: adjective, colour, base, "of the X" (3 words) at most.
		assert.ok(name.split(' ').length <= 6, name);
	}
});

test('every adjective, colour and creature is unique across stats and elements', () => {
	const words = [];
	for (const s of EQ.stats) {
		words.push(...EQ.words[s].adjectives, EQ.words[s].colour, EQ.words[s].creature);
		assert.strictEqual(EQ.words[s].adjectives.length, 7);
		assert.strictEqual(EQ.rungValues[s].length, s == 'power' ? 3 : 7);
	}
	for (const el of Object.values(EQ.elements)) words.push(el.creature);
	assert.strictEqual(new Set(words).size, words.length);
});

test('itemStats and describeItem add up the rung values', () => {
	const it = item([e('attack', 3), e('attack', 5), e('health', 2)], 'frost');
	const stats = plain(itemStats(it));
	assert.strictEqual(stats.attack, EQ.rungValues.attack[2] + EQ.rungValues.attack[4]);
	assert.strictEqual(stats.health, EQ.rungValues.health[1]);
	assert.strictEqual(stats.defense, 0);
	const lines = describeItem(it);
	assert.strictEqual(lines.length, 4);
	assert.strictEqual(lines[0], `Fierce: +${EQ.rungValues.attack[2]} attack`);
	assert.strictEqual(lines[3], 'Element: frost');
});

test('items survive a JSON round trip unchanged', () => {
	for (let s = 0; s < 50; ++s) {
		const it = rollItem({ slot: 'shield', tier: 1 + (s % 5), caster: s % 2 == 0 }, seedrandom(`j${s}`));
		assert.deepStrictEqual(JSON.parse(JSON.stringify(it)), it);
	}
});

test('rung values: rung N is +N attack, defense, speed and crit, +4N health, +2N sp', () => {
	for (let n = 1; n <= 7; ++n) {
		const totals = (stat) => plain(itemStats(item([e(stat, n)])))[stat];
		for (const s of ['attack', 'defense', 'speed', 'crit']) assert.strictEqual(totals(s), n);
		assert.strictEqual(totals('health'), 4 * n);
		assert.strictEqual(totals('sp'), 2 * n);
	}
});

test('power: fixed +5%, +10%, +15% at every tier, never above rung 3', () => {
	const seen = {};
	for (let tier = 1; tier <= 5; ++tier) {
		for (let s = 0; s < 3000; ++s) {
			const it = rollItem({ slot: 'weapon', tier: tier, caster: true, count: 3 }, seedrandom(`p${tier}:${s}`));
			for (const en of it.enchantments.filter(x => x.stat == 'power')) {
				assert.ok(en.rung >= 1 && en.rung <= 3, `tier ${tier} rolled power rung ${en.rung}`);
				seen[`${tier}:${en.rung}`] = true;
			}
		}
	}
	// Every strength turns up at every tier (it does not slide).
	for (let tier = 1; tier <= 5; ++tier) for (let r = 1; r <= 3; ++r) assert.ok(seen[`${tier}:${r}`], `tier ${tier} rung ${r}`);
	assert.deepStrictEqual(plain(itemStats(item([e('power', 1), e('power', 3)]))).power, 0.05 + 0.15);
	assert.deepStrictEqual(describeItem(item([e('power', 2)])), ['Potent: +10% power']);
	// Power shows in the name like any stat.
	assert.strictEqual(itemName(item([e('power', 3)])), 'Arcane Sword');
});

test('element strength: weapons 25%, each armor piece 16% (casters too), none without an element', () => {
	for (const slot of Object.keys(EQ.slots)) {
		for (const caster of [false, true]) {
			const plainOne = plainItem(slot, caster);
			assert.strictEqual(itemElementStrength(plainOne), 0);
			const withElement = { ...plainOne, element: 'fire' };
			assert.strictEqual(itemElementStrength(withElement), slot == 'weapon' ? 0.25 : 0.16);
		}
	}
	// Four armor pieces compound to the 50.2% in the design notes.
	assert.ok(Math.abs((1 - (1 - 0.16) ** 4) - 0.502) < 0.001);
});
