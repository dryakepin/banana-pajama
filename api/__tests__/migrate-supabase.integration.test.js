/**
 * Integration tests for scripts/migrate-supabase.js (DB-1 regression).
 *
 * The original runner split the schema file on ';' and discarded any fragment
 * beginning with '--'. Because splitting on ';' leaves each statement prefixed
 * by its preceding comment block, most of the schema was thrown away: against a
 * genuinely empty database only 1 of 16 statements ran, 7 errored, and the
 * script still printed "Migration completed" and exited 0. Critically, the
 * dropped statements included `ALTER TABLE high_scores ENABLE ROW LEVEL
 * SECURITY`.
 *
 * These live in server/ because it is the only workspace with all three of pg,
 * dotenv and jest -- the migration script needs the first two. They do NOT test
 * the Express backend.
 *
 * Requires a throwaway PostgreSQL and is skipped unless TEST_DATABASE_URL is
 * set, so the default `npm test` never depends on Docker:
 *
 *   docker run -d --name bp-test -e POSTGRES_PASSWORD=testpw -p 55433:5432 postgres:15
 *   TEST_DATABASE_URL="postgresql://postgres:testpw@localhost:55433/postgres?sslmode=disable" npm test
 */

const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const REPO_ROOT = path.join(__dirname, '..', '..');
const MIGRATE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'migrate-supabase.js');

const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

/** Runs the migration script; returns its exit code and combined output. */
function runMigration(databaseUrl = TEST_DATABASE_URL) {
    try {
        const stdout = execFileSync('node', [MIGRATE_SCRIPT], {
            env: { ...process.env, DATABASE_URL: databaseUrl, NODE_PATH: path.join(REPO_ROOT, 'api', 'node_modules') },
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        return { code: 0, output: stdout };
    } catch (error) {
        return { code: error.status, output: `${error.stdout || ''}${error.stderr || ''}` };
    }
}

async function withClient(fn) {
    const client = new Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();
    try {
        return await fn(client);
    } finally {
        await client.end();
    }
}

/** Drops and recreates public, plus the Supabase roles the schema REVOKEs from. */
async function resetDatabase() {
    await withClient(async (client) => {
        await client.query('DROP SCHEMA IF EXISTS public CASCADE');
        await client.query('CREATE SCHEMA public');
        for (const role of ['anon', 'authenticated']) {
            await client.query(`DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
                    CREATE ROLE ${role} NOLOGIN;
                END IF;
            END $$;`);
        }
    });
}

describeIfDb('migrate-supabase.js', () => {
    jest.setTimeout(60000);

    beforeEach(resetDatabase);

    describe('applying to a fresh database', () => {
        beforeEach(() => {
            const { code } = runMigration();
            expect(code).toBe(0);
        });

        it('creates both tables and the leaderboard view', async () => {
            const { rows } = await withClient((c) => c.query(
                `SELECT relname, relkind FROM pg_class
                 WHERE relname IN ('high_scores','game_sessions','leaderboard')
                 ORDER BY relname`
            ));
            expect(rows).toEqual([
                { relname: 'game_sessions', relkind: 'r' },
                { relname: 'high_scores', relkind: 'r' },
                { relname: 'leaderboard', relkind: 'v' },
            ]);
        });

        // The statement the old splitter dropped. This is the whole point.
        it('enables row level security on BOTH tables', async () => {
            const { rows } = await withClient((c) => c.query(
                `SELECT relname, relrowsecurity FROM pg_class
                 WHERE relname IN ('high_scores','game_sessions') ORDER BY relname`
            ));
            expect(rows).toEqual([
                { relname: 'game_sessions', relrowsecurity: true },
                { relname: 'high_scores', relrowsecurity: true },
            ]);
        });

        it('marks the leaderboard view security_invoker so it cannot leak past RLS', async () => {
            const { rows } = await withClient((c) => c.query(
                `SELECT reloptions FROM pg_class WHERE relname = 'leaderboard'`
            ));
            expect(rows[0].reloptions).toContain('security_invoker=on');
        });

        it('leaves anon and authenticated with no table privileges', async () => {
            const { rows } = await withClient((c) => c.query(
                `SELECT count(*)::int AS grants FROM information_schema.role_table_grants
                 WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')`
            ));
            expect(rows[0].grants).toBe(0);
        });

        it('creates the performance indexes', async () => {
            const { rows } = await withClient((c) => c.query(
                `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname`
            ));
            const names = rows.map((r) => r.indexname);
            expect(names).toEqual(expect.arrayContaining([
                'idx_high_scores_score',
                'idx_high_scores_created_at',
                'idx_game_sessions_session_id',
                'idx_game_sessions_created_at',
            ]));
        });

        it('seeds exactly ten rows', async () => {
            const { rows } = await withClient((c) => c.query('SELECT count(*)::int AS n FROM high_scores'));
            expect(rows[0].n).toBe(10);
        });
    });

    describe('re-running', () => {
        // DB-4: the seed's old ON CONFLICT DO NOTHING was a no-op because
        // high_scores has no unique constraint, so a second run appended the
        // ten seed rows again.
        it('is idempotent and does not duplicate the seed data', async () => {
            expect(runMigration().code).toBe(0);
            expect(runMigration().code).toBe(0);

            const { rows } = await withClient((c) => c.query('SELECT count(*)::int AS n FROM high_scores'));
            expect(rows[0].n).toBe(10);
        });

        it('preserves rows written between runs', async () => {
            runMigration();
            await withClient((c) => c.query(
                `INSERT INTO high_scores (player_name, score, survival_time, zombies_killed)
                 VALUES ('RealPlayer', 4861, 141, 138)`
            ));

            expect(runMigration().code).toBe(0);

            const { rows } = await withClient((c) => c.query(
                `SELECT count(*)::int AS n FROM high_scores WHERE player_name = 'RealPlayer'`
            ));
            expect(rows[0].n).toBe(1);
        });
    });

    describe('failure handling', () => {
        it('exits non-zero and rolls back when a statement fails', async () => {
            // Removing the anon role makes the REVOKE statements fail partway
            // through, after the CREATE TABLEs have already run.
            await withClient((c) => c.query('DROP ROLE IF EXISTS anon'));

            const { code, output } = runMigration();

            expect(code).toBe(1);
            expect(output).toMatch(/rolled back/i);

            // Nothing survived: the transaction took the tables with it.
            const { rows } = await withClient((c) => c.query(
                `SELECT count(*)::int AS n FROM pg_class WHERE relname = 'high_scores'`
            ));
            expect(rows[0].n).toBe(0);
        });

        it('exits non-zero when it cannot connect at all', () => {
            const { code } = runMigration('postgresql://postgres:wrong@localhost:1/nope?sslmode=disable');
            expect(code).not.toBe(0);
        });
    });
});

// Without a database this file would otherwise report zero tests and jest
// treats an empty suite as a failure.
describe('migrate-supabase.js harness', () => {
    it(TEST_DATABASE_URL ? 'runs against TEST_DATABASE_URL' : 'is skipped without TEST_DATABASE_URL', () => {
        expect(true).toBe(true);
    });
});
