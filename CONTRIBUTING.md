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

## Using AI tools

AI tools are welcome here; much of Randomaze itself was written with one. Like any tool, it can
be used well or poorly, so these are the expectations.

### When to disclose

- **No need to disclose** editor code assist, where you accept or type each line as you go.
  You are writing the code, and reviewing it line by line as it goes in.
- **Disclose** when an AI writes blocks of code for you: a whole function, a test file, a
  refactor, or the plan for a change. The bigger the block, the more you explain.

### What to write down

For any change that needs disclosing, add a short note to the [`ai/`](ai/) folder in the same
pull request, following [`ai/TEMPLATE.md`](ai/TEMPLATE.md). It covers:

- **What and why:** the problem, and why this is the right fix for it.
- **What the AI did:** which tool, and which parts it wrote or planned.
- **What you did:** what you checked, changed or rewrote, and how you tested it.
- **Anything a reviewer should look at closely.**

A single function needs a few lines; a refactor needs its reasoning laid out. The note stays in
the repository, so the reasons behind a change travel with the code, not only with the pull request.

### Owning the result

- You must understand every line you submit and be able to explain it in your own words. The
  maintainer may ask you to walk through any part. "The AI wrote that" is not an answer.
- AI-written code meets the same bar as any other: tests pass, `test/fingerprint.test.js`
  passes or the maze change is explained, the README is updated, and the description matches the diff.
- Answer review comments yourself. Use a tool to help if you like, but the reply should be yours.
- Bug reports must come from a real problem you saw, with a seed that shows it.

### When a contribution doesn't meet the bar

The maintainer may close a pull request without a line-by-line review when it shows signs that
nobody reviewed the AI's output: functions, options or files that don't exist, changes unrelated
to the stated goal, large untested changes, a missing or empty `ai/` note, or answers that
don't match the code. Closing isn't a judgement of you: fix what's missing and open it again.

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

What you do get: your name in [CONTRIBUTORS.md](CONTRIBUTORS.md), on the credits of
randomazegame.com, and in the release notes, plus our thanks and a maze engine that keeps
getting better for everyone who uses it, you included. Tell us in your pull request if you'd
like a different name or link, or would rather not be listed.

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
