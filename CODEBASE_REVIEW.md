# Codebase Review — Banana Pajama Zombie Shooter

**Date:** 2026-08-28 (revised 2026-08-29 after remediating SEC-1, SEC-4, DB-1, DB-4, DATA-1, INFRA-1, QA-1, GAME-1, GAME-2, GAME-3 and part of CLIENT-4)
**Reviewed at:** branch `dryakepin/porto` (base `origin/main`, HEAD `46788a1`)
**Scope:** full repository — client (Phaser), `server/` (Express), `api/` (Vercel functions), `database/`, `docker/`, `nginx/`, `scripts/`, docs
**Mostly analysis.** Findings are analysis only except SEC-1, SEC-4, DB-1, DB-4, DATA-1, INFRA-1, QA-1, GAME-1, GAME-2, GAME-3 and CLIENT-4, whose remediations are recorded inline below.

---

## Executive summary

The game works, but the repository has accumulated the classic failure modes of a year-old project that was refactored twice (AWS → Vercel, Docker Postgres → Supabase) without cleaning up behind itself. The recurring theme is **two of everything**: two backends, three schema definitions, four nginx configs, two CORS policies. Nobody can tell from the code which one is live.

Headline items:

- ~~**A live database password is committed to git and pushed to `origin/main`**~~ (`DEBUG_CHECKLIST.md:66`). **Rotated 2026-08-28 — see SEC-1.**
- ~~**`scripts/migrate-supabase.js` silently discards half of the schema**~~, including both `CREATE TABLE`s and the `high_scores` RLS lockdown. It reported success while doing almost nothing. **Fixed 2026-08-28 — see DB-1.**
- ~~**`docker compose` does not run at all**~~ — the compose file was invalid without an explicit profile flag that no script or doc passed. **Fixed 2026-08-28 — see INFRA-1.**
- ~~**A gameplay bug produces invulnerable zombies.**~~ Once a zombie group hit its `maxSize`, new zombies were created into the scene but silently rejected from the group, so bullets passed through them forever. **Fixed 2026-08-29 — see GAME-1.**
- ~~**Zero tests**, no lint config, and both `npm test` and `npm run lint` are documented but non-functional.~~ **Fixed 2026-08-29 — 113 tests, lint and CI; see QA-1.**

Counts: **6 critical (P0)** — 6 resolved — **11 high (P1)** — 1 resolved — **16 medium (P2)** — 2 resolved, 1 partial — **11 low (P3)**.

### Severity legend

| | Meaning |
|---|---|
| **P0** | Exploitable, data-destroying, or a documented workflow that is simply broken. Fix now. |
| **P1** | Real user-facing bug, security weakness, or scaling wall. Fix this cycle. |
| **P2** | Correctness/maintainability debt that will bite. Schedule it. |
| **P3** | Cleanup, hygiene, stale docs. |

---

## P0 — Critical

### SEC-1 · Live Supabase database credential committed to git — ✅ RESOLVED 2026-08-28
**`DEBUG_CHECKLIST.md:66`**

A full pooler connection string for Supabase project `ldzzpasypsahpqmfyknn`, including the plaintext password, is committed in a tracked markdown file. It was introduced in commit `6f0556f` ("Add debug endpoint for connection troubleshooting") and is present on `main` and on `origin/main` (`github.com/dryakepin/banana-pajama`).

The app connects as the `postgres` role (`api/lib/db.js`). On Supabase that is not a true superuser — `SELECT rolsuper FROM pg_roles` returns false for it, and `supabase_admin` is the only `rolsuper` — but it owns the application tables and carries `BYPASSRLS`, so the credential granted full read/write/DDL over all application data. The RLS work in `database/supabase-rls.sql` offers no protection against it.

**Resolution (2026-08-28):**

1. Password reset via the Supabase dashboard. Verified by confirming the leaked value is now *rejected* — the first reset attempt silently failed to apply, and that was only caught by explicitly testing the old credential. **Always verify a rotation by proving the old secret no longer authenticates**; a working new secret does not prove the old one is dead.
2. All five Vercel production vars re-issued (`DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_PASSWORD`) and redeployed; `/api/health` confirms `database: connected`.
3. Post-incident check for persistence found nothing: 15 roles, all stock Supabase; 37 tables, all in Supabase-managed schemas except `public.high_scores` and `public.game_sessions`. This rules out a backdoor role or object. It does **not** establish whether data was read during the exposure window — that is unknowable from the database side. The only personal data at risk was leaderboard player names.

**Follow-ups since:**

- ~~Remove the string from `DEBUG_CHECKLIST.md` (and preferably delete that file and `DEBUG_INSTRUCTIONS.md` — see DOC-2).~~ ✅ Both files deleted in `f7d5edf`.
- ~~Add a secret scanner so this cannot recur.~~ ✅ **Done 2026-08-29 — see below.**
- History rewrite is optional. The repository is public, so the value should be considered permanently disclosed; rotation was the remediation, and a rewrite only reduces casual discoverability.

**Still outstanding:**

- Consider connecting as a least-privilege role that owns only `high_scores` and `game_sessions` instead of `postgres`. That would have bounded this incident, and it is a precondition for the RLS work in `database/supabase-rls.sql` to mean anything.

#### Secret scanner (2026-08-29)

**Adding stock gitleaks would not have caught this leak.** Run against the real
historical `DEBUG_CHECKLIST.md` from commit `6f0556f`, the default ruleset reports:

```
INF no leaks found
```

The ~170 built-in rules cover provider tokens (GitHub PATs, Slack, Stripe, JWTs)
but have no rule for a PostgreSQL URI with an embedded password — which is exactly
the shape that leaked. A probe of nine credential shapes against the default
config detected one. Dropping in the tool and calling SEC-1 closed would have
installed the *appearance* of a control over the specific gap that caused the
incident.

What was added:

| File | Purpose |
|---|---|
| `.gitleaks.toml` | Extends the default ruleset with `postgres-uri-password` and `supabase-secret-key`. Allowlists are shape-based, not string- or line-based. |
| `security/gitleaks-selftest/` | Fixtures: 6 fake secrets that must be detected, 15 placeholders that must not be. |
| `scripts/scan-secrets.sh` | Self-test, then scan. Always `--redact`, so no secret reaches a CI log. |
| `scripts/hooks/pre-commit` | Blocks the commit. Fails closed if gitleaks is missing. |
| `.gitleaksignore` | The one known historical finding, scoped to that commit/file/line. |
| `.github/workflows/ci.yml` | `secrets` job; gitleaks pinned to 8.30.1 and checksum-verified. |

Verified in both directions, since a scanner that cannot fail proves nothing:

| Check | Result |
|---|---|
| Real leaked file, stock gitleaks | `no leaks found` — the gap, confirmed |
| Real leaked file, this config | `RuleID: postgres-uri-password` |
| Full history scan (76 commits) | 1 finding, at `6f0556f:DEBUG_CHECKLIST.md:66` — the SEC-1 credential |
| Self-test, `postgres-uri-password` broken | Fails, naming the 3 missed lines |
| Self-test, allowlist broken | Fails, naming the false positives |
| `git commit` of a fake connection string | **Rejected**, value redacted in output |
| Clean staged change | Passes |

Two judgement calls worth recording:

- **The 8 `generic-api-key` hits in `GameScene.js` are false positives** — Phaser
  animation keys like `key: 'zombie4-attack'`. Allowlisted on shape, and added to
  `must-ignore.txt`, so the exemption is itself tested and stays narrow.
- **`--log-opts=HEAD` is load-bearing.** By default gitleaks walks every ref,
  including the local Conductor checkpoint commits, which turned 1 real finding
  into 40. A scan that reports 40 findings for 1 problem is one people stop reading.

The self-test is the part that matters long-term. It converts "we have a scanner"
into "the scanner still catches the thing that actually happened to us," checked
on every run. This is the SEC-1 lesson generalised: **a control that has not been
observed failing has not been verified.**

