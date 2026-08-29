/**
 * Handler tests for the session analytics endpoint.
 *
 * Note that this feature is dead in the shipped client (see ARCH-2 in
 * CODEBASE_REVIEW.md) -- nothing calls it. The handler is still deployed and
 * publicly reachable, though, so its input handling is worth pinning down;
 * these tests describe what it does today rather than endorsing that it should
 * keep existing.
 */

jest.mock('../lib/db');

const { getPool } = require('../lib/db');
const handler = require('../sessions');

const VALID_UUID = '9f8e7d6c-5b4a-4392-8281-70605f4e3d2c';

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
        url: '/api/sessions/start',
        query: {},
        headers: { origin: 'https://banana-pajama.vercel.app' },
        body: {},
        ...overrides,
    };
}

// The handlers log to console.error on their failure paths by design; keep it
// out of the test output so a real unexpected error still stands out.
let errorSpy;
beforeAll(() => { errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterAll(() => errorSpy.mockRestore());

let pool;

beforeEach(() => {
    jest.clearAllMocks();
    pool = {
        query: jest.fn().mockResolvedValue({ rows: [{ session_id: VALID_UUID }] }),
        end: jest.fn().mockResolvedValue(undefined),
    };
    getPool.mockReturnValue(pool);
});

describe('POST /api/sessions/start', () => {
    it('creates a session and returns its id', async () => {
        const res = mockRes();
        await handler(mockReq({ body: { player_name: 'Kaare' } }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ success: true, session_id: VALID_UUID });
    });

    it('falls back to Anonymous when no name is supplied', async () => {
        await handler(mockReq({ body: {} }), mockRes());
        expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['Anonymous']);
    });

    it('tolerates a completely absent body', async () => {
        const res = mockRes();
        await handler(mockReq({ body: undefined }), res);
        expect(res.statusCode).toBe(200);
    });
});

describe('POST /api/sessions/end', () => {
    const endReq = (body) => mockReq({ url: '/api/sessions/end', body });

    it('updates the session and returns success', async () => {
        const res = mockRes();
        await handler(endReq({ session_id: VALID_UUID, final_score: 500 }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ success: true });
    });

    it('requires a session_id', async () => {
        const res = mockRes();
        await handler(endReq({ final_score: 500 }), res);

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/required/i);
        expect(pool.query).not.toHaveBeenCalled();
    });

    it('rejects a malformed session_id before it reaches the query', async () => {
        const res = mockRes();
        await handler(endReq({ session_id: "' OR 1=1 --" }), res);

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/format/i);
        expect(pool.query).not.toHaveBeenCalled();
    });
});

describe('routing and failures', () => {
    it('rejects a non-POST method with 405 before opening a pool', async () => {
        const res = mockRes();
        await handler(mockReq({ method: 'GET' }), res);

        expect(res.statusCode).toBe(405);
        expect(getPool).not.toHaveBeenCalled();
    });

    it('returns 404 for an unrecognised sub-path', async () => {
        const res = mockRes();
        await handler(mockReq({ url: '/api/sessions/teleport' }), res);
        expect(res.statusCode).toBe(404);
    });

    it('returns a generic 500 that does not leak the database error', async () => {
        pool.query.mockRejectedValueOnce(new Error('connection to server at "aws-1-eu-west-1" failed'));

        const res = mockRes();
        await handler(mockReq({ body: {} }), res);

        expect(res.statusCode).toBe(500);
        expect(JSON.stringify(res.body)).not.toMatch(/aws|connection to server/i);
    });
});
