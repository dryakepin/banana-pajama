#!/bin/bash

# Runs every test suite and linter in the repository.
#
# There is deliberately no root package.json: this project has never had one,
# and adding one risks changing how Vercel detects and builds the project
# (vercel.json pins framework: null with an explicit buildCommand). A shell
# script gets the same one-command convenience with no deployment risk.
#
# The migration tests in server/ need a real PostgreSQL and are skipped unless
# TEST_DATABASE_URL is set. To include them:
#
#   docker run -d --name bp-test -e POSTGRES_PASSWORD=testpw -p 55433:5432 postgres:15
#   TEST_DATABASE_URL="postgresql://postgres:testpw@localhost:55433/postgres?sslmode=disable" ./scripts/test-all.sh

set -uo pipefail

cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

FAILED=()

run_step() {
    local label="$1"
    shift
    echo ""
    echo -e "${BLUE}==> ${label}${NC}"
    if "$@"; then
        echo -e "${GREEN}    ${label} passed${NC}"
    else
        echo -e "${RED}    ${label} FAILED${NC}"
        FAILED+=("$label")
    fi
}

for workspace in api client server; do
    if [[ ! -d "$workspace/node_modules" ]]; then
        echo -e "${BLUE}==> installing $workspace dependencies${NC}"
        npm install --prefix "$workspace" --silent
    fi
done

run_step "api tests"      npm test --prefix api --silent
run_step "client tests"   npm test --prefix client --silent
run_step "server tests"   npm test --prefix server --silent
run_step "api lint"       npm run lint --prefix api --silent
run_step "client lint"    npm run lint --prefix client --silent
run_step "server lint"    npm run lint --prefix server --silent

echo ""
if [[ ${#FAILED[@]} -eq 0 ]]; then
    echo -e "${GREEN}All checks passed.${NC}"
    if [[ -z "${TEST_DATABASE_URL:-}" ]]; then
        echo "Note: migration integration tests were skipped (TEST_DATABASE_URL not set)."
    fi
    exit 0
fi

echo -e "${RED}${#FAILED[@]} check(s) failed:${NC}"
printf '  - %s\n' "${FAILED[@]}"
exit 1
