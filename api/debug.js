/**
 * Vercel Serverless Function: Debug Connection Info
 * Route: /api/debug
 *
 * This endpoint shows connection configuration WITHOUT exposing passwords
 */

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        // Check which environment variables are available
        const envVars = {
            DATABASE_URL: !!process.env.DATABASE_URL,
            POSTGRES_URL: !!process.env.POSTGRES_URL,
            POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
            SUPABASE_URL: !!process.env.SUPABASE_URL,
        };

        // Get the actual connection string being used (without password)
        const connectionString = process.env.DATABASE_URL ||
                                process.env.POSTGRES_URL ||
                                process.env.POSTGRES_PRISMA_URL;

        let connectionInfo = {};
        if (connectionString) {
            // Parse connection string to show info WITHOUT password
            const urlPattern = /^(postgres(?:ql)?):\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?$/;
            const match = connectionString.match(urlPattern);

            if (match) {
                const [_, protocol, username, password, host, port, database, queryParams] = match;

                connectionInfo = {
                    protocol: protocol,
                    username: username,
                    passwordLength: password ? password.length : 0,
                    passwordSet: !!password,
                    host: host,
                    port: port,
                    database: database,
                    queryParams: queryParams || 'none',
                    isPooler: host.includes('pooler'),
                    isSupabase: host.includes('supabase.co'),
                    connectionStringFormat: connectionString.substring(0, 30) + '...',
                };
            } else {
                connectionInfo = {
                    error: 'Could not parse connection string',
                    format: connectionString.substring(0, 30) + '...',
                };
            }
        } else {
            connectionInfo = { error: 'No connection string found' };
        }

        // Check Node.js version and pg module
        const nodeVersion = process.version;
        const pgVersion = require('pg/package.json').version;

        res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: {
                nodeVersion,
                pgVersion,
                vercelRegion: process.env.VERCEL_REGION || 'unknown',
            },
            envVariablesFound: envVars,
            connectionInfo: connectionInfo,
            sslConfig: {
                rejectUnauthorized: false,
                note: 'Using rejectUnauthorized: false for Supabase'
            },
            recommendations: getRecommendations(connectionInfo)
        });

    } catch (error) {
        console.error('Debug endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Debug failed',
            details: error.message
        });
    }
};

function getRecommendations(info) {
    const recommendations = [];

    if (info.protocol === 'postgres') {
        recommendations.push('⚠️ Connection string uses "postgres://" - will be normalized to "postgresql://"');
    }

    if (info.port === '6543') {
        recommendations.push('✅ Using Supabase connection pooler (port 6543)');
        if (!info.queryParams || !info.queryParams.includes('pgbouncer')) {
            recommendations.push('💡 Consider adding "?pgbouncer=true" for transaction pooling');
        }
    } else if (info.port === '5432') {
        recommendations.push('✅ Using direct PostgreSQL connection (port 5432)');
    }

    if (info.queryParams && info.queryParams.includes('sslmode=require')) {
        recommendations.push('✅ SSL mode is set to "require"');
    } else {
        recommendations.push('⚠️ No sslmode parameter found - should add "?sslmode=require"');
    }

    if (info.isPooler && info.isSupabase) {
        recommendations.push('✅ Detected Supabase pooler configuration');
    }

    if (!info.passwordSet) {
        recommendations.push('❌ Password not found in connection string!');
    }

    return recommendations;
}