### DB-1 · The Supabase migration script drops half of the schema, silently — ✅ RESOLVED 2026-08-28
**`scripts/migrate-supabase.js:73-102`**

The statement splitter is:

```js
const statements = sql.split(';').map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
```

Splitting on `;` leaves each statement prefixed by the comment block that precedes it, so `!s.startsWith('--')` throws that statement away. Verified against the real `database/init-supabase.sql`: **8 of 16 statements are dropped**, including:

- `CREATE EXTENSION "uuid-ossp"`
- `CREATE TABLE high_scores`
- `CREATE TABLE game_sessions`
- `CREATE INDEX idx_high_scores_score`
- the seed `INSERT`
- `CREATE VIEW leaderboard`
- **`ALTER TABLE high_scores ENABLE ROW LEVEL SECURITY`**
- **`ALTER VIEW leaderboard SET (security_invoker = on)`**

The 8 statements that *do* run are the ones that happen not to be comment-prefixed — three `CREATE INDEX`es, the `game_sessions` RLS enable, and four `REVOKE`s. On a fresh database every one of them fails with "relation does not exist", and the script's error handler prints `✗ Error` but **still exits 0**.

The security consequence is specific and nasty: on any database provisioned or updated with this script, `game_sessions` has RLS enabled but **`high_scores` does not**, and the `leaderboard` view still runs as definer. That is exactly the hole `database/supabase-rls.sql` was written to close. `server/index.js:74-76` explicitly recommends this script as the preferred Supabase path.

**Fix:** Do not hand-roll a SQL splitter. Send the file as a single multi-statement query (`pg` supports it when no parameters are bound), or use a real migration tool (`node-pg-migrate`, `dbmate`, Supabase CLI migrations). Exit non-zero on any error.

#### Resolution (2026-08-28)

**Reproduced first, against a throwaway `postgres:15` container.** The real behaviour on a genuinely empty database is worse than the static reading above: only **1 of 16 statements** executes. The other seven that survive the comment filter all depend on tables that were never created, so they error out:

```
✗ Error: relation "high_scores" does not exist
✗ Error: relation "game_sessions" does not exist
... 7 errors total
✅ Migration completed!
   Successful: 1
   Errors: 7
EXIT CODE = 0
```

`\dt` afterwards: `Did not find any relation named "public.*"`. An empty database, and a green checkmark.

Two changes:

1. **`scripts/migrate-supabase.js`** — splitter deleted. The file is now sent as one multi-statement query inside `BEGIN`/`COMMIT`, so provisioning is all-or-nothing; on error it rolls back, maps the Postgres byte offset to a line number in the `.sql` file, and exits non-zero.
2. **`database/init-supabase.sql`** — the seed `INSERT` was guarded with `WHERE NOT EXISTS (SELECT 1 FROM high_scores)`. Its old `ON CONFLICT DO NOTHING` was decorative: `high_scores` has no unique constraint, so nothing could ever conflict, and a **second run would have appended the ten seed rows again**. Fixing the runner without fixing this would have turned a script that did nothing into a script that corrupted the leaderboard.

Verified against the throwaway database:

| Scenario | Result |
|---|---|
| Fresh database | Both tables, view, 4 indexes, RLS on `high_scores` **and** `game_sessions`, `security_invoker=on`, 0 anon grants. Exit 0. |
| Run a second time | Still 10 seed rows, not 20. Exit 0. |
| Induced failure (`DROP ROLE anon`) | `❌ Migration failed, rolled back. Nothing was applied.` Exit **1**. |

**Production was already correct** and needed no repair — the lockdown had been applied by hand in PR #1, before this script was ever re-run:

```
    relname    | relrowsecurity          reloptions
---------------+----------------          -----------------------
 high_scores   | t                        {security_invoker=on}
 game_sessions | t
 leaderboard   | f  (view)
anon/authenticated grants on public: 0 rows
```

So the exposure was latent rather than live: the hole would have opened the next time anyone provisioned a database with this script.

**Note for whoever runs it next:** there is no `node_modules` anywhere in the repo and no root `package.json`, so `node scripts/migrate-supabase.js` cannot resolve `pg` or `dotenv` as shipped. That is not fixed here — see QA-1.

### GAME-1 · Zombies past the group cap are invulnerable and unkillable — ✅ RESOLVED 2026-08-29
**`client/src/scenes/GameScene.js:866-877`**

```js
let zombie = group.getFirstDead();
if (!zombie) {
    zombie = new ZombieClass(this, x, y);
    group.add(zombie);
}
```

Phaser 3's `Group.add()` returns early when the group is at `maxSize` (verified in `phaser@3.80.1`, `src/gameobjects/group/Group.js`). But `ZombieClass`'s constructor has already called `scene.add.existing(this)` and `scene.physics.add.existing(this)`, so the sprite is in the display list, the update list, and the physics world regardless.

The result is a zombie that renders, pathfinds, and damages the player — but is **not a member of `this.zombies`**, so:

- `physics.add.overlap(this.bullets, this.zombies, ...)` never sees it → bullets pass straight through, it can never be killed;
- `killAllZombies()` (which iterates `group.children.entries`) never kills it;
- nothing ever removes it.

Combined with GAME-2 below (the pool is never actually reused, so the groups fill up and stay full), this triggers reliably in any long run. The same bug applies to `bullets` (`maxSize: 50`) and `powerUps` (`maxSize: 20`): an orphan bullet is also excluded from `runChildUpdate`, so its `update()` never runs and it flies forever, accumulating.

**Fix:** Use `group.get(x, y)` (which respects `maxSize` and returns `null` when full) and bail out of the spawn when it returns `null`. Never construct-then-`add`.

#### Resolution (2026-08-29)

`_spawnZombieOfType` no longer constructs then adds:

```js
let zombie = group.getFirstDead(false);
if (zombie) {
    zombie.reset(x, y);
} else {
    zombie = group.create(x, y);   // null when at maxSize
    if (!zombie) return;           // skip the spawn; never build an orphan
}
```

`Group.create()` runs the same `isFull()` check *before* constructing, so the orphan is never built. The same pattern now guards `shoot()` (both barrels) and `spawnPowerUp()`; for power-ups `create(x, y, type)` works because Group forwards its third argument to the constructor's `key` parameter, which `PowerUp` uses as its type.

**Four Phaser behaviours were verified from source before relying on them**, since the whole fix depends on them:

| Concern | Phaser 3.90.0 source | Verdict |
|---|---|---|
| Does `add()` really drop silently? | `Group.add`: `if (this.isFull()) { return this; }` | Yes — GAME-1 confirmed |
| Does the constructor's `scene.add.existing()` clash with `create()`'s `addToDisplayList()`? | `GameObject.addToDisplayList`: *"Don't repeat if it's already on this list"* | Safe |
| Double-add to the update list? | `UpdateList.checkQueue = true`, and `ProcessQueue.add` dedupes when set | Safe |
| Second physics body? | `PhysicsGroup.createCallbackHandler`: `if (!child.body)` | Safe |

Note the installed Phaser is **3.90.0**, not the 3.80.1 this report originally cited — `client/package.json` pins `^3.80.1` and the minor floated. The `add()` early-return is identical in both.

`_spawnZombieOfType` also lost its `ZombieClass` parameter. `group.create()` builds from the group's own `classType` regardless, so a separate parameter could silently disagree with what is actually constructed.

### GAME-2 · Object pooling does not work for three of four zombie types — ✅ RESOLVED 2026-08-29
**`client/src/sprites/BasicZombie.js:274-297`, `TankZombie.js:312-338`, `FastZombie.js:316-340`**

```js
this.scene.time.delayedCall(500, () => { this.destroy(); });
...
destroy() { this.isActive = false; super.destroy(); }
```

`super.destroy()` genuinely destroys the sprite and removes it from the group. So `getFirstDead()` can never find a Basic/Tank/Fast zombie to recycle, and each of their `reset()` methods is unreachable dead code. Every spawn allocates a new sprite and a new physics body.

