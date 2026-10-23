/*
Monster hunt: a small example of building a game on the engine with a ruleset (see gamelayer.js).

The maze has one monster, a trophy that appears when it dies, and two teleport pads that lead to
each other. Walk into the monster's cell and you are in a fight: press A to attack until one of
you drops. Then press P to take the trophy and walk out of the exit.

It shows each part of the frame at work:
	place       decides where the monster and the pads go, from the placement dice
	start       sets up the player's health
	allows      keeps you from walking away in a fight
	actions     two new letters of its own, A (attack) and P (pick up)
	onArrive    starts the fight when you step on the monster, and sends you through a pad
	game.moveTo the movement hook: the teleport
	contents    spawn (the trophy) and remove (the monster, the trophy)
	summary     what the replay reports

It has no classes, levels or items on purpose. Copy it and change it.

Using it:
	const maze = buildMaze(new MazeParameters(2, seed));
	const result = replayRun(maze, MONSTER_HUNT, {}, seed, nonce, actions);
*/
const MONSTER_HUNT = {
	// Numbers in one place, so a copy of this file can change the game by editing them.
	// The rules read them from the ruleset they run as (`this` and game.ruleset), never from the
	// name MONSTER_HUNT, so {...MONSTER_HUNT, heroHp: 5} is a harder game.
	heroHp: 20,
	monsterHp: 12,
	heroDamage: 6,      // the hero hits for 1 .. heroDamage
	monsterDamage: 4,   // the monster hits for 1 .. monsterDamage

	place(maze, seed, dice) {
		const entrances = new Set(maze.entranceList.map(e => e.cell));
		const free = maze.cellList.filter(c => !entrances.has(c) && !c.data.hole);
		const take = () => free.splice(dice.int(free.length), 1)[0];
		const monster = take();
		const padA = take();
		const padB = take();
		return [
			{ kind: 'monster', cell: monster, hp: this.monsterHp },
			{ kind: 'pad', cell: padA, to: padB },
			{ kind: 'pad', cell: padB, to: padA },
		];
	},

	start(game) {
		game.hp = game.ruleset.heroHp;
		game.fighting = null;       // the monster being fought
		game.defeated = false;
		game.trophy = false;
		game.rounds = 0;
	},

	allows(game, letter) {
		if (game.fighting && letter != 'A') return 'you are in a fight: attack with A';
		return null;
	},

	actions: {
		// Attack: you hit, then it hits back.
		A(game) {
			const monster = game.fighting;
			if (!monster) return { ok: false, reason: 'nothing to attack' };
			++game.rounds;
			const hit = game.dice.int(game.ruleset.heroDamage) + 1;
			monster.hp -= hit;
			game.emit({ type: 'hero-hits', damage: hit });
			if (monster.hp <= 0) {
				game.contents.remove(monster);
				game.contents.spawn('trophy', monster.cell);
				game.fighting = null;
				game.defeated = true;
				game.emit({ type: 'monster-dies' });
				return { ok: true };
			}
			const bite = game.dice.int(game.ruleset.monsterDamage) + 1;
			game.hp -= bite;
			game.emit({ type: 'monster-hits', damage: bite });
			if (game.hp <= 0) game.end('died');
			return { ok: true };
		},

		// Pick up the trophy under your feet.
		P(game) {
			const trophy = game.contents.at(game.player.cell()).find(t => t.kind == 'trophy');
			if (!trophy) return { ok: false, reason: 'nothing here to pick up' };
			game.contents.remove(trophy);
			game.trophy = true;
			return { ok: true };
		},
	},

	onArrive(game, action, result) {
		const cell = game.player.cell();
		const here = game.contents.at(cell);
		// A pad sends you across, but only when you walk onto it: arriving by pad does not send you back.
		const pad = here.find(t => t.kind == 'pad');
		if (pad && (result.type == 'move' || result.type == 'fall')) {
			game.moveTo(pad.to);
			return;
		}
		const monster = here.find(t => t.kind == 'monster');
		if (monster && !game.fighting) {
			game.fighting = monster;
			game.emit({ type: 'fight', hp: monster.hp });
		}
	},

	summary(game) {
		return {
			hp: game.hp,
			rounds: game.rounds,
			monsterDefeated: game.defeated,
			trophy: game.trophy,
			// The whole point: you killed it, took the trophy and got out alive.
			victory: game.defeated && game.trophy && game.outcome == 'won',
		};
	},
};
