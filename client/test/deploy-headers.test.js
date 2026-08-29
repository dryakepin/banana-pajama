/**
 * SEC-2 / SEC-7 -- the response headers vercel.json ships.
 *
 * These are config assertions rather than behaviour, and normally that would be
 * a weak test. It is here because getting this wrong is silent and total: the
 * CSP originally recommended for this repo (ported verbatim from
 * nginx/production.conf) blocked `blob:` in img-src, and Phaser decodes every
 * texture through a blob URL. Under it the loader reported 100% complete while
 * all 59 images were blocked -- a running game with nothing visible, and no
 * error anywhere. Verified in a browser, which is the only way it shows up.
 */

const path = require('path');
const fs = require('fs');

const config = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', 'vercel.json'), 'utf8'));

function headersFor(source) {
    const block = config.headers.find(h => h.source === source);
    if (!block) return null;
    return Object.fromEntries(block.headers.map(h => [h.key, h.value]));
}

describe('SEC-7: security headers on every response', () => {
    const global = headersFor('/(.*)');

    it('sets a header block covering all routes', () => {
        expect(global).not.toBeNull();
    });

    it.each([
        ['Content-Security-Policy'],
        ['X-Content-Type-Options'],
        ['X-Frame-Options'],
        ['Referrer-Policy'],
    ])('sets %s', (key) => {
        expect(global[key]).toBeTruthy();
    });

    describe('the CSP has to let the game actually load', () => {
        const csp = Object.fromEntries(
            headersFor('/(.*)')['Content-Security-Policy']
                .split(';').map(d => d.trim()).filter(Boolean)
                .map(d => { const [name, ...rest] = d.split(/\s+/); return [name, rest]; }));

        // The one that bit us. Phaser's image loader fetches each texture as a
        // blob and hands URL.createObjectURL() to an Image element.
        it('allows blob: images, or every texture silently fails to decode', () => {
            expect(csp['img-src']).toContain('blob:');
        });

        it('allows the inline <style> block in index.html', () => {
            expect(csp['style-src']).toContain("'unsafe-inline'");
        });

        it('allows the PWA manifest referenced by index.html', () => {
            expect(csp['manifest-src']).toContain("'self'");
        });

        // All three scenes fetch relative /api/ paths, so same-origin is enough.
        it('allows same-origin fetches for the leaderboard', () => {
            expect(csp['connect-src']).toContain("'self'");
        });

        it('still denies the dangerous sinks', () => {
            expect(csp['object-src']).toContain("'none'");
            expect(csp['frame-src']).toContain("'none'");
        });
    });
});

describe('SEC-2: CORS is owned by the handlers, not the platform', () => {
    it('declares no Access-Control headers anywhere in vercel.json', () => {
        const declared = config.headers
            .flatMap(block => block.headers.map(h => h.key))
            .filter(key => key.toLowerCase().startsWith('access-control'));
        // A wildcard here overrode the origin allowlist in api/lib/middleware.js
        // and could emit a duplicate Allow-Origin, which browsers reject.
        expect(declared).toEqual([]);
    });
});
