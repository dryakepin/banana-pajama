#!/usr/bin/env bash
#
# Secret scanning for this repository (closes the last SEC-1 follow-up).
#
# WHY THIS IS NOT JUST "run gitleaks"
#
# The credential that actually leaked in SEC-1 was a Supabase pooler
# connection string. The stock gitleaks ruleset does not detect that shape --
# checked against the real historical file, which produced "no leaks found".
# .gitleaks.toml therefore adds a postgres-uri-password rule, and
# security/gitleaks-selftest/ holds fixtures proving it still fires. Run the
# self-test with the scan so this control cannot quietly rot into theatre.
#
# Usage:
#   scripts/scan-secrets.sh              self-test, then scan full git history
#   scripts/scan-secrets.sh --staged     scan staged changes (used by the hook)
#   scripts/scan-secrets.sh --self-test  fixtures only
#
# Findings are always printed redacted; secret values never reach the log.

set -uo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$PWD"
CONFIG="$REPO_ROOT/.gitleaks.toml"
FIXTURES="$REPO_ROOT/security/gitleaks-selftest"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

if ! command -v gitleaks >/dev/null 2>&1; then
    echo -e "${RED}gitleaks is not installed.${NC}" >&2
    echo "  macOS:  brew install gitleaks" >&2
    echo "  Linux:  https://github.com/gitleaks/gitleaks/releases" >&2
    echo "  Go:     go install github.com/zricethezav/gitleaks/v8@latest" >&2
    exit 127
fi

TMPDIR_SELF="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_SELF"' EXIT

self_test() {
    echo -e "${BLUE}==> self-test: does the scanner still catch the SEC-1 pattern?${NC}"

    # Scanned from a temp copy on purpose. .gitleaks.toml allowlists the
    # fixtures by path so the repo scan stays clean; copying moves them out
    # from under that allowlist, so the rules genuinely run against them.
    cp -R "$FIXTURES" "$TMPDIR_SELF/fixtures"
    gitleaks dir "$TMPDIR_SELF/fixtures" \
        --config "$CONFIG" \
        --redact --no-banner --exit-code 0 \
        --report-format json --report-path "$TMPDIR_SELF/self.json" >/dev/null 2>&1

    python3 - "$TMPDIR_SELF/self.json" "$FIXTURES/must-detect.txt" <<'PY'
import json, sys, os

report_path, detect_path = sys.argv[1], sys.argv[2]
findings = json.load(open(report_path)) if os.path.getsize(report_path) else []

expected = {i for i, line in enumerate(open(detect_path), 1)
            if line.startswith("EXPECT ")}

detected, false_positives = set(), []
for f in findings:
    name = os.path.basename(f["File"])
    if name == "must-detect.txt":
        detected.add(f["StartLine"])
    elif name == "must-ignore.txt":
        false_positives.append((f["StartLine"], f["RuleID"]))

ok = True
missed = sorted(expected - detected)
if missed:
    ok = False
    print("  MISSED: must-detect.txt lines %s were not flagged." % missed)
    print("  A secret this scanner is supposed to catch would now get through.")
for line, rule in sorted(false_positives):
    ok = False
    print("  FALSE POSITIVE: must-ignore.txt line %d flagged by '%s'." % (line, rule))
    print("  Placeholders must not fire, or the scan becomes noise people skip.")

if ok:
    print("  %d/%d fixture secrets detected, 0 false positives."
          % (len(detected & expected), len(expected)))
sys.exit(0 if ok else 1)
PY
}

scan_history() {
    echo -e "${BLUE}==> scanning full git history${NC}"
    # --log-opts=HEAD restricts the walk to HEAD's ancestry. Without it
    # gitleaks scans every ref, including the local Conductor checkpoint
    # commits, which turned 1 real finding into 40.
    gitleaks git "$REPO_ROOT" --config "$CONFIG" --log-opts="HEAD" \
        --redact --no-banner -v
}

scan_staged() {
    echo -e "${BLUE}==> scanning staged changes${NC}"
    gitleaks git "$REPO_ROOT" --staged --config "$CONFIG" --redact --no-banner -v
}

MODE="${1:-full}"
STATUS=0

case "$MODE" in
    --self-test)
        self_test || STATUS=1
        ;;
    --staged)
        self_test || STATUS=1
        scan_staged || STATUS=1
        ;;
    full)
        self_test || STATUS=1
        scan_history || STATUS=1
        ;;
    *)
        echo "usage: $0 [--staged|--self-test]" >&2
        exit 2
        ;;
esac

echo ""
if [[ $STATUS -eq 0 ]]; then
    echo -e "${GREEN}No secrets found.${NC}"
else
    echo -e "${RED}Secret scan FAILED.${NC}"
    echo -e "${YELLOW}If a finding is a false positive, add a shape-based allowlist"
    echo -e "to .gitleaks.toml -- and add the case to security/gitleaks-selftest/"
    echo -e "so the exemption is itself tested. If it is real: rotate the secret"
    echo -e "first, then remove it. Rotation is the remediation; deleting the"
    echo -e "line is not.${NC}"
fi
exit $STATUS