`AnimatedZombie` is the only one that pools correctly (`handleDeathComplete()` deactivates instead of destroying) — which is why it is also the only one that hits GAME-3.

`Bullet.destroy()` and `PowerUp.destroy()` have the opposite problem: they override `destroy()` **without** calling `super.destroy()`, so those objects can never be truly freed, even on scene shutdown.

CLAUDE.md advertises "Sprite pooling for bullets and zombies" and "Maximum 50 concurrent zombies". Neither is true today.

**Fix:** Pick one convention. Standard Phaser pooling is `setActive(false); setVisible(false); body.enable = false` in a `deactivate()` method — leave `destroy()` alone entirely so the engine's teardown path still works.

#### Resolution (2026-08-29)

Exactly that convention, applied to all six pooled classes. Each now has:

```js
deactivate() {
    this.isActive = false;
    this.setActive(false);
    this.setVisible(false);
    if (this.body) { this.setVelocity(0, 0); this.body.enable = false; }
}
```

Basic/Tank/Fast zombies call it from their death delays instead of `destroy()`, so `getFirstDead()` can find them and their previously-unreachable `reset()` methods now run. `AnimatedZombie` routes its fade-out `onComplete` through the same method.

`Bullet` and `PowerUp` had the opposite defect — `destroy()` overridden **without** `super.destroy()`, so they could never be freed even on scene shutdown. That method is renamed `deactivate()` and every self-`destroy()` call site updated; `destroy()` is once again Phaser's, so teardown works. `reset()` and `Bullet.fire()` re-enable the physics body that `deactivate()` switched off.

### GAME-3 · Zombie speed and HP compound geometrically on pooled reuse — ✅ RESOLVED 2026-08-29
**`client/src/scenes/GameScene.js:879-886` + `client/src/sprites/AnimatedZombie.js:387-419`**

```js
if (this.zombieSpeedMultiplier > 1) zombie.speed *= this.zombieSpeedMultiplier;
if (this.zombieHpMultiplier > 1) { zombie.maxHealth = Math.ceil(zombie.maxHealth * this.zombieHpMultiplier); ... }
```

This runs on every spawn — including on a **recycled** zombie. `AnimatedZombie.reset()` restores `health` from `maxHealth` but never restores `speed` or `maxHealth` to their constructor values, so the multipliers stack multiplicatively across reuses.

At difficulty level 10 (5 minutes in) the speed multiplier is 1.25. An animated zombie recycled 20 times over a long run ends up at roughly `1.25^20 ≈ 86×` base speed, with HP scaled the same way. The run becomes unplayable — and it will look like a random, unreproducible "the game went crazy" bug.

**Fix:** Store `baseSpeed` / `baseMaxHealth` on construction and have `reset()` restore from those before the scene applies scaling. Better: derive the scaled values from base × current multiplier rather than mutating in place.

#### Resolution (2026-08-29)

Both halves. All four zombie classes capture `baseSpeed` / `baseMaxHealth` in the constructor and restore them in `reset()`, and the scene now *derives* rather than mutates:

```js
zombie.speed = zombie.baseSpeed * this.zombieSpeedMultiplier;
zombie.maxHealth = Math.max(1, Math.ceil(zombie.baseMaxHealth * this.zombieHpMultiplier));
zombie.health = zombie.maxHealth;
```

Deriving makes the operation idempotent, so it is correct however many times a zombie is recycled — and it also scales *down* when a new round resets the multipliers, which restoring-then-multiplying alone would not guarantee. The `Math.max(1, …)` floor stops a zero multiplier producing an unkillable 0-HP zombie. The old `if (multiplier > 1)` guards are gone; the derivation is unconditional.

### INFRA-1 · `docker compose` is invalid — local development is broken — ✅ RESOLVED 2026-08-28
**`docker/docker-compose.yml:6-8, 65-67`**

The `database` service is gated behind `profiles: [local-db]`, but `server` still declares an unconditional hard dependency on it:

```yaml
depends_on:
  database:
    condition: service_healthy
```

Verified with Docker Compose v2.34.0:

```
$ docker compose config --services
service "server" depends on undefined service "database": invalid compose project
```

Every compose command fails unless `--profile local-db` is passed. Consequently:

- `scripts/deploy-local.sh` (`docker-compose build`, `docker-compose up -d`, no profile) fails immediately.
- The Supabase workflow documented in the file's own comments (`docker-compose up server client`, lines 61-64) cannot work.
- `README.md` / `QUICK_START.md` instructions for `docker-compose up -d` are broken.

**Fix:** Make the dependency conditional — either put `server`'s `depends_on` behind the same profile, or drop `condition: service_healthy` and let the app retry its DB connection (which `server/config/database.js` is already structured to tolerate). Then update `deploy-local.sh` and the docs to pass the profile.

#### Resolution (2026-08-28)

Neither suggested option was needed. Compose has a first-class answer — `required: false` on the dependency (Compose spec, v2.20+), which keeps `condition: service_healthy` meaningful when the profile *is* active and ignores the dependency when it is not. That is one line, and it preserves the startup ordering the original author wanted.

```yaml
depends_on:
  database:
    condition: service_healthy
    required: false
```

Before and after, Docker Compose v2.34.0:

| | no profile (Supabase mode) | `--profile local-db` |
|---|---|---|
| **Before** | `service "server" depends on undefined service "database": invalid compose project` | OK |
| **After** | OK | OK |

**`scripts/deploy-local.sh`** sets `export COMPOSE_PROFILES=local-db` once near the top rather than adding `--profile` to each of its fifteen call sites. The script drives the full stack — it calls `exec -T database pg_isready` — so it always needs the profile, and a single export also covers the invocations that use `-f docker/docker-compose.yml` instead of `cd docker`. Threading the flag through by hand is how it went missing originally. The echoed "Quick commands" help text does spell out `--profile local-db`, since humans copy those.

Docs updated where the full stack is meant: `README.md` (quickstart and Docker section) and `CLAUDE.md`. The Supabase-mode invocations (`docker-compose up server client` in `README.md` and `docs/SUPABASE_DEPLOYMENT.md`) were already correct and now actually work.

**Verified by running it, not just by `config`.** `docker compose --profile local-db up -d --build` brought up all four services; `database` reached healthy, `server` waited for it and then reported healthy, client returned 200 on :8080 and Adminer 200 on :8081. `./scripts/deploy-local.sh status` lists all four. `docker compose --dry-run up server client` (no profile) is likewise accepted.

**One thing checked and cleared along the way.** `server/index.js:1` calls `dotenv.config()`, and the compose file bind-mounts `../server:/app` — so the host's `server/.env`, which holds live production Supabase credentials, is visible inside the "local" container. It does *not* redirect the local stack to production: compose sets `DATABASE_URL: ${DATABASE_URL:-}`, dotenv will not overwrite a key already present in `process.env`, and `server/config/database.js` only consults `DATABASE_URL` (not `POSTGRES_URL`, unlike `api/lib/db.js`). Confirmed at runtime — the server logged `Database connected successfully (local)` and served the local volume's 20 dev rows rather than production's 41.

That safety is incidental rather than designed, and it is one exported variable away from breaking: a developer with `DATABASE_URL` set in their shell gets a "local" stack silently pointed at production. Mounting real credentials into a development container is worth removing on its own merits — but it is a distinct problem from this finding, and is not fixed here.

---

## P1 — High

### ARCH-1 · Two parallel backend implementations; which one serves a request is unknowable from the code
**`server/index.js` vs `api/highscores.js` / `api/sessions.js` / `api/health.js`, routed by `vercel.json:13-22`**

Every endpoint exists twice:

| Route | `api/*.js` function | `server/index.js` Express route |
|---|---|---|
| `GET/POST /api/highscores` | ✅ `api/highscores.js` | ✅ line 174 / 195 |
| `GET /api/health` | ✅ `api/health.js` | ✅ line 49 |
| `POST /api/sessions/start|end` | ✅ `api/sessions.js` | ✅ line 261 / 281 |
| `POST /api/init-db` | — | ✅ line 77 |

