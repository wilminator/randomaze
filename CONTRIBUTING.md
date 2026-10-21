# Contributing to Randomaze

Thanks for looking! Randomaze is a small hobby project, and help of every size is welcome:
a bug report, a typo fix, a test, a new idea for the generator, or a whole feature.
You don't need to be an expert, and you don't need to ask before you start.

## Ways to help

- **Report a bug.** Open an issue with the maze type and seed (the `?type=2&seed=1234` part
  of the demo address), what you did, and what happened. A seed lets anyone rebuild the exact
  maze you saw.
- **Suggest an idea.** Open an issue and describe it. For a big change, an issue first saves
  you from building something that can't be merged.
- **Send a pull request.** Fork the repository, make a branch, and open a pull request
  against `main`. Small, focused pull requests are the easiest to review.
- **Build something with it.** A game of your own made with Randomaze is a contribution too.
  Tell us about it in an issue; we'd love to see it.

## Getting set up

You need Node 18 or newer. No build step.

```sh
npm ci
npm test                          # unit tests
npm run check                     # build 200 mazes of each type and look for problems
npx playwright install chromium   # once, for the browser tests
npm run test:ui                   # play the demo in headless Chromium
```

Open `demo/index.html` in a browser to try your change by hand.
The tests run on every pull request, so you'll see if anything breaks.

## Things to know before changing the generator

- **The same seed must build the same maze.** Everyone plays the same daily maze, and the
  server checks finished games by rebuilding the maze from its seed. `test/fingerprint.test.js`
  hashes a spread of mazes so a change that moves even one wall shows up. If your change is
  meant to change mazes, say so in the pull request; it has to ship together with a site and
  server update, so it may wait for a planned release.
- **New options default to off.** A new feature (like `generatePlainDoors()`) should leave
  existing mazes exactly as they were unless a page asks for it.
- **Every maze must stay winnable.** If you add a new kind of door, wall or item, make sure
  `findTraps()` and `npm run check` still pass, and add a test.

## Style

- Match the code around you: tabs for indents, classic browser scripts (no modules, no build).
- Some files use Windows (CRLF) line endings, for example `ui/mazehtml.js` and
  `generator/mazeparams.js`. Keep whatever a file already uses.
- Add or update a test for any change in behaviour.
- Update `README.md` when you change how the engine is used.

## How your contribution is used

Please read this part before you open a pull request. It is short, and we'd rather be plain
about it up front.

Randomaze is the engine behind [randomazegame.com](https://randomazegame.com), a free game
run by one person. The site itself is closed source and shows ads, and may one day offer
paid extras. Code merged here is shipped in that game.

By opening a pull request, you agree that:

1. **Your contribution is your own work**, or you otherwise have the right to submit it,
   as described in the [Developer Certificate of Origin](https://developercertificate.org/).
2. **Your contribution is licensed under this project's license**: the GNU AGPL version 3
   with the [Randomaze library exception](LICENSE-EXCEPTION.md), the same terms as the
   rest of the code.
3. **You also grant Michael Wilmes, the maintainer, a permanent, worldwide, royalty-free
   right to use, change and share your contribution under other terms of his choosing**,
   including in randomazegame.com and other closed-source or paid products, and to relicense
   it if the project's license ever changes. You keep the copyright to your work, and you
   can still use it however you like.
4. **There is no payment.** Contributions are voluntary and unpaid. You will not receive
   money, a share of income, or any other compensation, now or later, for your contribution
   or for its use in randomazegame.com or anywhere else.

What you do get: your name in the git history and in the release notes, our thanks, and a
maze engine that keeps getting better for everyone who uses it, you included.

### Signing off your commits

To show you agree, add a sign-off line to each commit with `git commit -s`. It adds a line
like this to the commit message, using your git name and email:

```
Signed-off-by: Your Name <you@example.com>
```

Forgot? `git commit --amend -s` fixes the last commit, and `git rebase --signoff main`
fixes every commit on your branch.

## Code of conduct

Be kind and assume good intent. Criticise code, not people. The maintainer may close
issues or pull requests, or block accounts, that are hostile or abusive.

## Questions

Open an issue. There's no such thing as a silly question here.
