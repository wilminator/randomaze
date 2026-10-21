# AI notes for the staging-combat engine PRs

- **Pull request:** this one (into `staging-combat`)
- **Author:** Claude Code, working for Mike (@wilminator)
- **AI tool(s):** Claude Code

## What and why

The contributing guide in PR #27 says a pull request that used AI needs an `ai/` note, and Mike asked
that our own Claude-built pull requests follow the same rule. PR #27 holds the notes for the changes that
went into `main`. This pull request adds the notes for the ones that went only into `staging-combat`
(#7 to #10, #12 to #14, #17, #24, #25), plus copies of `ai/README.md` and `ai/TEMPLATE.md` so this branch
has the folder's rules next to its notes. Documentation only: no code changes.

## What the AI did

Claude Code wrote the ten backfilled notes from each pull request, its commits and the project's notes,
copied the README and template from PR #27's branch, and wrote this note and the pull request description.

## What Mike did

Asked for the notes and will review and merge them. Facts in the backfilled notes (who decided what) come
from the project's records and should be corrected if Mike remembers it differently.

## Look closely at

The README and template are duplicated from PR #27; when #27 merges into `main` and `staging-combat`
next takes `main`, git should see identical content. If #27's wording changes first, update these copies.