`vercel.json` rewrites `/api/(.*)` → `/api` (i.e. `api/index.js`, which re-exports the Express app), but Vercel checks the filesystem before applying rewrites. So `/api/highscores` resolves to the serverless function while `/api/sessions/start` (no matching file) falls through the rewrite into Express. Nothing in the repo states this, and it changes with any Vercel routing tweak.

This is not cosmetic — the two paths have **different security postures**:

| | `api/*.js` | `server/index.js` |
|---|---|---|
| CORS | explicit origin allowlist | `cors()` with env override |
| Security headers | none | `helmet()` |
| Rate limiting | per-instance `Map` | `express-rate-limit` |
| DB pool | new pool per request, `max: 1` | shared pool, `max: 20` |
| SSL verify | disabled for Supabase | disabled for Supabase |

**Fix:** Delete one. Given the deployment is Vercel, the serverless functions are the natural survivor — but they need helmet-equivalent headers added first. Whichever you keep, delete the other and the now-dead `api/index.js` shim.

### SEC-2 · `vercel.json` wildcard CORS overrides the code's origin allowlist
**`vercel.json:42-57` vs `api/lib/middleware.js:5-18`**

`api/lib/middleware.js` carefully allowlists three origins. `vercel.json` then unconditionally attaches `Access-Control-Allow-Origin: *` to every `/api/*` response. The allowlist is dead code at best; at worst the two produce duplicate/conflicting `Access-Control-Allow-Origin` headers, which browsers reject outright.

**Fix:** Remove the CORS block from `vercel.json` and let the handlers own it. Add `Vary: Origin` so caches don't cross-serve.

### SEC-3 · TLS certificate verification disabled on every database connection
**`api/lib/db.js:21-23`, `api/health.js:24-26`, `server/config/database.js:23, 48`, `scripts/migrate-supabase.js:30, 41`**

`ssl: { rejectUnauthorized: false }` appears in five places. As written, any party able to intercept the connection can present a self-signed certificate and read or modify all traffic, including the database credentials.

**The app actively depends on this — demonstrated 2026-08-28.** During the SEC-1 rotation, `sslmode=require` was added to `DATABASE_URL` as a hardening step. Production immediately failed with `self-signed certificate in certificate chain`, and reverting the parameter restored service. Two things follow:

1. Supabase's pooler chain is **not** validated by Node's default trust store, so the CA bundle is genuinely required — this is not a config nicety that can be flipped on.
2. More subtly: `pg` merges connection-string SSL settings **over** the explicit config object (`ConnectionParameters` assigns the parsed `connectionString` on top of the passed config). So an `sslmode` in the URL silently overrides `ssl: { rejectUnauthorized: false }` in code. The two settings are not independent, and the URL wins.

That makes the current environment fragile in a non-obvious way: `POSTGRES_URL` and `POSTGRES_PRISMA_URL` both still carry `sslmode=require` and would fail exactly the same way. They are harmless only because `api/lib/db.js:8-10` reads `DATABASE_URL` first. Remove that one variable and production breaks with an error that looks nothing like its cause.

`api/health.js:24` is the worst case: it disables verification unconditionally, for *any* host, not just Supabase.

**Fix:** Download Supabase's CA certificate (Dashboard → Settings → Database → SSL Configuration), ship it with the app, and use `ssl: { ca: fs.readFileSync(...), rejectUnauthorized: true }`. Then make all connection strings agree — either all carry `sslmode=verify-full` or none carry `sslmode` at all. Do not attempt this by editing URLs alone; per point 2 it cannot work without the CA.

### SEC-4 · No `.dockerignore`, and `.gitignore` prevents one from ever being added
**`.gitignore:53-54`, `server/Dockerfile:18`, `client/Dockerfile`**

```
# Docker
.dockerignore
```

`.gitignore` ignores the `.dockerignore` file itself, so none exists anywhere in the repo. `server/Dockerfile` then does `COPY . .` after `npm ci`, which copies the host's `server/.env` (present locally, 2.9 KB of real configuration) and `node_modules` straight into the image layer.

Anyone who can `docker pull` or `docker save` the image gets the secrets, and the image is needlessly bloated.

**Fix:** Delete the `.dockerignore` line from `.gitignore`; add `.dockerignore` files excluding at least `.env*`, `node_modules`, `.git`, `dist`, `*.md`.

### SEC-5 · Rate limiting is non-functional on both backends
**`server/index.js:16-20`** and **`api/lib/middleware.js:29-58`**

Express side: `express-rate-limit` keys on `req.ip`, and `app.set('trust proxy', ...)` is never called. Behind Vercel (or the ALB, or the nginx configs in this repo), `req.ip` is the proxy's address for every request, so **all users of the site share a single 100-requests-per-15-minutes bucket**. One player refreshing the leaderboard can 429 everyone else. This is a self-inflicted DoS, not a defence.

The `/api/health` endpoint is behind the same limiter, and `server/healthcheck.js` polls it every 30 s from the container plus whatever the load balancer does — so the health check itself consumes the shared budget.

Serverless side: the limiter is a module-scope `Map`. Vercel runs many concurrent instances and recycles them constantly, so the counter resets arbitrarily and is trivially bypassed by fanning out. It also keys on the raw `x-forwarded-for` header, which is a comma-separated list, not a single IP.

**Fix:** Set `trust proxy` correctly for the Express app. For the serverless path, use a shared store (Upstash/Redis, Vercel KV) or Vercel's own rate limiting — an in-memory limiter in a serverless function is decorative. Exempt health endpoints.

### SEC-6 · High score submission is unauthenticated and entirely client-trusted
**`api/highscores.js:31-84`, `server/index.js:195-258`, `client/src/scenes/NameEntryScene.js:354-366`**

The score, survival time, and kill count are computed in browser JavaScript and POSTed with no token, signature, or session binding. A single `curl` writes any name and any score up to the 50 000 cap onto the leaderboard. There is also no cross-field sanity check — `{score: 50000, survival_time: 1, zombies_killed: 0}` is accepted.

For a hobby leaderboard this may be an acceptable risk, but it should be a *decision*, not an oversight — right now `TODO.txt` lists "Security audit: input validation, rate limiting, CORS" as complete, which overstates the position.

**Fix (proportionate options, cheapest first):** (a) require the `session_id` from `/api/sessions/start` and validate `score`/`time` against the server-recorded session duration; (b) add a plausibility rule (`score <= survival_time * 30 + zombies_killed * 60`); (c) HMAC the payload with a build-time secret. None of these stop a determined attacker, but they stop `curl`.

### SEC-7 · No security headers on the deployed client
**`vercel.json:23-58`**

The Vercel deployment sets only `Cache-Control` and CORS headers. There is no CSP, no `X-Content-Type-Options`, no `Referrer-Policy`, no HSTS. A perfectly good CSP exists in `nginx/production.conf:38` — but nginx is not part of the Vercel deployment path, so it protects nothing.

**Fix:** Port the header block from `nginx/production.conf` into `vercel.json`'s `headers` for `/(.*)`.

### DB-2 · `game_sessions.session_id` has no uniqueness constraint
**`database/init.sql:25-37`, `database/init-supabase.sql:21-33`, `server/index.js:97-111`**

`session_id UUID DEFAULT uuid_generate_v4()` is nullable and non-unique; only a plain (non-unique) btree index exists. `POST /api/sessions/end` does `UPDATE game_sessions ... WHERE session_id = $1` with no `LIMIT`, so a duplicate or NULL value silently overwrites multiple rows. There is also no check that the session isn't already ended, so any caller holding a UUID can rewrite that session's stats indefinitely.

**Fix:** `session_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE`, and add `AND end_time IS NULL` to the update.

### PERF-1 · The tile map creates ~12 500 sprites for a 1 728-tile world
**`client/src/world/TileMap.js:6, 180-187, 352-371`**

