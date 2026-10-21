# Build your own maze game

This guide takes you from nothing to your own playable 3D maze, using the same engine as
[randomazegame.com](https://randomazegame.com). You need a web browser and a text editor.
No build step, no framework, no account.

## 1. Get the code

Either download it or clone it:

- **Download:** on the [Releases page](https://github.com/wilminator/randomaze/releases), pick the
  newest release and download the **Source code (zip)**. Unzip it anywhere.
- **Clone:** `git clone https://github.com/wilminator/randomaze.git`

Releases are the tested versions. `main` has the newest work, which may still change.

## 2. Run a local web server

You can open `demo/index.html` straight from your disk and it will mostly work. Serving the folder
over `http://` instead is worth the extra minute:

- Browsers treat `file://` pages strictly. Firefox, for example, may refuse the title font in `ui/css/`
  because it sits in a different folder from the page.
- Your game will be served over the web in the end, so testing it the same way avoids surprises.
- You can open it on your phone (see below).

Open a terminal **in the folder you unzipped or cloned** (the one that holds `README.md`), then
run one of these. Any one is enough.

| You have | Run | Then open |
|---|---|---|
| Python 3 (built into macOS and most Linux) | `python3 -m http.server 8000` (on Windows: `py -m http.server 8000`) | <http://localhost:8000/demo/> |
| Node.js | `npx http-server -p 8000` | <http://localhost:8000/demo/> |
| PHP | `php -S localhost:8000` | <http://localhost:8000/demo/> |
| VS Code | install the **Live Server** extension, right-click `demo/index.html`, choose **Open with Live Server** | opens by itself |

Stop the server with **Ctrl+C** in the terminal. If port 8000 is taken, use another number, like 8080.

Try a few addresses to see what the engine can do:

- <http://localhost:8000/demo/?type=2&seed=1234>: a medium maze. The same seed always builds the same maze.
- <http://localhost:8000/demo/?type=3&seed=7&doors=10>: a large maze with 10 keyless doors.

Arrow keys walk and turn, Up opens a door you have the key for, and Page Up / Page Down climb ladders.

### On your phone

Python and `http-server` only answer your own computer unless you ask them to listen more widely:
`python3 -m http.server 8000 --bind 0.0.0.0`, or `npx http-server -p 8000 -a 0.0.0.0`. Find your
computer's local address (it usually starts with `192.168.` or `10.`), and on a phone on the **same
Wi-Fi** open `http://that-address:8000/demo/`. Your firewall may ask to allow it. Only do this on a
network you trust, and stop the server when you're done.

## 3. Make it yours

The demo is a complete small game in two files, `demo/index.html` and `demo/demo.js`, so it is the
best starting point.

1. **Copy the demo** to a new folder next to it, for example `mygame/`:

   ```
   randomaze/
     generator/   the engine (leave unchanged)
     ui/          the engine (leave unchanged)
     demo/
     mygame/      index.html and game.js, copied from demo/
   ```

   Rename `demo.js` to `game.js` and change the last `<script>` line in `index.html` to match.
   Open <http://localhost:8000/mygame/>.

2. **Change the look.** The walls, doors and keys in `demo.js` are drawn with CSS so the demo ships
   no art. Replace them with your own images:

   ```js
   mazehtml.loadWall({name: 'brick', css: "background-image: url('art/brick.png'); background-size: cover;", tags: ['wall']});
   mazehtml.loadWall({name: 'flags', css: "background-image: url('art/flagstones.png'); background-size: cover;", tags: ['floor']});
   mazehtml.loadLook({wall: 'brick', floor: 'flags'});   // which wall goes with which floor
   ```

   Load at least `params.doorTypes` key items, since a maze never hides more keys than that.
   The [README](README.md#using-the-ui) lists every `load...` call.

3. **Add sound.** `mazehtml.loadClip({url: 'sounds/music.mp3', tags: ['maze']})` sets the music.
   Other tags the engine plays: `door`, `close`, `ladder`, `pickup` and `game_win`. Browsers block
   sound until the player first presses a key or taps; the engine starts the music then.

4. **Pick the mazes.** `new MazeParameters(type, seed)` with `seed` set to `null` gives today's
   maze, the same one for everyone. Any number gives a fixed maze, so you can share seeds.
   `maze.generatePlainDoors(n)` adds keyless doors.

5. **Handle the win.** The callback you pass to `generateGameUi` gets
   `{state: 'win', moves, actions, times}`. Show a score, save it, or send it to a server.
   A server can rebuild the maze from its type and seed and check the game with
   `replayGame(maze, actions)` (see [Checking a finished game](README.md#checking-a-finished-game)).

Keep `generator/` and `ui/` unchanged and put everything of your own (pages, scripts, art, sounds)
in your own folders. That makes updating to a new release a matter of replacing those two folders,
and it keeps your own code yours to license (next section).

## 4. Put it online

It is all static files, so any static host works: GitHub Pages, Cloudflare Pages, Netlify, or any
web server. Upload `generator/`, `ui/` and your game folder, keeping the same layout so the
relative paths (`../generator/...`, `mazehtml.assetRoot = '../ui/'`) still work.

## 5. The license, in plain words

Randomaze is under the GNU AGPL version 3 with a [library exception](LICENSE-EXCEPTION.md).

- **If you use it unchanged** (load the files and call them), your game, art and code can be under
  any license you like, closed source included, free or paid.
- **If you change the engine's own files** and run them where people play, you must offer those
  players the source of your changed engine files. The easy way is a public fork on GitHub.

Keep the `LICENSE` and `LICENSE-EXCEPTION.md` files with the engine. This is a summary, not legal
advice; the license files are what count.

## 6. Tell us about it

Made something? Open an issue and show us; we'd love to see it. Found a bug, or changed the engine
in a way others could use? See [CONTRIBUTING.md](CONTRIBUTING.md).
