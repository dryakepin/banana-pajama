#!/usr/bin/env bash
#
# Points this repository's git hooks at scripts/hooks/ so the secret-scanning
# pre-commit hook runs. Version-controlled hooks via core.hooksPath, rather
# than copying files into .git/hooks, so updates ship with the repo and this
# works from a git worktree too.
#
# Run once per clone:  ./scripts/install-hooks.sh

set -euo pipefail

cd "$(dirname "$0")/.."

git config core.hooksPath scripts/hooks

echo "Hooks installed: core.hooksPath -> scripts/hooks"
echo ""

if command -v gitleaks >/dev/null 2>&1; then
    echo "gitleaks $(gitleaks version) found. The pre-commit hook is live."
else
    echo "WARNING: gitleaks is not installed, so the hook will REFUSE commits"
    echo "until you install it (it fails closed on purpose):"
    echo "  brew install gitleaks"
fi