`RENDER_DISTANCE = 3` with `CHUNK_SIZE = 16` loads a 7×7 grid of chunks = 49 chunks × 256 tiles = **12 544 individual `Phaser.GameObjects.Image` instances**, each created synchronously in `renderChunk()`.

The actual playable map (`MAP_WIDTH 3072 × MAP_HEIGHT 2304`) is only 48 × 36 = 1 728 tiles. The render distance reaches 112 tiles in each direction — roughly **7× more sprites than the map contains**, the surplus being off-map border `BUILDING` tiles that are never visible.

Every chunk boundary crossing then builds another 256 sprites in one frame, which is a visible hitch. This is the single biggest render-cost item in the game and the most likely cause of mobile frame drops.

**Fix:** Drop `RENDER_DISTANCE` to 1 (still 3× the viewport), clamp chunk generation to the map bounds, and replace per-tile `Image` objects with a `Blitter`, a baked `RenderTexture` per chunk, or Phaser's tilemap layer. Any one of these cuts the object count by 1–2 orders of magnitude.

### QA-1 · No tests exist, and both `npm test` and `npm run lint` are broken — ✅ RESOLVED 2026-08-29
**`server/package.json:9-10, 26-29`, `client/package.json:10-11`, `README.md:109,117`**

`jest`, `supertest`, and `eslint` are all declared as devDependencies. There are **zero** test files and **no** eslint config file (neither `.eslintrc*` nor `eslint.config.js`), so `npm test` fails with "no tests found" and `npm run lint` fails on missing config — both under eslint 9, which requires flat config.

Meanwhile `CLAUDE.md` claims "Full test coverage for critical paths" and `TODO.txt` lists linting as an open item. The README documents `npm test` as a normal step.

Given the density of logic bugs found in this review (GAME-1 through GAME-4), the absence of even smoke tests is the root cause enabler.

**Fix:** Start with the highest-value, lowest-effort targets: `supertest` integration tests for the four API handlers (validation bounds, method rejection, malformed body), and pure-function unit tests for `TileMap.generateTileType` / `isWalkable`, the difficulty formula, and `sanitizePlayerName`. Add `eslint.config.js` and wire both into CI.

#### Resolution (2026-08-29)

**113 tests across three suites, plus lint on all three workspaces, plus CI.**

| Workspace | Tests | What it covers |
|---|---|---|
| `api/` | 54 | `sanitizePlayerName`, `isValidUUID`, CORS allowlist, rate-limit 429 boundary; `highscores` and `sessions` handlers with the pool mocked — score/time/kill bounds, 405, preflight, empty-after-sanitise names, and that a 500 never leaks the database error |
| `client/` | 48 | DATA-1 duplicate-submission guard; the difficulty curve; `TileMap` coordinate maths and walkability |
| `server/` | 11 | DB-1 migration runner against a real Postgres |

**Every regression test was verified to fail against the pre-fix code**, which is the only thing that makes a regression test worth having:

