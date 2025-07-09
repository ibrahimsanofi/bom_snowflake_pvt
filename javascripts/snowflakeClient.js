// ===== FIXED SNOWFLAKE CLIENT =====

const snowflake = require('snowflake-sdk');

// Classic Snowflake connection config from .env (automatic, legacy mode)
function getSnowflakeConfig() {
    return {
        account: process.env.ACCOUNT,
        username: process.env.USER,
        role: process.env.ROLE,
        authenticator: 'externalbrowser',
        warehouse: process.env.WAREHOUSE,
        database: process.env.DATABASE,
        schema: process.env.SCHEMA
    };
}

// Connection pool
let snowflakeConnection = null;
let cachedConnection = null;

/**
 * Initialize Snowflake connection with SSO (externalbrowser)
 * Accepts user credentials from parameters (not .env)
 * @param {Object} userConfig - { account, username, role, warehouse, database, schema }
 */
async function connectToSnowflake() {
    if (cachedConnection) {
        return Promise.resolve(cachedConnection);
    }
    if (snowflakeConnection) {
        return snowflakeConnection;
    }
    const snowflakeConfig = getSnowflakeConfig();
    snowflakeConnection = new Promise((resolve, reject) => {
        const connection = snowflake.createConnection(snowflakeConfig);
        connection.connectAsync()
            .then(conn => {
                console.log('✅ Connected to Snowflake successfully via SSO (async)');
                cachedConnection = conn;
                snowflakeConnection = null;
                resolve(conn);
            })
            .catch(err => {
                snowflakeConnection = null;
                reject(new Error('❌ Snowflake connection failed: ' + err.message));
            });
    });
    return snowflakeConnection;
}

/**
 * Execute Snowflake query with parameters
 * @param {string} sql - SQL query with ? placeholders
 * @param {Array} params - Parameters to bind to the query
 * @returns {Promise<Array>} - Query results
 */
async function executeSnowflakeQuery(sql, params = []) {
    console.log('⏳ Executing Snowflake Query:', sql);
    console.log('📊 Parameters:', params);
    try {
        const connection = await connectToSnowflake();
        return new Promise((resolve, reject) => {
            const statement = connection.execute({
                sqlText: sql,
                binds: params,
                complete: (err, stmt, rows) => {
                    if (err) {
                        console.error('❌ Snowflake query error:', err);
                        reject(err);
                    } else {
                        console.log(`✅ Query completed successfully: ${rows.length} rows returned`);
                        resolve(rows);
                    }
                }
            });
        });
    } catch (error) {
        console.error('❌ Error executing Snowflake query:', error);
        throw error;
    }
}

/**
 * Close Snowflake connection
 */
function closeSnowflakeConnection() {
    if (cachedConnection) {
        cachedConnection.destroy((err) => {
            if (err) {
                console.error('❌ Error closing Snowflake connection:', err);
            } else {
                console.log('✅ Snowflake connection closed');
            }
            cachedConnection = null;
        });
    }
}

// ===== GRACEFUL SHUTDOWN =====

process.on('SIGINT', () => {
    console.log('🔄 Shutting down gracefully...');
    closeSnowflakeConnection();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🔄 Shutting down gracefully...');
    closeSnowflakeConnection();
    process.exit(0);
});

// Export functions for use in other files
module.exports = {
    executeSnowflakeQuery,
    connectToSnowflake,
    closeSnowflakeConnection
};