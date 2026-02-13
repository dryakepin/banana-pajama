/**
 * Vercel Serverless Function: Debug Connection Info
 * Protected - requires ADMIN_KEY header in production
 */

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // Require admin key
    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey || req.headers['x-admin-key'] !== adminKey) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    try {
        const envVars = {
            DATABASE_URL: !!process.env.DATABASE_URL,
            POSTGRES_URL: !!process.env.POSTGRES_URL,
            POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
        };

        res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: {
                nodeVersion: process.version,
                vercelRegion: process.env.VERCEL_REGION || 'unknown',
            },
            envVariablesFound: envVars,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Debug failed' });
    }
};
