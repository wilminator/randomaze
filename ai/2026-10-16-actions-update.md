# Update GitHub Actions

- **Pull request:** #1
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code
- **Merged:** 2026-10-16
- **Note written:** 2026-10-21, after the fact, from the pull request, its commits and the project's notes

## What and why

The test workflow used `actions/checkout@v4` and `actions/setup-node@v4`, which run on GitHub's
Node 20 runtime. GitHub is retiring that runtime, so the workflow would start warning and then stop.
Both actions move to `@v7`.

The AI read the breaking changes in every major version between v4 and v7 and checked each one
against this workflow: the Node 24 runtime (fine on `ubuntu-latest`), the token stored outside
`.git/config` (we don't push from CI), fork checkout under `pull_request_target` (not used), and
setup-node's caching and `always-auth` changes (not used). None applied, so only the `uses:` lines changed.

## What the AI did

Claude Code planned the change and wrote all of the code, the tests and the pull request description. The change is two version numbers; the work was the research into what each version breaks.

## What Mike did

Asked for the update and merged it. CI on the pull request itself proved the new actions run.

## Look closely at

`node-version: 22` is the Node our tests use, and is separate from the actions' own runtime. It did not change.
