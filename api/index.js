/**
 * Catch-all for /api/* paths with no matching handler file.
 *
 * ARCH-1: this file used to be `module.exports = require('../server/index.js')`
 * -- a shim that mounted an entire second backend, an Express app duplicating
 * every endpoint in this directory. Vercel checks the filesystem before applying
 * rewrites, so /api/highscores reached the function here while /api/sessions/start
 * fell through this shim into Express. Two implementations with different CORS,
 * rate limiting and pooling, and nothing in the repo said which served what.
 *
 * The Express app is deleted. This returns a JSON 404 so an unknown /api path
 * still gets an API-shaped response rather than falling through to the SPA
 * rewrite and being handed index.html.
 */

const { setCorsHeaders, handleOptions } = require('./lib/middleware');

module.exports = async (req, res) => {
    setCorsHeaders(req, res);
    if (handleOptions(req, res)) return;

    res.status(404).json({
        error: 'Not found',
        message: 'The requested resource was not found',
    });
};