- DATA-1 suite against `66a4035` (before PR #5): **8 of 9 failed**.
- DB-1 suite against `66a4035`: **9 of 11 failed**. (One of the two passes vacuously — "anon has no grants" holds when no tables exist at all.)

**Design choices worth recording:**

- **No root `package.json`.** It would give a single `npm test`, but this repo has never had one and adding it risks changing Vercel's project detection (`vercel.json` pins `framework: null` with an explicit `buildCommand`). `scripts/test-all.sh` gives the same convenience with no deployment risk.
- **Phaser is stubbed, not loaded** (`client/test/stubs/phaser.js`). The real engine needs canvas, WebGL and a DOM at import time. Scene classes only need `Phaser.Scene` to extend. The cost is stated below.
- **The migration tests skip unless `TEST_DATABASE_URL` is set**, so `npm test` never requires Docker. CI always runs them against a Postgres service container.
- **The difficulty formulas were extracted** from `GameScene.increaseDifficulty()` into `client/src/world/difficulty.js` so they could be tested at all. Verified behaviour-identical to the original inline expressions across levels 0–500 before the old code was removed.
- **No tests for `server/`'s routes.** They duplicate `api/`, need a live database, and ARCH-1 is still unresolved — cementing the duplicated backend with tests would make it harder to delete.

**Lint** is `eslint.config.js` in all three workspaces: flat config, deliberately a small high-signal rule set rather than `recommended`, since a never-linted codebase would drown in stylistic warnings. It found a real bug on the first run — see CLIENT-4. Current state: **0 errors, 21 warnings** (all unused variables).

**CI** is `.github/workflows/ci.yml`: three jobs on every push and PR. The client job also runs the production build, precisely because the stubbed Phaser means a green suite does not prove the bundle still compiles.

**What this does NOT cover, stated plainly:** because Phaser is stubbed, none of this can catch bugs in the engine's own semantics. **GAME-1 is exactly such a bug** — `Group.add()` silently rejecting a sprite at `maxSize` is Phaser behaviour, and only a real group would demonstrate it. GAME-1, GAME-2 and GAME-3 remain open and untested. A green client suite is not evidence that gameplay is correct, and the stub file says so in a comment.

> **Superseded 2026-08-29.** The paragraph above was right that a stubbed Phaser cannot catch GAME-1, and wrong that this made GAME-1 untestable. `client/test/pooling.test.js` imports the **real** `Group` (`phaser/src/gameobjects/group/Group.js`), which loads standalone under jsdom, and drives it with the real sprite classes. Booting a full `Phaser.Game` remains impossible here — under jsdom the texture manager waits on `Image` onload events that never fire — but the group semantics GAME-1 depends on are now genuinely exercised rather than assumed. The client suite grew from 48 to 66 tests. The broader caveat still holds for rendering, input and physics integration.

### DEP-1 · Known vulnerabilities in production dependencies
**`server/package.json`, `client/package.json`**

`npm audit --omit=dev` on the server reports **6 vulnerabilities (2 high, 4 moderate)** in shipped code:

- `path-to-regexp <0.1.13` — ReDoS (high), via `express@4.18`
- `qs` — three DoS advisories (moderate)
- `morgan` — log forging via control characters (moderate)
- `uuid <11.1.1` — buffer bounds check (moderate) — *and `uuid` is not actually imported anywhere*

The client has 29 advisories, all in dev tooling (`webpack-dev-server`, `ws`, `websocket-driver`); lower urgency but `webpack-dev-server` issues matter if anyone runs `npm run dev` on an untrusted network.

**Fix:** `npm audit fix` in both packages (non-breaking for the server set). Drop the unused `uuid` and `pg-pool` declarations. Consider Dependabot or Renovate — nothing has been updated in a year.

### CLIENT-1 · `GameOverScene.create()` is `async` and mutates the scene after an `await`
**`client/src/scenes/GameOverScene.js:23-70, 78-117`**

```js
async create() {
    ...
    await this.checkHighScore();     // network round-trip
    this._audio = AudioManager.playMusic(this, 'zombie-theme', { volume: 0.5 });
}
```

Phaser does not await `create()`. Two consequences:

1. **Background music does not start until the `/api/highscores` fetch resolves.** If the API is slow or the user is offline, the Game Over screen is silent for the length of the timeout (there is no timeout — see CLIENT-2 — so potentially forever).
2. `checkHighScore()` calls `this.add.text(...)` and `this.scene.start('NameEntryScene', ...)` after the await. If the player has already left the scene, these run against a torn-down scene.

**Fix:** Make `create()` synchronous. Start the music immediately, fire the high-score check as a detached promise, and guard the continuation with `if (!this.scene.isActive()) return;`.

---

## P2 — Medium

### GAME-4 · Game state is not fully reset between rounds
**`client/src/scenes/GameScene.js:142-145`**

`create()` resets only `score`, `gameTime`, and `hp`. Phaser reuses the same scene instance across `scene.start('GameScene')`, so these constructor-initialised fields carry over from the previous game:

`zombiesKilled`, `difficultyLevel`, `zombieSpeedMultiplier`, `zombieHpMultiplier`, `lastShotTime`, `isInvincible`, `rapidFireActive`, `dualShotActive`, `isPaused`, `powerUpIndicators`.

Most visibly: **`zombiesKilled` accumulates across games and is submitted to the leaderboard**, and a second game starts at the previous game's difficulty level with the previous multipliers already applied (compounding with GAME-3). Restarting after a pause can also start the new game already paused.

**Fix:** Move all of it into an `initState()` called from `create()`, or use Phaser's `init()` hook, which exists for exactly this.

### CLIENT-2 · No timeout or abort on any network call
**`client/src/scenes/HighScoreScene.js:92`, `GameOverScene.js:80`, `NameEntryScene.js:354`**

All three `fetch()` calls are unbounded. On a flaky mobile connection the high-score screen shows "Loading…" indefinitely, and score submission hangs on "Saving score…" with no recovery.

**Fix:** `AbortSignal.timeout(8000)` on each, with a user-visible retry.

### CLIENT-3 · `NameEntryScene` assumes a response shape it doesn't validate
**`client/src/scenes/NameEntryScene.js:375`**

```js
savingText.setText(`Score saved! You're rank #${result.data.rank}!`);
```

If the API returns a `{success: true}` payload without `data` — which the standalone nginx mock at `client/nginx-standalone.conf:35` nearly does, and which any future API change could — this throws inside the `try`, and the user is told **"Failed to save score"** for a score that was saved successfully. Double submission follows.

**Fix:** Optional-chain the access and treat HTTP 2xx as success regardless of body shape.

### CLIENT-4 · `VirtualJoystick` uses the `Phaser` global without importing it — ⚠️ PARTIALLY RESOLVED 2026-08-29
**`client/src/ui/VirtualJoystick.js:1, 46-47`**

The file has no `import Phaser from 'phaser'` but calls `new Phaser.Geom.Circle(...)`. It works today only because Phaser's default entry point is a UMD bundle that assigns `window.Phaser` as a side effect. Switching to Phaser's ESM build, enabling stricter bundling, or tree-shaking will turn this into a runtime `ReferenceError` in the mobile control path.

Also: `setupInput()` is called twice — once from the constructor (line 17) and once from `createJoystick()` (line 40) — so every joystick registers its interactive areas twice.

**Fix:** Add the import; remove the duplicate call.

#### Resolution (2026-08-29)

The missing import is fixed. It was the **first thing the new eslint config caught** — four `no-undef` errors, the only errors in the entire repository — which is a fair advertisement for QA-1 having been worth doing.

**The duplicate `setupInput()` call is NOT fixed.** It is still called from both the constructor (line 24) and the end of `createJoystick()` (line 47), which the constructor calls on line 23, so every joystick still registers its interactive areas twice. That is a behavioural change in the mobile control path with no test covering it, so it did not belong in a testing change.

### CLIENT-5 · Fullscreen handling in `index.js` leaks listeners and can feed back on itself
**`client/src/index.js:373-393, 620-629`**

`tryAndroidCSSTricks()` is reachable from three places (the `ready` handler, `fullscreenunsupported`, and `requestFullscreenOnce`). Each invocation:

- attempts `window.removeEventListener('resize', handleiOSResize)` against a **freshly created closure**, which is a guaranteed no-op — so `resize`, `orientationchange`, and `scroll` listeners accumulate;
- schedules five `applyiOSFullscreen()` timeouts, each of which calls `forcePhaserResize()`.

Separately, the global `resize` handler (line 626) calls `handleOrientationChange()`, which calls `game.scale.resize(...)` — which can itself emit `resize`. Nothing is throttled or debounced.

**Fix:** Hoist the handlers to module scope so they are stable references, guard `tryAndroidCSSTricks` with a run-once flag, and debounce the resize path.

### PERF-2 · 42 individual PNG requests for one zombie's animations
**`client/src/scenes/GameScene.js:76-100`**

Each animation frame of `zombie-4` is loaded as a separate `this.load.image()` — 11 + 6 + 10 + 7 + 8 = 42 HTTP requests and 42 GPU textures, forcing a texture bind per frame change and defeating batching.

**Fix:** Pack them into a single texture atlas (TexturePacker, `free-tex-packer`, or Phaser's own tooling) and load with `this.load.atlas()`. One request, one texture, batched draws.

### PERF-3 · Line-of-sight is recomputed redundantly, per pointer move and per frame
**`client/src/scenes/GameScene.js:571-586, 635-650, 751-781`**

`hasLineOfSight()` walks the ray in 16 px steps, calling `tileMap.isWalkable()` at each — up to ~80 lookups for a screen-diagonal shot. On desktop it runs **twice per frame's worth of input**: once in `update()` via `updateCrosshair()` and again in the `pointermove` handler, which duplicates the same crosshair-position, tint, and sprite-rotation logic verbatim.

**Fix:** Delete the duplicated block from one of the two call sites; cache the result per frame.

### PERF-4 · Serverless functions open and close a database connection per request
**`api/lib/db.js:19-27`, used by `api/highscores.js:95`, `api/sessions.js:72`, `api/health.js:72`**

Every invocation constructs a `Pool`, runs one or two queries, and calls `pool.end()` in `finally`. That is a fresh TCP connection plus TLS handshake per request — typically 50–150 ms of pure latency against Supabase — and it churns connections on the Postgres side under any load.

Meanwhile the *other* backend (`server/config/database.js:31`) has `max: 20`, which is the opposite failure mode in a serverless context: each warm Lambda instance can hold 20 connections open, and Vercel will happily run dozens of instances. Supabase's connection ceiling is reachable with very modest traffic.

**Fix:** Hoist a single module-scope pool, never call `pool.end()` in the handler (let the instance reuse it across warm invocations), and set `max: 1`. Use the Supabase transaction pooler (port 6543) for serverless.

### DB-3 · Three divergent copies of the schema
**`database/init.sql`, `database/init-supabase.sql`, `server/index.js:83-154`**

The same tables are defined in three places, and they have already drifted:

| | `init.sql` | `init-supabase.sql` | `server/index.js` |
|---|---|---|---|
| UUID source | `uuid_generate_v4()` + `uuid-ossp` | `uuid_generate_v4()` + `uuid-ossp` | `gen_random_uuid()`, no extension |
| RLS lockdown | ❌ absent | ✅ present | ✅ present (conditional) |
| `leaderboard` view | ✅ | ✅ + `security_invoker` | ❌ absent |
| Seed data | ✅ | ✅ | ✅ (guarded by count) |

A local Docker database and a Supabase database will not have the same schema.

**Fix:** One numbered migration directory as the single source of truth; generate or delete the rest.

### DB-4 · `ON CONFLICT DO NOTHING` on the seed data is a no-op — ✅ RESOLVED 2026-08-28
**`database/init.sql:57`, `database/init-supabase.sql:54`**

`high_scores` has no unique constraint other than the `SERIAL` primary key, which the insert doesn't supply — so there is nothing for `ON CONFLICT` to conflict on. Re-running either script duplicates all ten sample rows. (Given DB-1, `migrate-supabase.js` never reaches this statement at all — but it will once DB-1 is fixed.)

**Fix:** Add a natural unique key, or guard the insert on `SELECT COUNT(*)` the way `server/index.js:139` already does.

#### Resolution (2026-08-28)

Fixed in **both** copies while resolving DB-1 — leaving one of the two behind would have been the "two of everything" problem this report opens with. Each seed block became:

```sql
INSERT INTO high_scores (player_name, score, survival_time, zombies_killed)
SELECT * FROM (VALUES ...) AS seed(player_name, score, survival_time, zombies_killed)
WHERE NOT EXISTS (SELECT 1 FROM high_scores);
```

Verified by running each file twice against a throwaway `postgres:15` container: `high_scores` holds **10 rows after two runs**, not 20. `database/init.sql` needed its `banana_pajama` database created first, since it still opens with a `\c` that psql cannot satisfy on a bare server — unrelated to this finding, but see DB-3.

### DB-5 · Unbounded table growth and a linear-cost rank query
**`api/highscores.js:67-70`, `server/index.js:234-237`**

Neither `high_scores` nor `game_sessions` has any retention policy. The rank computation is `SELECT COUNT(*) + 1 FROM high_scores WHERE score > $1`, which is an index range scan whose cost grows linearly with the number of scores above the submitted one. It runs on every submission.

**Fix:** Prune to the top N (or add a scheduled cleanup), and consider a materialised rank or an approximate rank for display.

### DATA-1 · ~~Score submission may have been broken for six months~~ → a fifth of the leaderboard is duplicate rows — ✅ RESOLVED 2026-08-28
**`client/src/scenes/NameEntryScene.js:327-400`**

**The original finding was wrong and is retained here as written, then corrected.** It read:

> No high score has been written since 2026-02-15 — score submission may have been broken for six months. 41 rows, nothing written in the six months to 2026-08-28. Two readings: nobody has played, or the write path has been failing silently. The circumstantial evidence favours the second.

It favoured the wrong one. **The write path works.** Tested end to end against production:

```
POST https://banana-pajama.vercel.app/api/highscores
{"success":true,"data":{"id":44,"player_name":"DATA1PROBE","rank":42,...}}
HTTP 201
```

The row landed and was then deleted. `GET /api/health` reports `"database":"connected"`. The six-month gap is the boring explanation: the last commit to this repository is **2026-02-13** and the last score is **2026-02-15**. Development stopped and so did playing. There is no outage.

The lesson is the one from SEC-1, in the other direction: **a suspicious absence of data is not evidence of a broken write path.** One `curl` settled what a paragraph of circumstantial reasoning got backwards.

#### The real defect, found while disproving the above

Grouping the table by `(player_name, score, survival_time, zombies_killed)`:

```
       player_name       | score | copies |           first            |            last
-------------------------+-------+--------+----------------------------+----------------------------
 Arthur Nordlien Johnsen |  4861 |      2 | 2026-02-15 15:14:22.971617 | 2026-02-15 15:14:24.006798
 Arthur Nordlien Johnsen |   861 |      2 | 2025-11-13 13:00:25.177577 | 2025-11-13 13:00:25.916417
 arthur                  |   861 |      2 | 2025-11-11 19:14:47.471424 | 2025-11-11 19:14:48.940317
 arthur                  |   600 |      2 | 2025-11-11 19:13:30.664642 | 2025-11-11 19:13:33.459810
 67                      |   516 |      2 | 2025-11-09 18:08:11.730517 | 2025-11-09 18:08:13.211055
 Kåre Kjelstrøm          |   459 |      2 | 2025-11-06 13:48:32.207448 | 2025-11-06 13:48:34.356213
 yowed                   |   182 |      3 | 2025-11-01 19:18:36.755297 | 2025-11-01 19:18:38.553431
```

**Seven groups, eight redundant rows out of 41 — about a fifth of the leaderboard.** Every duplicate lands within 0.7–2.8 s of its twin, which is human double-click cadence, not a retry loop. It is also user-visible: the current top two entries are the same run listed twice.

**Root cause.** `submitScore()` had no in-flight guard, and the only input it disabled was the Phaser keyboard:

```js
this.input.keyboard.removeAllListeners();   // keyboard only
```

The SUBMIT button is a game object with its own `pointerdown` handler (`NameEntryScene.js:137`). `removeAllListeners()` on the keyboard plugin does not touch it, so the button stayed live for the entire network round-trip. A second click — or ENTER followed by a click — posted the score twice. `skipScore()` was likewise reachable mid-flight.

**Fix applied:**

- An `isSubmitting` guard, reset in `init()` because Phaser reuses the scene instance across rounds (the same hazard as GAME-4 — a stale flag would have locked out every later submission).
- `setButtonsEnabled(false)` during the request: both buttons `disableInteractive()` and dim to 50 % alpha, so the state is visible rather than just enforced.
- The guard is released on the error path, so a genuine failure is still retryable.

**Verified** by driving the real `submitScore()` against a stub scene and counting POSTs:

```
PRE-FIX   POSTs after a double click: 2  ->  FAIL (duplicate row written)
POST-FIX  POSTs after a double click: 1  ->  PASS
```

and a second scenario confirming no lockout: after a failed submit the guard holds and the buttons dim; after the 2 s recovery timer both release; the retry then reaches the network.

**Not done, deliberately:** the eight existing duplicate rows are still in production. Deleting user-visible leaderboard data is the owner's call, not a side effect of a code fix. When wanted:

```sql
DELETE FROM high_scores a USING high_scores b
WHERE a.id > b.id
  AND (a.player_name, a.score, a.survival_time, a.zombies_killed)
    = (b.player_name, b.score, b.survival_time, b.zombies_killed);
```

**Still open and related:** CLIENT-2 — the POST has no timeout. With the guard in place a hung `fetch` now leaves the player stuck on "Saving score…" with the buttons disabled rather than able to double-submit. That is not a regression (the old code was equally stuck, just duplicating), but `AbortSignal.timeout()` is what actually closes it.

### ARCH-2 · The entire session-analytics feature is dead
**`api/sessions.js`, `server/index.js:261-317`, `database/*.sql` (`game_sessions`)**

Grepping the client for network calls turns up exactly three `fetch()` sites, all to `/api/highscores`. **Nothing ever calls `/api/sessions/start` or `/api/sessions/end`.** The endpoints, the table, the indexes, and the validation logic are all unreachable.

`TODO.txt` lists "Game statistics tracking (sessions API)" under COMPLETED ✅, and `CLAUDE.md` documents it as a live feature.

**Fix:** Either wire it up in `GameScene.create()`/`gameOver()` (it would also give SEC-6 a server-side duration to validate against), or delete the endpoints and drop the table.

### ARCH-3 · `Pathfinder.js` is 215 lines of dead code
**`client/src/world/Pathfinder.js`**

Never imported anywhere. The zombies use `getSmartMove()` / `getWallAvoidanceMove()` — a greedy 8-direction probe duplicated across all four zombie classes — not A*.

`CLAUDE.md` claims "A* pathfinding for AI" and "Smart pathfinding with 200ms cooldown".

**Fix:** Delete it, or adopt it and remove the duplicated greedy logic from the four sprite classes.

### ARCH-4 · Four nginx configs; at most one is used
**`nginx/nginx.conf`, `nginx/production.conf`, `client/nginx.conf`, `client/nginx-standalone.conf`, `client/nginx-multicontainer.conf`**

`client/Dockerfile:27` copies `client/nginx.conf`. The other four are unreferenced by any Dockerfile, compose file, or script. `nginx/Dockerfile:18-21` additionally bakes a **self-signed certificate for CN=localhost** into a file named `production.conf`'s cert path — which would fail TLS verification for every visitor if it were ever deployed.

`nginx/production.conf` also re-declares `add_header` inside its `location` blocks, which **discards the inherited server-level headers** (the CSP and HSTS at lines 38-39) for those locations — an nginx footgun.

**Fix:** Keep the one config the build actually uses; delete the rest. If HTTPS termination via nginx is still a real target, use a real certificate.

### CODE-1 · God objects: `GameScene.js` (1 469 lines) and `server/index.js` (352 lines)
**`client/src/scenes/GameScene.js`, `server/index.js`**

`GameScene` owns input handling (desktop and mobile), spawning, collision response, the power-up system, the pause dialog, HUD construction, difficulty scaling, and animation registration. There is no seam at which any of it can be tested.

`server/index.js` holds every route inline, alongside empty scaffolding directories `server/routes/`, `server/models/`, and `server/middleware/` that contain only `.gitkeep` — the intended structure was never adopted.

**Fix:** Extract `SpawnManager`, `PowerUpManager`, `PauseMenu`, and `HUD` from `GameScene`; move routes into `server/routes/` or delete the empty dirs so they stop implying a structure that doesn't exist.

### BUILD-1 · `terser-webpack-plugin` is required but not declared
**`client/webpack.config.js:5`, `client/package.json:17-27`**

`require('terser-webpack-plugin')` resolves only because it is a transitive dependency of `webpack` that npm happens to hoist. A different package manager, a stricter `node-linker`, or a webpack minor bump can break the production build with no code change.

**Fix:** Add it to `devDependencies` explicitly.

---

## P3 — Low

### DOC-1 · `CLAUDE.md` describes a system that no longer exists
The project instructions file is substantially wrong, which matters because it is the first thing any contributor (human or agent) reads:

- Describes AWS ECS Fargate + RDS + ALB + S3/CloudFront as the live deployment. The actual deployment is Vercel + Supabase (`vercel.json`, `VERCEL_SETUP.md`, `docs/SUPABASE_DEPLOYMENT.md`).
- References `AWS_DEPLOYMENT_LEARNINGS.txt` and `infrastructure/aws-setup.md` — **neither file exists**.
- Claims "6 automated deployment scripts" — `scripts/` contains 3.
- Claims "Full test coverage for critical paths" — there are no tests (QA-1).
- Claims A* pathfinding (ARCH-3), sprite pooling and a 50-zombie cap (GAME-1/GAME-2).
- Asset paths are wrong (`assets/zombie-1.png` vs the actual `assets/zombies/zombie-1.png`); asset sizes are off by 10–20× (`banana.png` listed as 587 KB, actually 32 KB; `loading_screen.png` as 2.6 MB, actually `loading_screen.jpg` at 144 KB).
- Lists a "Recent Commits" section referencing commits not in this history.
- States "Sound effects still needed" — they exist (`SoundEffects.js`, ZZFX).

### DOC-2 · Stale root-level debugging documents
`DEBUG_INSTRUCTIONS.md` and `DEBUG_CHECKLIST.md` are transcripts of a since-resolved incident ("This confirms the backend is not deployed"). They are addressed to a specific past problem, contain the leaked credential (SEC-1), and would actively mislead someone debugging today. `SSL_FIX.md`, `VERCEL_ENV_VARIABLES.md`, `VERCEL_SETUP.md`, and `SUPABASE_MIGRATION_PLAN.md` overlap heavily with each other and with `docs/`.

**Fix:** Delete the incident transcripts; consolidate the deployment docs into `docs/`.

### CODE-2 · Unused dependencies
`uuid` and `pg-pool` in `server/package.json` are never imported (`pg-pool` is already a transitive dependency of `pg`). `uuid` also carries an open advisory (DEP-1).

### CODE-3 · Unused configuration
`SESSION_SECRET` is defined in `docker/docker-compose.yml:53`, `docker/.env.example`, and `env.example` but is never read by any code. `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `LOG_LEVEL`, and `ENABLE_ADMINER` in `docker/.env.example` are likewise never read — the rate limit values are hard-coded.

### CODE-4 · Hard-coded default database password
`server/config/database.js:65` falls back to `'banana_dev_password'`; `docker/docker-compose.yml:15,48` uses the same default; `scripts/deploy-local.sh:148` prints it to the console. Fine for local dev, but the fallback is in the production code path — the only guard is a `console.error` at line 57 that does not prevent startup.

### CODE-5 · Empty catch blocks throughout the fullscreen code
`client/src/index.js` has eight `catch (err) { }` / `.catch(err => { })` blocks (lines 104, 196, 214, 217, 262, 633, and others). Failures in orientation locking and fullscreen entry vanish silently, which is exactly why the iOS/Android fullscreen behaviour is listed as a known issue.

### CODE-6 · Error middleware registered before the 404 handler
`server/index.js:320-334`. It functions (Express only routes errors to 4-arity middleware), but it is backwards from convention and means an error thrown inside the 404 handler is unhandled.

### CODE-7 · No graceful shutdown
`server/index.js:340-352` calls `app.listen()` with no `SIGTERM`/`SIGINT` handler and no `pool.end()`. In-flight requests are dropped on every container replacement, and connections are leaked to Postgres until it times them out.

### CODE-8 · No `unhandledRejection` / `uncaughtException` handling
Neither backend installs process-level handlers. Under Node 18+, an unhandled rejection terminates the process.

### CODE-9 · Non-reproducible builds
`client/webpack.config.js:60` injects `new Date().toISOString()` via `DefinePlugin`, so the bundle hash changes on every build regardless of source changes — defeating the content-hash caching the same file sets up at line 12.

### CODE-10 · `Group.getFirstDead()` used where `Group.get()` is the correct API
`GameScene.js:603, 616, 866, 1055`. Beyond GAME-1, `getFirstDead()` skips Phaser's own recycling path and its `maxSize` handling.

### CODE-11 · `killAllZombies()` mutates the collections it is iterating
`GameScene.js:1112-1137` iterates `group.children.entries` (the live backing array) while calling `zombie.die()`, which for three of the four types schedules a `destroy()` that removes entries from that same array. The delay makes it currently harmless, but it is fragile — iterate a copy (`[...group.children.entries]`).

---

## Suggested remediation order

**Today**
1. ~~SEC-1 — rotate the Supabase password.~~ ✅ **Done 2026-08-28.** ~~Delete the file~~ ✅ `f7d5edf`. ~~Add a secret scanner~~ ✅ **Done 2026-08-29.** Still open: the least-privilege database role.
2. DATA-1 — five minutes of manual testing to establish whether high score writes are broken. If they are, this jumps to the top of the list: it is a live outage of the app's only persistent feature.
3. DB-1 — fix the migration script, then verify RLS is actually enabled on `high_scores` in production. Note the SEC-1 rotation does **not** address this; the two are independent.
4. INFRA-1 — make `docker compose` valid again so local development works.

**This week**
5. GAME-1, GAME-2, GAME-3 — the pooling/`maxSize` cluster. These are one coherent fix and they are the game's worst bugs.
6. GAME-4 — state reset between rounds (cheap, and it corrupts submitted stats).
7. SEC-4 — `.dockerignore`.
8. DEP-1 — `npm audit fix` on both packages.

**This cycle**
9. ARCH-1 — pick one backend and delete the other. Everything under P2 gets easier once there is one implementation to reason about.
10. SEC-2, SEC-3, SEC-5, SEC-7 — the security-config cluster; mostly small, and mostly falls out of ARCH-1.
11. QA-1 — eslint config plus a first test suite around the API handlers and the pure game functions. Do this before the P2 refactors, not after.
12. PERF-1, PERF-2, PERF-4 — the three changes that actually move frame rate and API latency.

**Ongoing**
13. The remaining P2 items (schema consolidation, dead-code removal, `GameScene` decomposition).
14. DOC-1 — rewrite `CLAUDE.md` against reality once the above has settled. Doing it earlier means writing it twice.

---

## Appendix: what's genuinely good

Worth preserving through any refactor:

- **Parameterised queries everywhere.** No SQL injection surface anywhere in either backend, including the dynamic-looking paths.
- **Input validation bounds** on score/time/kills, and UUID format validation on session IDs.
- **`api/debug.js` and `/api/init-db` fail closed** — no `ADMIN_KEY` set means a 403, not an open endpoint. That is the right default and it is easy to get backwards.
- **`AudioManager`** is a clean, correct abstraction over Phaser's iOS audio-unlock dance — the one piece of the mobile code that is genuinely well factored.
- **Asset sizes are already well optimised** (the largest PNG is 92 KB; the loading screen is a 144 KB JPEG). The bundle-size concern in `TODO.txt` is stale — the remaining weight is the two 3 MB MP3s.
- **Webpack config** does the right things: content hashing, a separate Phaser vendor chunk, Terser with `drop_console`.
- **`database/supabase-rls.sql`** is careful, correct, and well commented — it just isn't reliably applied (DB-1).
