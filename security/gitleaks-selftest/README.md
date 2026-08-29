# Secret-scanner self-test fixtures

These two files exist so the secret scanner cannot quietly stop working.

## Why a self-test at all

SEC-1 leaked a Supabase pooler connection string. The obvious remediation is
"add gitleaks" — but that would not have caught it. Running stock gitleaks
against the actual historical `DEBUG_CHECKLIST.md` returns:

```
INF no leaks found
```

The default ruleset has no rule for a PostgreSQL URI with an embedded
password. So `.gitleaks.toml` adds `postgres-uri-password`, and with it the
same file reports `RuleID: postgres-uri-password`.

That gap is easy to reintroduce — a config refactor, a gitleaks upgrade that
changes allowlist semantics, or someone widening an allowlist to silence a
false positive. `must-detect.txt` turns that from a silent regression into a
failing build.

## The two files

- **`must-detect.txt`** — every `EXPECT ` line is a fake secret the scanner is
  required to flag. All values are invented; none were ever real.
- **`must-ignore.txt`** — placeholders that appear in this repo's own docs, plus
  the Phaser animation keys the stock `generic-api-key` rule misreads as
  credentials. None of these may be flagged. False positives are not harmless:
  a noisy scan is one people learn to click past, which is how a real finding
  gets waved through.

Both are verified by `scripts/scan-secrets.sh --self-test`, which runs ahead of
every scan and in CI.

## Adding an allowlist entry

If you silence a false positive in `.gitleaks.toml`, add the case to
`must-ignore.txt` in the same change. That way the exemption is itself tested,
and stays as narrow as it was the day it was written.

`.gitleaks.toml` allowlists are matched on *shape* rather than on exact strings
or line numbers, so moving code does not resurrect a false positive — and does
not silently widen the exemption either.

## Note on scanning these files

`.gitleaks.toml` allowlists this directory by path, so the repo scan does not
trip over its own fixtures. The self-test copies the directory to a temp path
first, where that allowlist no longer applies — so the rules genuinely run
against these files rather than being skipped.
