---
name: ci-debug
description: Systematic CI/CD pipeline debugging
---

1. Read the actual failing workflow run logs first — quote the exact failing line before forming any hypothesis.
2. Run actionlint on any modified `.github/workflows/*.yml`.
3. Run shellcheck on all embedded `run:` blocks.
4. For branch operations: run `git fetch --all && git branch -a` BEFORE creating or switching branches.
5. Never commit unless the user says "commit" explicitly — questions like "ready to commit?" are status checks, not instructions.
6. Show a unified diff of proposed changes before applying.
