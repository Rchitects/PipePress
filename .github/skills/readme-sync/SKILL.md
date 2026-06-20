---
name: readme-sync
user-invocable: true
description: "Compare the last n commits against the current README and update documentation for changed or newly added features."
---

# README Sync Skill

## What it does

This skill reads the repository history and the current `README.md`, then compares the content of the last `n` commits with the existing documentation.

It follows this workflow:

1. Ask the user how many commits to compare (`n`).
2. Inspect the last `n` commits for changed files and new additions.
3. Determine whether the README already documents the changed or added code.
4. If existing documented functionality is changed, update the README accordingly.
5. If new functionality is not documented, ask the user whether it should be included in the README.

## Use when

- You want to keep `README.md` aligned with recent code changes.
- You want to ensure changed features are reflected in documentation.
- You want to identify new code that may need README coverage.

## How to use

Ask the agent to run the skill with a prompt such as:

- "Sync the README with the last 5 commits."
- "Compare the README against the last 3 commits and update any relevant documentation."
- "Review recent changes and ask me whether new features should be added to the README."

## Process details

- The skill should first verify the repository has a `README.md` file.
- The skill should use version control metadata to locate the last `n` commits and inspect the diff of file changes.
- The skill should compare changed or added code to the README, identifying:
  - changed behavior or APIs already described in README
  - newly added files, exports, or user-facing features not mentioned in README
- When documentation needs updates, it should propose concrete README edits.
- When a new feature is detected but not documented, it should ask the user whether to add it.

## Quality checks

- Confirm the README contains a summary of the changed feature before editing it.
- Avoid adding unrelated implementation details to `README.md`.
- Keep updates focused on user-facing documentation, examples, and command usage.
- Ask the user if new content should be included rather than making assumptions.
