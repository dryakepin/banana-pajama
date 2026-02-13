/**
 * Shared middleware helpers for Vercel serverless functions.
 */

const ALLOWED_ORIGINS = [
    'https://banana-pajama.vercel.app',
    'http://localhost:8080',
    'http://localhost:3000',
];

function setCorsHeaders(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function handleOptions(req, res) {
    if (req.method === 'OPTIONS') {
        setCorsHeaders(req, res);
        res.status(200).end();
        return true;
    }
    return false;
}

// Simple in-memory rate limiter for serverless (per-instance, best-effort)
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100;

function checkRateLimit(req, res) {
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const now = Date.now();

    let entry = requestCounts.get(ip);
    if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
        entry = { start: now, count: 0 };
        requestCounts.set(ip, entry);
    }

    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
        res.status(429).json({ error: 'Too many requests' });
        return false;
    }

    // Cleanup old entries periodically
    if (requestCounts.size > 1000) {
        for (const [key, val] of requestCounts) {
            if (now - val.start > RATE_LIMIT_WINDOW) requestCounts.delete(key);
        }
    }

    return true;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(str) {
    return UUID_REGEX.test(str);
}

function sanitizePlayerName(name) {
    return name.toString().trim().substring(0, 50).replace(/[<>&"'/\\]/g, '');
}

module.exports = {
    setCorsHeaders,
    handleOptions,
    checkRateLimit,
    isValidUUID,
    sanitizePlayerName,
};
