---
name: update-readme
user-invocable: true
description: "Use when you need to update README.md to reflect the latest code changes and recent commits."
---

# Update README

This skill helps update the repository `README.md` by reviewing the latest commits, recent code changes, and the current README content.

## What this skill does

- Reads the newest commit messages and diff summaries.
- Identifies README sections that are outdated or missing information.
- Suggests and applies targeted markdown updates for install instructions, usage examples, features, API changes, and changelog notes.
- Keeps README content aligned with the current state of the codebase.

## When to use

- README is stale after recent development.
- new features, APIs, or examples were added and documentation needs syncing.
- commit history indicates changes that should be reflected in the public docs.

## Workflow

1. Look at the latest commits and the summary of changed files.
2. Compare the current `README.md` content against the new code and features.
3. Identify the sections that require revision: installation, usage, examples, features, or changelog.
4. Draft updated README text using the most recent and relevant repo changes.
5. Apply the edits to `README.md` and verify the final document is clear and accurate.

## Example prompts

- "Update README to reflect the latest 3 commits."
- "Sync README with the recent changes in `src/` and new features."
- "Review the README and update it based on the newest commits and current code."