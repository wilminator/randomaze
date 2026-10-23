/*
The Mage's Bolt menu (design 16). An OPTIONAL combat add-on: nothing in generator/ or the core ui/ files
loads or mentions this file. A page that wants it adds a <script> for it after generator/dungeon.js.

Two parts:
	BoltMenu      The menu's logic, with no page code. "Bolt" opens an element list that starts on the
	              current element; choosing one sends the element's record letter to the game.
	renderBoltMenu(...)  Draws a BoltMenu into a container element and wires up taps and keys.

Both work on a DungeonGame (generator/dungeon.js), so the rules stay there: the menu only asks the game
what a choice would cost (game.boltCost) and whether it is allowed (game.boltRefusal), then calls game.act(letter).
*/

// How each element looks. Colour AND shape, so it still reads for a colour-blind player (design 16).
// PLACEHOLDER art: simple text shapes and colours until the concept art for the icons exists.
const BOLT_LOOKS = {
	fire:  { label: 'Fire',  shape: '▲', color: '#e8542a' },   // triangle, a flame
	frost: { label: 'Frost', shape: '◆', color: '#5ec8f2' },   // diamond, a crystal
	earth: { label: 'Earth', shape: '■', color: '#9a7440' },   // square, a block
	storm: { label: 'Storm', shape: '★', color: '#b68cf0' },   // star, a spark
};

// The tint for a bolt in flight (a drawing layer can paint its bolt with this).
function boltTint(element) {
	return BOLT_LOOKS[element]?.color ?? '#ffffff';
}

class BoltMenu {
	constructor(game) {
		this.game = game;
		this.step = 'closed';       // 'closed' | 'elements'
		this.cursor = 0;
		this.message = '';
	}

	// Only the Mage has a Bolt menu.
	get available() {
		return this.game.hero.cls == 'mage';
	}

	get elements() {
		return this.game.content.mageBolt.known;
	}

	// Tapping "Bolt": show the element list with the cursor on the current element.
	open() {
		if (!this.available || this.game.outcome) return false;
		this.step = 'elements';
		this.cursor = Math.max(0, this.elements.indexOf(this.game.element));
		this.message = '';
		return true;
	}

	cancel() {
		this.step = 'closed';
	}

	// Move the cursor, wrapping round the list.
	move(delta) {
		const n = this.elements.length;
		this.cursor = (this.cursor + delta + n) % n;
	}

	// One row per element, in the order the game lists them.
	entries() {
		const game = this.game;
		const inFight = !!game.fight;
		const letters = game.content.mageBolt.letters;
		return this.elements.map(element => {
			const letter = Object.keys(letters).find(l => letters[l] == element);
			const current = element == game.element;
			const refusal = inFight ? game.boltRefusal(element) : null;
			// Out of a fight a choice costs a tick and no SP; in one it is the cast's SP cost.
			const cost = inFight ? game.boltCost(element) : 0;
			return {
				element, letter, current, cost,
				...BOLT_LOOKS[element],
				name: game.content.mageBolt.names[element],
				// What the row says about the price.
				note: inFight ? `${cost} SP${current ? '' : ' (switching)'}` : (current ? 'current' : 'switch, 1 tick, no SP'),
				enabled: !refusal && (inFight || !current),
				// Out of a fight, the current element is a no-op row: tapping it just closes the menu.
				noop: !inFight && current,
				reason: refusal,
			};
		});
	}

	// Choose the row under the cursor (or row `index`). Returns {ok, text}: the text is the message to show.
	choose(index = this.cursor) {
		const entry = this.entries()[index];
		if (!entry) return { ok: false, text: 'No such element.' };
		// Out of a fight, picking the element you already have changes nothing: just close the menu.
		if (!this.game.fight && entry.current) {
			this.cancel();
			return { ok: true, text: `The Bolt is already ${entry.label}.`, acted: false };
		}
		if (!entry.enabled) return { ok: false, text: entry.reason ?? `${entry.label} cannot be chosen now.` };
		const inFight = !!this.game.fight;
		const result = this.game.act(entry.letter);
		if (!result.ok) return { ok: false, text: result.reason };
		this.cancel();
		this.message = inFight ? `${entry.name}!` : `The Bolt is now ${entry.label}.`;
		return { ok: true, text: this.message, acted: true, letter: entry.letter };
	}
}

/*
Draws the element list into `container` (replacing what is there) and returns a function that removes it.
	onDone(result)  called after a choice that acted, with BoltMenu.choose's result
	onClose()       called when the menu is dismissed (Escape, or a tap on Cancel)
Keys: Up/Down move, Enter or Space choose, Escape closes.
*/
function renderBoltMenu(menu, container, { onDone = () => {}, onClose = () => {} } = {}) {
	const doc = container.ownerDocument;
	const root = doc.createElement('div');
	root.className = 'bolt-menu';
	root.setAttribute('role', 'menu');
	root.setAttribute('aria-label', 'Bolt element');
	root.tabIndex = -1;
	const status = doc.createElement('div');
	status.className = 'bolt-menu-status';
	status.setAttribute('role', 'status');

	const rows = [];
	const refresh = () => {
		menu.entries().forEach((e, i) => {
			const row = rows[i];
			row.disabled = !e.enabled && !e.noop;
			row.classList.toggle('current', e.current);
			row.classList.toggle('cursor', i == menu.cursor);
			row.setAttribute('aria-checked', String(e.current));
			row.title = e.reason ?? '';
			row.querySelector('.note').textContent = e.note;
		});
	};
	const finish = (result) => {
		status.textContent = result.text;
		if (result.ok) { remove(); onDone(result); }
		else refresh();
	};
	menu.entries().forEach((e, i) => {
		const row = doc.createElement('button');
		row.type = 'button';
		row.className = 'bolt-row';
		row.dataset.element = e.element;
		row.setAttribute('role', 'menuitemradio');
		const icon = doc.createElement('span');
		icon.className = 'icon';
		icon.textContent = e.shape;
		icon.style.color = e.color;
		icon.setAttribute('aria-hidden', 'true');
		const name = doc.createElement('span');
		name.className = 'name';
		name.textContent = e.name;
		const note = doc.createElement('span');
		note.className = 'note';
		row.append(icon, name, note);
		row.addEventListener('click', () => { menu.cursor = i; finish(menu.choose(i)); });
		rows.push(row);
		root.append(row);
	});
	const cancel = doc.createElement('button');
	cancel.type = 'button';
	cancel.className = 'bolt-cancel';
	cancel.textContent = 'Cancel';
	cancel.addEventListener('click', () => { remove(); onClose(); });
	root.append(cancel, status);

	root.addEventListener('keydown', (event) => {
		const key = event.key;
		if (key == 'ArrowDown' || key == 'ArrowUp') menu.move(key == 'ArrowDown' ? 1 : -1);
		else if (key == 'Enter' || key == ' ') finish(menu.choose());
		else if (key == 'Escape') { remove(); onClose(); }
		else return;
		event.preventDefault();
		refresh();
		rows[menu.cursor].focus();
	});

	function remove() {
		menu.cancel();
		root.remove();
	}
	container.replaceChildren(root);
	refresh();
	rows[menu.cursor].focus();
	return remove;
}

// A small badge for the Mage's skill button: the current element as colour and shape.
function boltBadge(doc, element) {
	const badge = doc.createElement('span');
	badge.className = 'bolt-badge';
	badge.textContent = BOLT_LOOKS[element].shape;
	badge.style.color = BOLT_LOOKS[element].color;
	badge.title = `Bolt: ${BOLT_LOOKS[element].label}`;
	return badge;
}
