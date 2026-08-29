/**
 * Handler tests for the live high score endpoint.
 *
 * The database is mocked at the ./lib/db boundary, so these exercise the
 * validation and response shaping without needing Postgres. They are the
 * guard rail for SEC-6: submission is unauthenticated, so these bounds are
 * the only thing standing between the leaderboard and arbitrary input.
 */

jest.mock('../lib/db');

const { getPool } = require('../lib/db');
const handler = require('../highscores');

function mockRes() {
    return {
        headers: {},
        statusCode: null,
        body: null,
        setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
        end() { return this; },
    };
}

function mockReq(overrides = {}) {
    return {
        method: 'POST',
        url: '/api/highscores',
        query: {},
        headers: { origin: 'https://banana-pajama.vercel.app' },
        body: {},
        ...overrides,
    };
}

/** A valid submission; individual tests override one field to make it invalid. */
const VALID_BODY = {
    player_name: 'Kaare',
    score: 500,
    survival_time: 60,
    zombies_killed: 40,
};

// The handlers log to console.error on their failure paths by design; keep it
// out of the test output so a real unexpected error still stands out.
let errorSpy;
beforeAll(() => { errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterAll(() => errorSpy.mockRestore());

let pool;

beforeEach(() => {
    jest.clearAllMocks();
    pool = {
        query: jest.fn(),
        end: jest.fn().mockResolvedValue(undefined),
    };
    getPool.mockReturnValue(pool);
});

describe('GET /api/highscores', () => {
    it('returns rows with a count', async () => {
        const rows = [{ player_name: 'Kaare', score: 500 }];
        pool.query.mockResolvedValueOnce({ rows });

        const res = mockRes();
        await handler(mockReq({ method: 'GET' }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ success: true, data: rows, count: 1 });
    });

    it('defaults to a limit of 10', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        await handler(mockReq({ method: 'GET' }), mockRes());
        expect(pool.query).toHaveBeenCalledWith(expect.any(String), [10]);
    });

    it('clamps an oversized limit to 50 so a caller cannot dump the table', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        await handler(mockReq({ method: 'GET', query: { limit: '100000' } }), mockRes());
        expect(pool.query).toHaveBeenCalledWith(expect.any(String), [50]);
    });

    it('falls back to 10 for a non-numeric limit', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        await handler(mockReq({ method: 'GET', query: { limit: '; DROP TABLE high_scores' } }), mockRes());
        expect(pool.query).toHaveBeenCalledWith(expect.any(String), [10]);
    });
});

describe('POST /api/highscores — accepted', () => {
    beforeEach(() => {
        pool.query
            .mockResolvedValueOnce({ rows: [{ id: 42, created_at: '2026-08-29T00:00:00.000Z' }] })
            .mockResolvedValueOnce({ rows: [{ rank: '3' }] });
    });

    it('inserts and returns 201 with the computed rank', async () => {
        const res = mockRes();
        await handler(mockReq({ body: { ...VALID_BODY } }), res);

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({ id: 42, player_name: 'Kaare', score: 500, rank: 3 });
    });

    it('stores the sanitised name, not the raw input', async () => {
        await handler(mockReq({ body: { ...VALID_BODY, player_name: '<b>Kaare</b>' } }), mockRes());

        // The blocklist includes '/', so the closing tag collapses to 'b' too.
        const [, params] = pool.query.mock.calls[0];
        expect(params[0]).toBe('bKaareb');
    });

    it('treats a missing zombies_killed as zero', async () => {
        const body = { ...VALID_BODY };
        delete body.zombies_killed;

        await handler(mockReq({ body }), mockRes());

        const [, params] = pool.query.mock.calls[0];
        expect(params[3]).toBe(0);
    });
});

describe('POST /api/highscores — rejected', () => {
    it.each([
        ['a missing player_name', { player_name: undefined }],
        ['a non-numeric score', { score: '500' }],
        ['a non-numeric survival_time', { survival_time: null }],
        ['a negative score', { score: -1 }],
        ['a score above the 50000 ceiling', { score: 50001 }],
        ['an infinite score', { score: Infinity }],
        ['a NaN score', { score: NaN }],
        ['a negative survival_time', { survival_time: -1 }],
        ['a survival_time above the 2-hour ceiling', { survival_time: 7201 }],
        ['a negative zombies_killed', { zombies_killed: -1 }],
        ['zombies_killed above the ceiling', { zombies_killed: 10001 }],
    ])('rejects %s with 400 and never touches the database', async (_label, override) => {
        const res = mockRes();
        await handler(mockReq({ body: { ...VALID_BODY, ...override } }), res);

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(pool.query).not.toHaveBeenCalled();
    });

    // A name made entirely of blocked characters survives the presence check
    // but sanitises down to nothing. Without the explicit re-check in the
    // handler this would write an empty player_name to the leaderboard.
    it('rejects a name that sanitises to an empty string', async () => {
        const res = mockRes();
        await handler(mockReq({ body: { ...VALID_BODY, player_name: '<<<>>>' } }), res);

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/empty/i);
        expect(pool.query).not.toHaveBeenCalled();
    });
});

describe('other methods and failures', () => {
    it('rejects an unsupported method with 405', async () => {
        const res = mockRes();
        await handler(mockReq({ method: 'DELETE' }), res);
        expect(res.statusCode).toBe(405);
    });

    it('answers a CORS preflight without hitting the database', async () => {
        const res = mockRes();
        await handler(mockReq({ method: 'OPTIONS' }), res);

        expect(res.statusCode).toBe(200);
        expect(getPool).not.toHaveBeenCalled();
    });

    it('returns a generic 500 that does not leak the database error', async () => {
        pool.query.mockRejectedValueOnce(new Error('password authentication failed for user "postgres"'));

        const res = mockRes();
        await handler(mockReq({ method: 'GET' }), res);

        expect(res.statusCode).toBe(500);
        expect(JSON.stringify(res.body)).not.toMatch(/password|postgres/i);
    });

    it('releases the pool even when the query throws', async () => {
        pool.query.mockRejectedValueOnce(new Error('boom'));
        await handler(mockReq({ method: 'GET' }), mockRes());
        expect(pool.end).toHaveBeenCalled();
    });
});
