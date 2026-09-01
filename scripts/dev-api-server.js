#!/usr/bin/env node
/**
 * Local development API server.
 *
 * ARCH-1: this repository used to carry two complete backends -- an Express app
 * in server/ and the Vercel functions in api/ -- and which one answered a given
 * request depended on Vercel's filesystem-routing-before-rewrites behaviour,
 * documented nowhere. The Express app is gone. Production runs the functions in
 * api/, and so does this.
 *
 * This is an ADAPTER, not a second implementation. It contains no route logic:
 * it maps a URL to one of the same api/*.js handler modules Vercel invokes, and
 * supplies the small amount of request/response sugar the Vercel runtime adds on
 * top of Node's http (req.query, req.body, res.status().json()). If a handler
 * changes, this picks the change up for free -- there is nothing here to drift.
 *
 * Used by docker/api.Dockerfile for the local stack. Not deployed: it lives in
 * scripts/ precisely so Vercel does not treat it as a serverless function.
 */

const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Mirrors Vercel's routing for this project: a file per endpoint, plus the
// sessions subpath rewrite declared in vercel.json.
const ROUTES = [
    [/^\/api\/health\/?$/, '../api/health.js'],
    [/^\/api\/highscores\/?$/, '../api/highscores.js'],
    [/^\/api\/sessions(\/.*)?$/, '../api/sessions.js'],
];

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('error', reject);
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            if (!raw) return resolve(undefined);
            const type = req.headers['content-type'] || '';
            if (!type.includes('application/json')) return resolve(raw);
            try {
                resolve(JSON.parse(raw));
            } catch {
                // Vercel yields undefined for an unparseable JSON body rather
                // than throwing; the handlers all guard with `|| {}`.
                resolve(undefined);
            }
        });
    });
}

/** The exact surface api/*.js and api/lib/middleware.js rely on. */
function enhance(req, res, url) {
    req.query = Object.fromEntries(url.searchParams.entries());
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (payload) => {
        if (!res.hasHeader('Content-Type')) {
            res.setHeader('Content-Type', 'application/json');
        }
        res.end(JSON.stringify(payload));
        return res;
    };
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    // Container healthcheck. Deliberately not an api/ route: it must answer
    // even when the database is unreachable, which /api/health does not.
    if (url.pathname === '/health') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'OK', service: 'dev-api-server' }));
        return;
    }

    const match = ROUTES.find(([pattern]) => pattern.test(url.pathname));
    if (!match) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Not found', path: url.pathname }));
        return;
    }

    try {
        req.body = await readBody(req);
        enhance(req, res, url);
        const handler = require(path.join(__dirname, match[1]));
        await handler(req, res);
    } catch (error) {
        console.error(`[dev-api] ${req.method} ${url.pathname} failed:`, error.message);
        if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }
});

server.listen(PORT, () => {
    console.log(`[dev-api] serving api/ handlers on http://localhost:${PORT}`);
    console.log('[dev-api] routes: /api/health, /api/highscores, /api/sessions/{start,end}');
});

// CODE-7 in the review notes the old server had no graceful shutdown. Cheap here.
for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => server.close(() => process.exit(0)));
}
