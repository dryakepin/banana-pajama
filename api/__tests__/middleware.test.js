/**
 * Unit tests for the shared serverless middleware helpers.
 *
 * These are the pure pieces of the live production API, so they need no
 * database and no mocking. jest.resetModules() matters for the rate limiter:
 * its counter Map is module-level state that would otherwise leak between
 * tests and make ordering significant.
 */

const {
    setCorsHeaders,
    handleOptions,
    isValidUUID,
    sanitizePlayerName,
} = require('../lib/middleware');

function mockRes() {
    const res = {
        headers: {},
        statusCode: null,
        body: null,
        ended: false,
        setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
        end() { this.ended = true; return this; },
    };
    return res;
}

describe('sanitizePlayerName', () => {
    it('strips the characters that would otherwise land in an HTML context', () => {
        expect(sanitizePlayerName('<script>alert(1)</script>')).toBe('scriptalert(1)script');
    });

    it('removes every character in the blocklist', () => {
        expect(sanitizePlayerName(`a<b>c&d"e'f/g\\h`)).toBe('abcdefgh');
    });

    it('trims surrounding whitespace', () => {
        expect(sanitizePlayerName('   Kaare   ')).toBe('Kaare');
    });

    it('truncates to 50 characters', () => {
        expect(sanitizePlayerName('x'.repeat(80))).toHaveLength(50);
    });

    // Truncation happens before stripping, so a name of exactly 50 characters
    // that contains blocked characters comes back SHORTER than 50. This is the
    // documented behaviour, not a bug -- but it is the reason the handler has
    // to re-check for an empty result after sanitising.
    it('can return an empty string, which callers must handle', () => {
        expect(sanitizePlayerName('<<<>>>')).toBe('');
        expect(sanitizePlayerName('   ')).toBe('');
    });

    it('coerces non-string input rather than throwing', () => {
        expect(sanitizePlayerName(12345)).toBe('12345');
    });
});

describe('isValidUUID', () => {
    it('accepts a canonical v4 UUID', () => {
        expect(isValidUUID('9f8e7d6c-5b4a-4392-8281-70605f4e3d2c')).toBe(true);
    });

    it('is case insensitive', () => {
        expect(isValidUUID('9F8E7D6C-5B4A-4392-8281-70605F4E3D2C')).toBe(true);
    });

    it.each([
        ['empty', ''],
        ['not a uuid', 'definitely-not-a-uuid'],
        ['wrong separators', '9f8e7d6c5b4a4392828170605f4e3d2c'],
        ['too short', '9f8e7d6c-5b4a-4392-8281-70605f4e3d2'],
        ['sql fragment', "' OR 1=1 --"],
    ])('rejects %s', (_label, value) => {
        expect(isValidUUID(value)).toBe(false);
    });
});

describe('setCorsHeaders', () => {
    it('echoes an allowed origin back', () => {
        const res = mockRes();
        setCorsHeaders({ headers: { origin: 'https://banana-pajama.vercel.app' } }, res);
        expect(res.headers['Access-Control-Allow-Origin']).toBe('https://banana-pajama.vercel.app');
    });

    it('does NOT set the allow-origin header for an unknown origin', () => {
        const res = mockRes();
        setCorsHeaders({ headers: { origin: 'https://evil.example.com' } }, res);
        expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('always sets the methods and headers allowances', () => {
        const res = mockRes();
        setCorsHeaders({ headers: {} }, res);
        expect(res.headers['Access-Control-Allow-Methods']).toBe('GET,POST,OPTIONS');
        expect(res.headers['Access-Control-Allow-Headers']).toBe('Content-Type');
    });
});

describe('handleOptions', () => {
    it('short-circuits a preflight request with 200 and reports it handled', () => {
        const res = mockRes();
        expect(handleOptions({ method: 'OPTIONS', headers: {} }, res)).toBe(true);
        expect(res.statusCode).toBe(200);
        expect(res.ended).toBe(true);
    });

    it('leaves non-preflight requests alone', () => {
        const res = mockRes();
        expect(handleOptions({ method: 'POST', headers: {} }, res)).toBe(false);
        expect(res.statusCode).toBeNull();
    });
});

describe('checkRateLimit', () => {
    let checkRateLimit;

    beforeEach(() => {
        // The limiter keeps its counters in module scope, so each test needs a
        // fresh copy of the module or the 100-request budget carries over.
        jest.resetModules();
        ({ checkRateLimit } = require('../lib/middleware'));
    });

    it('allows requests up to the limit', () => {
        const req = { headers: { 'x-forwarded-for': '203.0.113.1' } };
        for (let i = 0; i < 100; i++) {
            expect(checkRateLimit(req, mockRes())).toBe(true);
        }
    });

    it('rejects the 101st request with 429', () => {
        const req = { headers: { 'x-forwarded-for': '203.0.113.2' } };
        for (let i = 0; i < 100; i++) checkRateLimit(req, mockRes());

        const res = mockRes();
        expect(checkRateLimit(req, res)).toBe(false);
        expect(res.statusCode).toBe(429);
    });

    it('counts each client address separately', () => {
        const busy = { headers: { 'x-forwarded-for': '203.0.113.3' } };
        for (let i = 0; i < 100; i++) checkRateLimit(busy, mockRes());
        expect(checkRateLimit(busy, mockRes())).toBe(false);

        const fresh = { headers: { 'x-forwarded-for': '203.0.113.4' } };
        expect(checkRateLimit(fresh, mockRes())).toBe(true);
    });

    // Documents SEC-5: with no forwarding header every caller collapses into a
    // single 'unknown' bucket, so one noisy client can exhaust the budget for
    // everyone. Asserting it keeps the behaviour visible until SEC-5 is fixed.
    it('buckets all header-less callers together as "unknown"', () => {
        const anon = { headers: {} };
        for (let i = 0; i < 100; i++) checkRateLimit(anon, mockRes());
        expect(checkRateLimit({ headers: {} }, mockRes())).toBe(false);
    });
});
