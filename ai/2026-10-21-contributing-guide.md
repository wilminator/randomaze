# Contributing guide, AI rules and build-your-own guide

- **Pull request:** #27
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code

## What and why

The engine repository is public, and Mike wants people to find it, fork it and contribute. Before
announcing it, the repository needs:

- a **contributing guide** that welcomes help but says plainly that contributions are unpaid and may
  be used by randomazegame.com, closed source included (`CONTRIBUTING.md`, with a DCO sign-off and an
  extra license grant to the maintainer, since the AGPL alone would not cover relicensing later);
- **rules for AI tools**: editor code assist needs no disclosure, while AI-written blocks need a note
  here, so the reasons behind a change live in the repository and not only on GitHub;
- **credit** for contributors (`CONTRIBUTORS.md`, mirrored on the site);
- a **build-your-own guide** (`BUILD-YOUR-OWN.md`) for the site's "Build your own maze game" link,
  with local web server steps.

Mike set the disclosure line (a person working line by line needs no note) and asked that the rule
apply to the project's own AI-built pull requests too, so this pull request also backfills notes
for #1 to #26.

## What the AI did

Claude Code drafted all the text and the notes, from the pull requests, their commits and the
project's notes. The design (what to require, where the line sits, credits, the `ai/` folder) came
out of a discussion with Mike, one question at a time.

## What Mike did

Set the goals: welcome contributions, no payment, credit contributors, the AI disclosure line, the
`ai/` folder, and notes for our own pull requests. Reviews the wording before merging.

## Look closely at

- "How your contribution is used" is not legal advice. The extra grant is a common lightweight
  pattern, not a lawyer-reviewed contributor agreement.
- The backfilled notes say only what the pull requests and project notes record; where Mike's own
  review or testing isn't recorded, they say "asked for it and merged it".
- `BUILD-YOUR-OWN.md` was checked by following its steps: copying `demo/` to `mygame/`, serving the
  folder with `python3 -m http.server 8000`, and loading the page in headless Chromium (maze drawn,
  a turn works, no errors). The Node, PHP and VS Code server options were not run.
