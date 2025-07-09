/*
Optimized Snowflake Server with Smart Column Selection
*/

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { executeSnowflakeQuery, connectToSnowflake, closeSnowflakeConnection } = require('./snowflakeClient');


const app = express();
const PORT = process.argv[2] || 3000;

app.use(cors()); 
app.use(express.json());

// Cache for table schemas to avoid repeated queries
const schemaCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * SMART: Get table schema with caching
 */
async function getTableSchema(tableName) {
    const cacheKey = tableName.toUpperCase();
    const cached = schemaCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.columns;
    }
    
    try {
        // Pass user config from global context (for SSO)
        // This function must be refactored to accept userConfig if per-user SSO is needed
        // For now, fallback to .env or default headers (for demo)
        const conn = await connectToSnowflake(global._userSnowflakeConfig || {});
        const result = await new Promise((resolve, reject) => {
            conn.execute({
                sqlText: `
                    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
                    FROM ONEMNS_PROD.INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = 'DMT_BOM' 
                    AND TABLE_NAME = '${tableName.toUpperCase()}'
                    ORDER BY ORDINAL_POSITION
                `,
                complete: (err, stmt, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            });
        });
        
        const columns = result.map(row => row.COLUMN_NAME.toUpperCase());
        
        // Cache the result
        schemaCache.set(cacheKey, {
            columns: columns,
            timestamp: Date.now()
        });
        
        console.log(`📋 Cached schema for ${tableName}: ${columns.length} columns`);
        return columns;
        
    } catch (error) {
        console.error(`❌ Error fetching schema for ${tableName}:`, error.message);
        return [];
    }
}


/**
 * SMART: Validate and filter requested fields against actual table schema
 */
async function validateAndFilterFields(tableName, requestedFields) {
    const availableColumns = await getTableSchema(tableName);
    
    if (availableColumns.length === 0) {
        throw new Error(`Could not retrieve schema for table ${tableName}`);
    }
    
    const validFields = [];
    const invalidFields = [];
    
    requestedFields.forEach(field => {
        const upperField = field.toUpperCase();
        if (availableColumns.includes(upperField)) {
            validFields.push(upperField);
        } else {
            invalidFields.push(field);
        }
    });
    
    return {
        validFields,
        invalidFields,
        availableColumns
    };
}


/**
 * ENHANCED: Smart dimension fields endpoint with automatic fallback
 * Usage: POST /api/dimension-fields/:table
 * Body: { "fields": ["FIELD1", "FIELD2", ...], "options": { "limit": 1000, "distinct": true } }
 */
app.post('/api/dimension-fields/:table', async (req, res) => {
    const rawTable = req.params.table;
    const tableName = rawTable.toUpperCase();
    const { fields, options = {} } = req.body;

    // Validate input
    if (!fields || !Array.isArray(fields) || fields.length === 0) {
        return res.status(400).json({ 
            error: 'Missing or invalid fields array in request body',
            // example: { fields: ["FIELD1", "FIELD2"], options: { limit: 1000, distinct: true } }
            example: { fields: ["FIELD1", "FIELD2"], options: { distinct: true } }
        });
    }

    // Sanitize field names
    const sanitizedFields = fields.map(field => {
        if (!/^[A-Za-z0-9_\.]+$/.test(field)) {
            throw new Error(`Invalid field name: ${field}`);
        }
        return field.toUpperCase();
    });

    try {
        console.log(`⏳ Smart fetching fields [${sanitizedFields.join(', ')}] from ${tableName}...`);

        // Validate fields against actual schema
        const validation = await validateAndFilterFields(tableName, sanitizedFields);

        if (validation.validFields.length === 0) {
            return res.status(400).json({
                error: 'None of the requested fields exist in the table',
                requestedFields: sanitizedFields,
                availableFields: validation.availableColumns,
                invalidFields: validation.invalidFields
            });
        }

        // Log any invalid fields but continue with valid ones
        if (validation.invalidFields.length > 0) {
            console.warn(`⚠️ Invalid fields in ${tableName}: ${validation.invalidFields.join(', ')}`);
            console.log(`✅ Using valid fields: ${validation.validFields.join(', ')}`);
        }

        const conn = await connectToSnowflake();

        // Build optimized SQL query
        const fieldsString = validation.validFields.join(', ');
        const distinct = options.distinct !== false ? 'DISTINCT' : '';
        const orderBy = validation.validFields[0];
        const whereClause = `WHERE ${validation.validFields[0]} IS NOT NULL`;
        const sqlQuery = `
            SELECT ${distinct} ${fieldsString} 
            FROM ONEMNS_PROD.DMT_BOM.${tableName} 
            ${whereClause}
            ORDER BY ${orderBy}
        `.trim();

        console.log(`📊 Executing optimized SQL: ${sqlQuery}`);

        const stream = conn.execute({
            sqlText: sqlQuery,
            streamResult: true
        }).streamRows();

        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Selected-Fields', validation.validFields.join(','));
        res.setHeader('X-Invalid-Fields', validation.invalidFields.join(','));

        let rowCount = 0;
        stream.on('data', row => {
            res.write(JSON.stringify(row) + '\n');
            rowCount++;
            if (rowCount % 1000 === 0) {
                console.log(`📊 Streamed ${rowCount} optimized rows from ${tableName}...`);
            }
        });
        stream.on('end', () => {
            console.log(`✅ Completed streaming ${rowCount} optimized rows from ${tableName}`);
            console.log(`📊 Performance: Selected ${validation.validFields.length}/${validation.availableColumns.length} columns (${Math.round(validation.validFields.length/validation.availableColumns.length*100)}% column reduction)`);
            res.end();
        });
        stream.on('error', err => {
            console.error(`❌ Stream error for ${tableName}:`, err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: `Error streaming data from ${tableName}: ${err.message}` });
            } else {
                res.end();
            }
        });
    } catch (err) {
        console.error(`❌ Snowflake error for ${tableName}:`, err.message);
        if (err.message.includes('Invalid field name')) {
            res.status(400).json({ error: err.message });
        } else if (err.message.includes('Could not retrieve schema')) {
            res.status(404).json({ 
                error: `Table ${tableName} not found or inaccessible`,
                suggestion: 'Check table name and permissions'
            });
        } else {
            res.status(500).json({ 
                error: `Error fetching fields from ${tableName}: ${err.message}` 
            });
        }
    }
});


/**
 * OPTIMIZED: Generic data endpoint with smart column selection
 * Usage: GET /api/data/:table?fields=FIELD1,FIELD2&limit=1000&distinct=true
 */
app.get('/api/data/:table', async (req, res) => {
    const rawTable = req.params.table;
    const tableName = rawTable.toUpperCase();
    const { fields, limit, distinct, orderBy } = req.query;

    try {
        console.log(`⏳ Fetching data from ${tableName}...`);
        
        const conn = await connectToSnowflake();
        let sqlQuery;
        
        if (fields) {
            // Parse requested fields
            const requestedFields = fields.split(',').map(f => f.trim().toUpperCase());
            
            // Validate fields against schema
            const validation = await validateAndFilterFields(tableName, requestedFields);
            
            if (validation.validFields.length === 0) {
                return res.status(400).json({
                    error: 'No valid fields specified',
                    availableFields: validation.availableColumns
                });
            }
            
            // Build optimized query with specific fields
            const fieldsString = validation.validFields.join(', ');
            const distinctClause = distinct === 'true' ? 'DISTINCT' : '';
            // const limitClause = Math.min(parseInt(limit) || 5000, 10000);
            const orderByClause = orderBy || validation.validFields[0];
            
            // sqlQuery = `
            //     SELECT ${distinctClause} ${fieldsString} 
            //     FROM ONEMNS_PROD.DMT_BOM.${tableName}
            //     WHERE ${validation.validFields[0]} IS NOT NULL
            //     ORDER BY ${orderByClause}
            //     LIMIT ${limitClause}
            // `.trim();

            sqlQuery = `
                SELECT ${distinctClause} ${fieldsString} 
                FROM ONEMNS_PROD.DMT_BOM.${tableName}
                WHERE ${validation.validFields[0]} IS NOT NULL
                ORDER BY ${orderByClause}
            `.trim();
            
            console.log(`📊 Optimized query (${validation.validFields.length} columns): ${sqlQuery}`);
            
        } else {
            // Fallback to all columns with limit
            // const limitClause = Math.min(parseInt(limit) || 5000, 10000);
            // sqlQuery = `SELECT * FROM ONEMNS_PROD.DMT_BOM.${tableName} LIMIT ${limitClause}`;
            sqlQuery = `SELECT * FROM ONEMNS_PROD.DMT_BOM.${tableName}`;
            console.log(`📊 Full table query: ${sqlQuery}`);
        }
        
        const stream = conn.execute({
            sqlText: sqlQuery,
            streamResult: true
        }).streamRows();

        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-cache');

        let rowCount = 0;

        stream.on('data', row => {
            res.write(JSON.stringify(row) + '\n');
            rowCount++;
            
            if (rowCount % 1000 === 0) {
                console.log(`📊 Streamed ${rowCount} rows from ${tableName}...`);
            }
        });
        
        stream.on('end', () => {
            console.log(`✅ Completed streaming ${rowCount} rows from ${tableName}`);
            res.end();
        });
        
        stream.on('error', err => {
            console.error(`❌ Stream error for ${tableName}:`, err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: `Error streaming data from ${tableName}` });
            } else {
                res.end();
            }
        });
    } catch (err) {
        console.error(`❌ Snowflake error for ${tableName}:`, err.message);
        res.status(500).json({ error: `Error fetching data from ${tableName}: ${err.message}` });
    }
});


/**
 * NEW: Batch field validation endpoint
 * Usage: POST /api/validate-fields
 * Body: { "tables": { "DIM_LE": ["LE", "LE_DESC"], "DIM_COST_ELEMENT": ["COST_ELEMENT"] } }
 */
app.post('/api/validate-fields', async (req, res) => {
    const { tables } = req.body;
    
    if (!tables || typeof tables !== 'object') {
        return res.status(400).json({ error: 'Missing tables object in request body' });
    }
    
    try {
        const results = {};
        
        for (const [tableName, fields] of Object.entries(tables)) {
            try {
                const validation = await validateAndFilterFields(tableName, fields);
                results[tableName] = {
                    validFields: validation.validFields,
                    invalidFields: validation.invalidFields,
                    availableFields: validation.availableColumns,
                    coverage: `${validation.validFields.length}/${fields.length} fields valid`
                };
            } catch (error) {
                results[tableName] = {
                    error: error.message,
                    validFields: [],
                    invalidFields: fields
                };
            }
        }
        
        res.json({
            validation: results,
            summary: {
                totalTables: Object.keys(tables).length,
                tablesValidated: Object.keys(results).filter(t => !results[t].error).length
            }
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


/**
 * NEW: Clear schema cache endpoint
 */
app.post('/api/clear-cache', (req, res) => {
    const beforeSize = schemaCache.size;
    schemaCache.clear();
    console.log(`🧹 Cleared schema cache (${beforeSize} entries)`);
    res.json({ 
        message: 'Schema cache cleared', 
        entriesCleared: beforeSize,
        timestamp: new Date().toISOString()
    });
});


// Keep all your existing endpoints...
app.get('/api/get_fact_names', async (req, res) => {
    try {
        console.log('⏳ Fetching fact table names...');
        
        const conn = await connectToSnowflake();
        const stream = conn.execute({
            sqlText: `SELECT TABLE_NAME FROM ONEMNS_PROD.INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'DMT_BOM' AND TABLE_NAME LIKE 'FACT_%'`,
            streamResult: true
        }).streamRows();

        res.setHeader('Content-Type', 'application/x-ndjson');

        stream.on('data', row => res.write(JSON.stringify(row) + '\n'));
        stream.on('end', () => {
            console.log('✅ Completed fetching fact table names');
            res.end();
        });
        stream.on('error', err => {
            console.error('❌ Error fetching fact table names:', err.message);
            res.status(500).end();
        });
    } catch (err) {
        console.error('❌ Snowflake error:', err.message);
        res.status(500).json({ error: 'Error fetching fact table names' });
    }
});


app.get('/api/get_bom_dim', async (req, res) => {
    try {
        console.log('⏳ Fetching BOM dimension names...');
        
        const conn = await connectToSnowflake();
        const stream = conn.execute({
            sqlText: `SELECT DIM_TABLE FROM ONEMNS_PROD.DMT_BOM.SETUP WHERE FACT_TABLE = 'FACT_BOM'`,
            streamResult: true
        }).streamRows();

        res.setHeader('Content-Type', 'application/x-ndjson');

        stream.on('data', row => res.write(JSON.stringify(row) + '\n'));
        stream.on('end', () => {
            console.log('✅ Completed fetching BOM dimension names');
            res.end();
        });
        stream.on('error', err => {
            console.error('❌ Error fetching BOM dimensions:', err.message);
            res.status(500).end();
        });
    } catch (err) {
        console.error('❌ Snowflake error:', err.message);
        res.status(500).json({ error: 'Error fetching BOM dimension names' });
    }
});


/**
 * NEW: Placeholder endpoint for DIM_GMID_DISPLAY
 * Returns a small sample of records to initialize the dimension
 * Usage: GET /api/data/DIM_GMID_DISPLAY/placeholder?limit=10
 */
app.get('/api/data/DIM_GMID_DISPLAY/placeholder', async (req, res) => {
    try {
        console.log('📦 DIM_GMID_DISPLAY placeholder request...');
        
        const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50 for safety
        
        // Get a diverse sample of ROOT_GMIDs with their hierarchies
        const sql = `
            WITH SampleRootGmids AS (
                SELECT DISTINCT ROOT_GMID
                FROM ONEMNS_PROD.DMT_BOM.DIM_GMID_DISPLAY 
                WHERE ROOT_GMID IS NOT NULL 
                AND PATH_GMID IS NOT NULL
                ORDER BY ROOT_GMID
                LIMIT 3
            )
            SELECT DISTINCT
                g.PATH_GMID,
                g.ROOT_GMID,
                g.COMPONENT_GMID,
                g.DISPLAY
            FROM ONEMNS_PROD.DMT_BOM.DIM_GMID_DISPLAY g
            INNER JOIN SampleRootGmids s ON g.ROOT_GMID = s.ROOT_GMID
            WHERE g.PATH_GMID IS NOT NULL
            AND g.DISPLAY IS NOT NULL
            ORDER BY g.ROOT_GMID, g.PATH_GMID
            LIMIT ${limit}
        `.trim();
        
        console.log(`📊 Fetching ${limit} placeholder GMID records`);
        
        const conn = await connectToSnowflake();
        const stream = conn.execute({
            sqlText: sql,
            streamResult: true
        }).streamRows();
        
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Placeholder-Limit', limit.toString());
        res.setHeader('X-Data-Type', 'placeholder');
        
        let rowCount = 0;
        const rootGmidCounts = {};
        
        stream.on('data', row => {
            res.write(JSON.stringify(row) + '\n');
            rowCount++;
            
            // Track ROOT_GMID distribution
            if (row.ROOT_GMID) {
                rootGmidCounts[row.ROOT_GMID] = (rootGmidCounts[row.ROOT_GMID] || 0) + 1;
            }
        });
        
        stream.on('end', () => {
            console.log(`✅ Placeholder GMID data: ${rowCount} records`);
            console.log(`📊 ROOT_GMID distribution:`, rootGmidCounts);
            res.end();
        });
        
        stream.on('error', err => {
            console.error('❌ Error in GMID placeholder:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message });
            } else {
                res.end();
            }
        });
        
    } catch (error) {
        console.error('❌ Error in GMID placeholder endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});


/**
 * FULL LOAD: Get ALL ROOT_GMID records for filter initialization
 * Usage: GET /api/data/DIM_ROOT_GMID_DISPLAY/sample (no limit - loads all records)
 */
app.get('/api/data/DIM_ROOT_GMID_DISPLAY/sample', async (req, res) => {
    try {
        console.log('🎯 ROOT_GMID full load request...');
        
        const sql = `
            SELECT DISTINCT 
                ROOT_GMID,
                ROOT_DISPLAY
            FROM ONEMNS_PROD.DMT_BOM.DIM_ROOT_GMID_DISPLAY
            WHERE ROOT_GMID IS NOT NULL 
            AND ROOT_DISPLAY IS NOT NULL
            ORDER BY ROOT_GMID
        `.trim();
        
        console.log(`📊 Fetching ALL ROOT_GMID records (no limit)`);
        
        const conn = await connectToSnowflake();
        const stream = conn.execute({
            sqlText: sql,
            streamResult: true
        }).streamRows();
        
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Load-Type', 'full');
        res.setHeader('X-No-Limit', 'true');
        
        let rowCount = 0;
        
        stream.on('data', row => {
            res.write(JSON.stringify(row) + '\n');
            rowCount++;
            
            // Log progress for large datasets
            if (rowCount % 1000 === 0) {
                console.log(`📊 Streamed ${rowCount} ROOT_GMID records...`);
            }
        });
        
        stream.on('end', () => {
            console.log(`✅ ROOT_GMID full load complete: ${rowCount} records`);
            res.end();
        });
        
        stream.on('error', err => {
            console.error('❌ Error in ROOT_GMID full load:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message });
            } else {
                res.end();
            }
        });
        
    } catch (error) {
        console.error('❌ Error in ROOT_GMID full load endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});


/**
 * SPECIFIC: Optimized endpoint for DIM_GMID_DISPLAY filtering
 * Usage: GET /api/data/DIM_GMID_DISPLAY/filtered?ROOT_GMID=value1,value2
 */
app.get('/api/data/DIM_GMID_DISPLAY/filtered', async (req, res) => {
    try {
        console.log('🔍 DIM_GMID_DISPLAY filtered request:', req.query);
        
        const { ROOT_GMID } = req.query;
        
        if (!ROOT_GMID || !ROOT_GMID.trim()) {
            return res.status(400).json({ 
                error: 'ROOT_GMID parameter is required',
                example: '/api/data/DIM_GMID_DISPLAY/filtered?ROOT_GMID=MGM#071542,MGM#071543'
            });
        }
        
        // Parse ROOT_GMID values
        const rootGmidArray = ROOT_GMID.split(',').map(v => v.trim()).filter(v => v);
        
        if (rootGmidArray.length === 0) {
            return res.status(400).json({ error: 'No valid ROOT_GMID values provided' });
        }
        
        if (rootGmidArray.length > 10) {
            return res.status(400).json({ 
                error: `Too many ROOT_GMID values (${rootGmidArray.length}). Maximum 10 allowed for performance.`
            });
        }
        
        // Build optimized SQL query for GMID_DISPLAY
        const placeholders = rootGmidArray.map(() => '?').join(',');
        const sql = `
            SELECT 
                PATH_GMID,
                ROOT_GMID,
                COMPONENT_GMID,
                DISPLAY
            FROM ONEMNS_PROD.DMT_BOM.DIM_GMID_DISPLAY 
            WHERE ROOT_GMID IN (${placeholders})
            AND PATH_GMID IS NOT NULL
            AND DISPLAY IS NOT NULL
            ORDER BY ROOT_GMID, PATH_GMID
        `.trim();
        
        console.log(`📊 Executing optimized DIM_GMID_DISPLAY SQL for ${rootGmidArray.length} ROOT_GMIDs`);
        console.log(`📊 ROOT_GMID values:`, rootGmidArray);
        
        const conn = await connectToSnowflake();
        const stream = conn.execute({
            sqlText: sql,
            binds: rootGmidArray,
            streamResult: true
        }).streamRows();
        
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Root-GMID-Count', rootGmidArray.length.toString());
        res.setHeader('X-Root-GMID-Values', rootGmidArray.join(','));
        
        let rowCount = 0;
        let rootGmidCounts = {};
        
        stream.on('data', row => {
            res.write(JSON.stringify(row) + '\n');
            rowCount++;
            
            // Track counts per ROOT_GMID for logging
            if (row.ROOT_GMID) {
                rootGmidCounts[row.ROOT_GMID] = (rootGmidCounts[row.ROOT_GMID] || 0) + 1;
            }
            
            if (rowCount % 1000 === 0) {
                console.log(`📊 Streamed ${rowCount} GMID_DISPLAY rows...`);
            }
        });
        
        stream.on('end', () => {
            console.log(`✅ Completed streaming ${rowCount} GMID_DISPLAY rows`);
            console.log(`📊 Breakdown by ROOT_GMID:`, rootGmidCounts);
            res.end();
        });
        
        stream.on('error', err => {
            console.error('❌ Stream error in DIM_GMID_DISPLAY:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message });
            } else {
                res.end();
            }
        });
        
    } catch (error) {
        console.error('❌ Error in DIM_GMID_DISPLAY filtered endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});


/**
 * Optimized GMID filtering using INNER JOIN with FACT_BOM
 * This approach is much more efficient than filtering with large ROOT_GMID lists
 * Usage: POST /api/data/DIM_GMID_DISPLAY/filtered-join
 * Body: { 
 *   "factFilters": { "LE": ["value1"], "COST_ELEMENT": ["value2"] },
 *   "maxRecords": 10000,
 *   "orderBy": "ROOT_GMID"
 * }
 */
app.post('/api/data/DIM_GMID_DISPLAY/filtered-join', async (req, res) => {
    try {
        console.log('🚀 Optimized GMID filtering with INNER JOIN request:', req.body);
        
        const { factFilters = {}, maxRecords = 10000, orderBy = 'ROOT_GMID' } = req.body;
        
        // Validate input
        if (!factFilters || typeof factFilters !== 'object' || Object.keys(factFilters).length === 0) {
            return res.status(400).json({ 
                error: 'factFilters object with at least one filter is required',
                example: { 
                    factFilters: { 
                        "LE": ["MGM1001"], 
                        "COST_ELEMENT": ["ELEM001"] 
                    } 
                }
            });
        }
        
        // Build WHERE clause for FACT_BOM filters
        const whereConditions = [];
        const params = [];
        
        Object.entries(factFilters).forEach(([field, values]) => {
            if (values && Array.isArray(values) && values.length > 0) {
                const upperField = field.toUpperCase();
                const validFields = [
                    'LE', 'COST_ELEMENT', 'ROOT_GMID', 'ROOT_SMARTCODE', 
                    'ITEM_COST_TYPE', 'COMPONENT_MATERIAL_TYPE', 'MC', 'ZYEAR'
                ];
                
                if (!validFields.includes(upperField)) {
                    throw new Error(`Invalid field '${field}'. Valid fields: ${validFields.join(', ')}`);
                }
                
                if (values.length > 100) {
                    throw new Error(`Too many values for field '${field}' (${values.length}). Maximum 100 values allowed.`);
                }
                
                const placeholders = values.map(() => '?').join(',');
                whereConditions.push(`f.${upperField} IN (${placeholders})`);
                params.push(...values);
            }
        });
        
        // Validate max records limit
        const recordLimit = Math.min(Math.max(maxRecords, 1), 50000); // Between 1 and 50k
        
        // Validate order by field
        const validOrderFields = ['ROOT_GMID', 'PATH_GMID', 'DISPLAY'];
        const orderByField = validOrderFields.includes(orderBy.toUpperCase()) ? 
                            orderBy.toUpperCase() : 'ROOT_GMID';
        
        // Build optimized SQL with INNER JOIN
        const sql = `
            SELECT DISTINCT
                g.PATH_GMID,
                g.ROOT_GMID,
                g.COMPONENT_GMID,
                g.DISPLAY
            FROM ONEMNS_PROD.DMT_BOM.DIM_GMID_DISPLAY g 
            INNER JOIN ONEMNS_PROD.DMT_BOM.FACT_BOM f 
                ON g.PATH_GMID = f.PATH_GMID
            WHERE ${whereConditions.join(' AND ')}
                AND f.PATH_GMID IS NOT NULL 
                AND g.DISPLAY IS NOT NULL
                AND g.ROOT_GMID IS NOT NULL
            ORDER BY g.${orderByField}, g.PATH_GMID
            LIMIT ${recordLimit}
        `.trim();
        
        console.log(`📊 Executing optimized GMID JOIN query:`);
        console.log(`📊 Filters: ${Object.keys(factFilters).length} dimensions`);
        console.log(`📊 Parameters: ${params.length} values`);
        console.log(`📊 Max records: ${recordLimit}`);
        console.log(`📊 SQL: ${sql}`);
        
        const startTime = Date.now();
        const conn = await connectToSnowflake();
        
        // Execute with streaming for large results
        const stream = conn.execute({
            sqlText: sql,
            binds: params,
            streamResult: true
        }).streamRows();
        
        // Set response headers
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Query-Type', 'INNER-JOIN');
        res.setHeader('X-Filter-Count', Object.keys(factFilters).length.toString());
        res.setHeader('X-Parameter-Count', params.length.toString());
        res.setHeader('X-Max-Records', recordLimit.toString());
        
        let rowCount = 0;
        let rootGmidCounts = {};
        let pathGmidCounts = {};
        
        stream.on('data', row => {
            res.write(JSON.stringify(row) + '\n');
            rowCount++;
            
            // Track distribution for logging
            if (row.ROOT_GMID) {
                rootGmidCounts[row.ROOT_GMID] = (rootGmidCounts[row.ROOT_GMID] || 0) + 1;
            }
            if (row.PATH_GMID) {
                pathGmidCounts[row.PATH_GMID] = (pathGmidCounts[row.PATH_GMID] || 0) + 1;
            }
            
            if (rowCount % 1000 === 0) {
                console.log(`📊 Streamed ${rowCount} optimized GMID rows...`);
            }
        });
        
        stream.on('end', () => {
            const duration = Date.now() - startTime;
            const uniqueRootGmids = Object.keys(rootGmidCounts).length;
            const uniquePathGmids = Object.keys(pathGmidCounts).length;
            
            console.log(`✅ Optimized GMID JOIN query completed in ${duration}ms:`);
            console.log(`   📊 ${rowCount} total records returned`);
            console.log(`   🎯 ${uniqueRootGmids} unique ROOT_GMIDs`);
            console.log(`   📋 ${uniquePathGmids} unique PATH_GMIDs`);
            console.log(`   ⚡ Performance: ${Math.round(rowCount / (duration / 1000))} rows/second`);
            
            // Log top ROOT_GMIDs by count
            const topRootGmids = Object.entries(rootGmidCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5);
            
            if (topRootGmids.length > 0) {
                console.log(`   📈 Top ROOT_GMIDs: ${topRootGmids.map(([id, count]) => `${id}(${count})`).join(', ')}`);
            }
            
            res.end();
        });
        
        stream.on('error', err => {
            console.error('❌ Stream error in optimized GMID JOIN:', err);
            if (!res.headersSent) {
                res.status(500).json({ 
                    error: 'Database query failed',
                    message: err.message,
                    suggestion: 'Check filter values and try again'
                });
            } else {
                res.end();
            }
        });
        
    } catch (error) {
        console.error('❌ Error in optimized GMID JOIN endpoint:', error);
        
        if (error.message.includes('Invalid field') || error.message.includes('Too many values')) {
            res.status(400).json({ 
                error: 'Invalid request parameters',
                message: error.message 
            });
        } else if (error.message.includes('connection') || error.message.includes('timeout')) {
            res.status(503).json({ 
                error: 'Database connection issue',
                message: 'Please try again in a moment'
            });
        } else {
            res.status(500).json({ 
                error: 'Internal server error',
                message: error.message 
            });
        }
    }
});


/**
 * Improved DIM_GMID_DISPLAY filtered endpoint with PATH_GMID support
 * Usage: GET /api/data/DIM_GMID_DISPLAY/filtered?ROOT_GMID=value1,value2&PATH_GMID=path1,path2
 */
app.get('/api/data/DIM_GMID_DISPLAY/filtered-enhanced', async (req, res) => {
    try {
        console.log('🔍 Enhanced DIM_GMID_DISPLAY filtered request:', req.query);
        
        const { ROOT_GMID, PATH_GMID, limit } = req.query;
        
        // Validate that at least one filter is provided
        if (!ROOT_GMID && !PATH_GMID) {
            return res.status(400).json({ 
                error: 'At least one of ROOT_GMID or PATH_GMID parameter is required',
                example: '/api/data/DIM_GMID_DISPLAY/filtered-enhanced?ROOT_GMID=MGM#071542&PATH_GMID=path1,path2'
            });
        }
        
        const whereConditions = [];
        const params = [];
        
        // Handle ROOT_GMID filter
        if (ROOT_GMID && ROOT_GMID.trim()) {
            const rootGmidArray = ROOT_GMID.split(',').map(v => v.trim()).filter(v => v);
            
            if (rootGmidArray.length > 50) {
                return res.status(400).json({ 
                    error: `Too many ROOT_GMID values (${rootGmidArray.length}). Maximum 50 allowed for performance.`
                });
            }
            
            if (rootGmidArray.length > 0) {
                const placeholders = rootGmidArray.map(() => '?').join(',');
                whereConditions.push(`ROOT_GMID IN (${placeholders})`);
                params.push(...rootGmidArray);
            }
        }
        
        // Handle PATH_GMID filter
        if (PATH_GMID && PATH_GMID.trim()) {
            const pathGmidArray = PATH_GMID.split(',').map(v => v.trim()).filter(v => v);
            
            if (pathGmidArray.length > 1000) {
                return res.status(400).json({ 
                    error: `Too many PATH_GMID values (${pathGmidArray.length}). Maximum 1000 allowed for performance.`
                });
            }
            
            if (pathGmidArray.length > 0) {
                const placeholders = pathGmidArray.map(() => '?').join(',');
                whereConditions.push(`PATH_GMID IN (${placeholders})`);
                params.push(...pathGmidArray);
            }
        }
        
        // Build optimized SQL query
        let sql = `
            SELECT 
                PATH_GMID,
                ROOT_GMID,
                COMPONENT_GMID,
                DISPLAY
            FROM ONEMNS_PROD.DMT_BOM.DIM_GMID_DISPLAY 
            WHERE ${whereConditions.join(' AND ')}
            AND PATH_GMID IS NOT NULL
            AND DISPLAY IS NOT NULL
            ORDER BY ROOT_GMID, PATH_GMID
        `;
        
        // Add limit if specified
        if (limit && !isNaN(parseInt(limit))) {
            const limitValue = Math.min(parseInt(limit), 10000); // Max 10k records
            sql += ` LIMIT ${limitValue}`;
        }
        
        console.log(`📊 Executing enhanced DIM_GMID_DISPLAY SQL with ${whereConditions.length} conditions:`);
        console.log(`📊 SQL: ${sql}`);
        console.log(`📊 Parameters (${params.length}):`, params.slice(0, 10), params.length > 10 ? `... +${params.length - 10} more` : '');
        
        const conn = await connectToSnowflake();
        const stream = conn.execute({
            sqlText: sql,
            binds: params,
            streamResult: true
        }).streamRows();
        
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Filter-Count', whereConditions.length.toString());
        res.setHeader('X-Parameter-Count', params.length.toString());
        
        let rowCount = 0;
        let rootGmidCounts = {};
        
        stream.on('data', row => {
            res.write(JSON.stringify(row) + '\n');
            rowCount++;
            
            // Track counts per ROOT_GMID for logging
            if (row.ROOT_GMID) {
                rootGmidCounts[row.ROOT_GMID] = (rootGmidCounts[row.ROOT_GMID] || 0) + 1;
            }
            
            if (rowCount % 1000 === 0) {
                console.log(`📊 Streamed ${rowCount} enhanced GMID_DISPLAY rows...`);
            }
        });
        
        stream.on('end', () => {
            console.log(`✅ Completed enhanced GMID_DISPLAY streaming: ${rowCount} rows`);
            console.log(`📊 Breakdown by ROOT_GMID:`, Object.keys(rootGmidCounts).length > 10 ? 
                `${Object.keys(rootGmidCounts).length} different ROOT_GMIDs` : rootGmidCounts);
            res.end();
        });
        
        stream.on('error', err => {
            console.error('❌ Stream error in enhanced DIM_GMID_DISPLAY:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message });
            } else {
                res.end();
            }
        });
        
    } catch (error) {
        console.error('❌ Error in enhanced DIM_GMID_DISPLAY filtered endpoint:', error);
        
        if (error.message.includes('Too many values')) {
            res.status(400).json({ 
                error: 'Invalid request parameters',
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                error: 'Internal server error',
                message: error.message 
            });
        }
    }
});


app.get('/api/data/FACT_BOM/filtered', async (req, res) => {
    try {
        console.log('🔍 FACT_BOM filtered request:', req.query);
        
        // Check if any filter parameters were provided
        const hasFilters = Object.keys(req.query).length > 0;
        
        if (!hasFilters) {
            return res.status(400).json({ 
                error: 'No filter parameters provided',
                message: 'At least one filter parameter is required for FACT_BOM queries',
                example: '/api/data/FACT_BOM/filtered?ROOT_SMARTCODE=CLEAVE',
                availableFilters: [
                    'LE', 'COST_ELEMENT', 'PATH_GMID', 'ROOT_GMID',  // CHANGED: COMPONENT_GMID → PATH_GMID
                    'ROOT_SMARTCODE', 'ITEM_COST_TYPE', 'COMPONENT_MATERIAL_TYPE', 
                    'MC', 'ZYEAR'
                ]
            });
        }
        
        const whereConditions = [];
        const params = [];
        
        // Validate and build WHERE conditions
        Object.entries(req.query).forEach(([field, values]) => {
            if (values && values.trim()) {
                // CRITICAL FIX: Update valid fields to include PATH_GMID instead of COMPONENT_GMID
                const validFields = [
                    'LE', 'COST_ELEMENT', 'PATH_GMID', 'ROOT_GMID',  // CHANGED: COMPONENT_GMID → PATH_GMID
                    'ROOT_SMARTCODE', 'ITEM_COST_TYPE', 'COMPONENT_MATERIAL_TYPE', 
                    'MC', 'ZYEAR'
                ];
                
                const upperField = field.toUpperCase();
                if (!validFields.includes(upperField)) {
                    throw new Error(`Invalid field '${field}'. Valid fields: ${validFields.join(', ')}`);
                }
                
                const valueArray = values.split(',').map(v => v.trim()).filter(v => v);
                if (valueArray.length > 0) {
                    if (valueArray.length > 50) {
                        throw new Error(`Too many values for field '${field}' (${valueArray.length}). Maximum 50 values allowed.`);
                    }
                    
                    const placeholders = valueArray.map(() => '?').join(',');
                    whereConditions.push(`${upperField} IN (${placeholders})`);
                    params.push(...valueArray);
                }
            }
        });
        
        if (whereConditions.length === 0) {
            return res.status(400).json({ 
                error: 'No valid filter values provided',
                message: 'Filter parameters cannot be empty'
            });
        }
        
        // CRITICAL FIX: Update SQL query to use PATH_GMID instead of COMPONENT_GMID
        let sql = `
            SELECT 
                LE, 
                COST_ELEMENT, 
                PATH_GMID,        -- CHANGED: COMPONENT_GMID → PATH_GMID
                ROOT_GMID,
                ROOT_SMARTCODE, 
                ITEM_COST_TYPE, 
                COMPONENT_MATERIAL_TYPE, 
                MC, 
                ZYEAR,
                COST_UNIT, 
                QTY_UNIT
            FROM ONEMNS_PROD.DMT_BOM.FACT_BOM
            WHERE ${whereConditions.join(' AND ')}
        `.trim();
        
        // Add ordering for consistency - CHANGED: Use PATH_GMID for ordering
        sql += ` ORDER BY LE, ROOT_SMARTCODE, PATH_GMID`;
        
        console.log(`📊 Executing FACT_BOM SQL with ${whereConditions.length} filters:`);
        console.log(`📊 SQL: ${sql}`);
        console.log(`📊 Parameters (${params.length}):`, params.slice(0, 10), params.length > 10 ? `... +${params.length - 10} more` : '');
        
        const conn = await connectToSnowflake();
        const stream = conn.execute({
            sqlText: sql,
            binds: params,
            streamResult: true
        }).streamRows();
        
        // Set response headers
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Filter-Count', whereConditions.length.toString());
        res.setHeader('X-Parameter-Count', params.length.toString());
        
        let rowCount = 0;
        let startTime = Date.now();
        
        stream.on('data', row => {
            res.write(JSON.stringify(row) + '\n');
            rowCount++;
            
            if (rowCount % 5000 === 0) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`📊 Streamed ${rowCount} FACT_BOM rows (${elapsed}s)...`);
            }
        });
        
        stream.on('end', () => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`✅ Completed FACT_BOM query: ${rowCount} rows in ${elapsed}s`);
            console.log(`📊 Query performance: ${Math.round(rowCount / elapsed)} rows/second`);
            res.end();
        });
        
        stream.on('error', err => {
            console.error('❌ Stream error in FACT_BOM query:', err);
            if (!res.headersSent) {
                res.status(500).json({ 
                    error: 'Database query failed',
                    message: err.message,
                    suggestion: 'Check your filter values and try again'
                });
            } else {
                res.end();
            }
        });
        
    } catch (error) {
        console.error('❌ Error in FACT_BOM filtered endpoint:', error);
        
        if (error.message.includes('Invalid field') || error.message.includes('Too many values')) {
            res.status(400).json({ 
                error: 'Invalid request parameters',
                message: error.message 
            });
        } else if (error.message.includes('connection') || error.message.includes('timeout')) {
            res.status(503).json({ 
                error: 'Database connection issue',
                message: 'Please try again in a moment'
            });
        } else {
            res.status(500).json({ 
                error: 'Internal server error',
                message: error.message 
            });
        }
    }
});


/**
 * Fallback filtered endpoint for other dimension tables
 * Usage: GET /api/data/:table/filtered?FIELD1=value1,value2&FIELD2=value3
 */
app.get('/api/data/:table/filtered', async (req, res) => {
    const rawTable = req.params.table;
    const tableName = rawTable.toUpperCase();
    
    try {
        console.log(`🔍 Generic filtered ${tableName} request:`, req.query);
        
        // Redirect specific tables to their optimized endpoints
        if (tableName === 'FACT_BOM') {
            return res.status(400).json({ 
                error: 'Use /api/data/FACT_BOM/filtered endpoint for FACT_BOM table',
                redirectTo: '/api/data/FACT_BOM/filtered'
            });
        }
        
        if (tableName === 'DIM_GMID_DISPLAY') {
            return res.status(400).json({ 
                error: 'Use /api/data/DIM_GMID_DISPLAY/filtered endpoint for GMID_DISPLAY table',
                redirectTo: '/api/data/DIM_GMID_DISPLAY/filtered?ROOT_GMID=value1,value2'
            });
        }
        
        const whereConditions = [];
        const params = [];
        
        // Validate table name
        if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
        
        // Build WHERE conditions from query parameters
        Object.entries(req.query).forEach(([field, values]) => {
            if (values && values.trim()) {
                // Validate field name
                if (!/^[A-Za-z0-9_]+$/.test(field)) {
                    throw new Error(`Invalid field name: ${field}`);
                }
                
                const valueArray = values.split(',').map(v => v.trim()).filter(v => v);
                if (valueArray.length > 0) {
                    const placeholders = valueArray.map(() => '?').join(',');
                    whereConditions.push(`${field.toUpperCase()} IN (${placeholders})`);
                    params.push(...valueArray);
                }
            }
        });
        
        // Build base SQL query
        let sql = `SELECT * FROM ONEMNS_PROD.DMT_BOM.${tableName}`;
        
        if (whereConditions.length > 0) {
            sql += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        
        // Add ordering for consistency
        sql += ` ORDER BY 1`; // Order by first column
        
        console.log(`📊 Executing generic filtered SQL:`, sql);
        console.log(`📊 Parameters:`, params);
        
        const conn = await connectToSnowflake();
        const stream = conn.execute({
            sqlText: sql,
            binds: params,
            streamResult: true
        }).streamRows();
        
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Table-Name', tableName);
        res.setHeader('X-Filter-Count', whereConditions.length.toString());
        
        let rowCount = 0;
        
        stream.on('data', row => {
            res.write(JSON.stringify(row) + '\n');
            rowCount++;
            
            if (rowCount % 1000 === 0) {
                console.log(`📊 Streamed ${rowCount} filtered rows from ${tableName}...`);
            }
        });
        
        stream.on('end', () => {
            console.log(`✅ Completed streaming ${rowCount} filtered rows from ${tableName}`);
            res.end();
        });
        
        stream.on('error', err => {
            console.error(`❌ Stream error for filtered ${tableName}:`, err);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message });
            } else {
                res.end();
            }
        });
        
    } catch (error) {
        console.error(`❌ Error in generic filtered ${tableName} endpoint:`, error);
        
        if (error.message.includes('Invalid table name') || error.message.includes('Invalid field name')) {
            res.status(400).json({ error: error.message });
        } else if (error.message.includes('Object') && error.message.includes('does not exist')) {
            res.status(404).json({ 
                error: `Table ${tableName} not found`,
                suggestion: 'Check table name and verify it exists in DMT_BOM schema'
            });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});


app.get('/api/health', async (req, res) => {
    try {
        const conn = await connectToSnowflake();
        const result = await new Promise((resolve, reject) => {
            conn.execute({
                sqlText: 'SELECT 1 as test',
                complete: (err, stmt, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            });
        });
        
        res.json({ 
            status: 'healthy', 
            database: 'connected',
            timestamp: new Date().toISOString(),
            test_query: result.length > 0 ? 'passed' : 'failed',
            cacheSize: schemaCache.size
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'unhealthy', 
            database: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});


app.get('/api/dimension-schema/:table', async (req, res) => {
    const rawTable = req.params.table;
    const tableName = rawTable.toUpperCase();

    try {
        console.log(`⏳ Fetching schema for ${tableName}...`);
        
        const columns = await getTableSchema(tableName);
        
        if (columns.length === 0) {
            return res.status(404).json({ error: `Table ${tableName} not found` });
        }
        
        // Return as JSON array for easier consumption
        res.json({
            table: tableName,
            columns: columns,
            columnCount: columns.length,
            cached: schemaCache.has(tableName)
        });
        
    } catch (err) {
        console.error('❌ Schema fetch error:', err.message);
        res.status(500).json({ error: `Error fetching schema for ${tableName}` });
    }
});


/**
 * Error handling middleware
 */
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});


/**
 * 404 handler
 */
app.use((req, res) => {
    console.log(`❌ 404 - Endpoint not found: ${req.method} ${req.path}`);
    res.status(404).json({ 
        error: `Endpoint not found: ${req.method} ${req.path}`,
        availableEndpoints: [
            // 'GET /api/data/:table?fields=FIELD1,FIELD2&limit=1000',
            'GET /api/data/:table?fields=FIELD1,FIELD2',
            'POST /api/dimension-fields/:table',
            'POST /api/validate-fields',
            'POST /api/clear-cache',
            'GET /api/dimension-schema/:table',
            'GET /api/get_bom_dim',
            'GET /api/get_fact_names',
            'GET /api/data/FACT_BOM/filtered',
            'GET /api/health'
        ]
    });
});


/**
 * This endpoint first filters FACT_BOM, then uses results to filter DIM_GMID_DISPLAY. Costly. Replaced.
 * Usage: POST /api/data/comprehensive-gmid-filter
 * Body: { 
 *   "factFilters": { "LE": ["value1"], "COST_ELEMENT": ["value2"] },
 *   "maxRootGmids": 50,
 *   "maxPathGmids": 1000,
 *   "includeGmidDimension": true
 * }
 */
app.post('/api/data/comprehensive-gmid-filter', async (req, res) => {
    try {
        console.log('🔍 Comprehensive GMID filtering request:', req.body);
        
        const { factFilters = {}, maxRootGmids = 50, maxPathGmids = 1000, includeGmidDimension = true } = req.body;
        
        // Validate input
        if (!factFilters || typeof factFilters !== 'object') {
            return res.status(400).json({ 
                error: 'factFilters object is required',
                example: { factFilters: { "LE": ["value1"], "COST_ELEMENT": ["value2"] } }
            });
        }
        
        // Step 1: Build FACT_BOM query from filters
        const whereConditions = [];
        const params = [];
        
        Object.entries(factFilters).forEach(([field, values]) => {
            if (values && Array.isArray(values) && values.length > 0) {
                const upperField = field.toUpperCase();
                const validFields = [
                    'LE', 'COST_ELEMENT', 'ROOT_GMID', 'ROOT_SMARTCODE', 
                    'ITEM_COST_TYPE', 'COMPONENT_MATERIAL_TYPE', 'MC', 'ZYEAR'
                ];
                
                if (!validFields.includes(upperField)) {
                    throw new Error(`Invalid field '${field}'. Valid fields: ${validFields.join(', ')}`);
                }
                
                if (values.length > 100) {
                    throw new Error(`Too many values for field '${field}' (${values.length}). Maximum 100 values allowed.`);
                }
                
                const placeholders = values.map(() => '?').join(',');
                whereConditions.push(`${upperField} IN (${placeholders})`);
                params.push(...values);
            }
        });
        
        // Step 2: Execute FACT_BOM query to get ROOT_GMIDs and PATH_GMIDs
        let factSql = `
            SELECT DISTINCT 
                ROOT_GMID,
                PATH_GMID
            FROM ONEMNS_PROD.DMT_BOM.FACT_BOM
        `;
        
        if (whereConditions.length > 0) {
            factSql += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        
        factSql += ` ORDER BY ROOT_GMID, PATH_GMID`;
        
        console.log(`📊 Step 1 - Executing FACT_BOM query with ${whereConditions.length} filters:`);
        console.log(`📊 SQL: ${factSql}`);
        console.log(`📊 Parameters (${params.length}):`, params.slice(0, 10), params.length > 10 ? `... +${params.length - 10} more` : '');
        
        const conn = await connectToSnowflake();
        
        // Execute fact query
        const factResult = await new Promise((resolve, reject) => {
            conn.execute({
                sqlText: factSql,
                binds: params,
                complete: (err, stmt, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            });
        });
        
        console.log(`✅ Step 1 complete: Found ${factResult.length} unique GMID combinations in FACT_BOM`);
        
        if (factResult.length === 0) {
            return res.json({
                success: true,
                message: 'No FACT_BOM records match the specified filters',
                factGmids: [],
                rootGmids: [],
                pathGmids: [],
                gmidDimension: [],
                stats: {
                    factGmidCombinations: 0,
                    uniqueRootGmids: 0,
                    uniquePathGmids: 0,
                    gmidDimensionRecords: 0
                }
            });
        }
        
        // Step 3: Extract unique ROOT_GMIDs and PATH_GMIDs
        const uniqueRootGmids = [...new Set(
            factResult
                .filter(row => row.ROOT_GMID && row.ROOT_GMID.trim() !== '')
                .map(row => row.ROOT_GMID)
        )].slice(0, maxRootGmids);
        
        const uniquePathGmids = [...new Set(
            factResult
                .filter(row => row.PATH_GMID && row.PATH_GMID.trim() !== '')
                .map(row => row.PATH_GMID)
        )].slice(0, maxPathGmids);
        
        console.log(`✅ Step 2 complete: Extracted ${uniqueRootGmids.length} ROOT_GMIDs, ${uniquePathGmids.length} PATH_GMIDs`);
        
        // Step 4: Query DIM_GMID_DISPLAY with the extracted GMIDs (if requested)
        let gmidDimensionData = [];
        
        if (includeGmidDimension && uniqueRootGmids.length > 0) {
            console.log(`📊 Step 3 - Querying DIM_GMID_DISPLAY for ${uniqueRootGmids.length} ROOT_GMIDs...`);
            
            const gmidPlaceholders = uniqueRootGmids.map(() => '?').join(',');
            const gmidSql = `
                SELECT 
                    PATH_GMID,
                    ROOT_GMID,
                    COMPONENT_GMID,
                    DISPLAY
                FROM ONEMNS_PROD.DMT_BOM.DIM_GMID_DISPLAY 
                WHERE ROOT_GMID IN (${gmidPlaceholders})
                AND PATH_GMID IS NOT NULL
                AND DISPLAY IS NOT NULL
                ORDER BY ROOT_GMID, PATH_GMID
            `;
            
            const gmidResult = await new Promise((resolve, reject) => {
                conn.execute({
                    sqlText: gmidSql,
                    binds: uniqueRootGmids,
                    complete: (err, stmt, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                });
            });
            
            gmidDimensionData = gmidResult;
            console.log(`✅ Step 3 complete: Retrieved ${gmidDimensionData.length} DIM_GMID_DISPLAY records`);
        }
        
        // Step 5: Return comprehensive results
        const result = {
            success: true,
            message: `Successfully filtered GMIDs based on ${Object.keys(factFilters).length} fact table criteria`,
            factGmids: factResult,
            rootGmids: uniqueRootGmids,
            pathGmids: uniquePathGmids,
            gmidDimension: gmidDimensionData,
            stats: {
                factGmidCombinations: factResult.length,
                uniqueRootGmids: uniqueRootGmids.length,
                uniquePathGmids: uniquePathGmids.length,
                gmidDimensionRecords: gmidDimensionData.length,
                filterCriteria: factFilters,
                limitations: {
                    maxRootGmids: maxRootGmids,
                    maxPathGmids: maxPathGmids
                }
            }
        };
        
        // Set response headers
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Filter-Count', Object.keys(factFilters).length.toString());
        res.setHeader('X-Root-GMID-Count', uniqueRootGmids.length.toString());
        res.setHeader('X-Path-GMID-Count', uniquePathGmids.length.toString());
        
        console.log(`✅ Comprehensive GMID filtering complete:`, result.stats);
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error in comprehensive GMID filtering:', error);
        
        if (error.message.includes('Invalid field') || error.message.includes('Too many values')) {
            res.status(400).json({ 
                error: 'Invalid request parameters',
                message: error.message 
            });
        } else if (error.message.includes('connection') || error.message.includes('timeout')) {
            res.status(503).json({ 
                error: 'Database connection issue',
                message: 'Please try again in a moment'
            });
        } else {
            res.status(500).json({ 
                error: 'Internal server error',
                message: error.message 
            });
        }
    }
});


/**
 * GMID relationship analysis endpoint
 * Analyzes the relationship between FACT_BOM and DIM_GMID_DISPLAY
 * Usage: POST /api/data/gmid-relationship-analysis
 * Body: { "sampleSize": 1000, "includeOrphans": true }
 */
app.post('/api/data/gmid-relationship-analysis', async (req, res) => {
    try {
        console.log('🔍 GMID relationship analysis request:', req.body);
        
        const { sampleSize = 1000, includeOrphans = true } = req.body;
        
        const conn = await connectToSnowflake();
        
        // Query to analyze GMID relationships
        const analysisSql = `
            WITH fact_gmids AS (
                SELECT DISTINCT 
                    ROOT_GMID,
                    PATH_GMID,
                    COUNT(*) as fact_count
                FROM ONEMNS_PROD.DMT_BOM.FACT_BOM 
                WHERE ROOT_GMID IS NOT NULL 
                AND PATH_GMID IS NOT NULL
                GROUP BY ROOT_GMID, PATH_GMID
                ORDER BY fact_count DESC
                LIMIT ${Math.min(sampleSize, 10000)}
            ),
            dim_gmids AS (
                SELECT DISTINCT 
                    ROOT_GMID,
                    PATH_GMID,
                    DISPLAY
                FROM ONEMNS_PROD.DMT_BOM.DIM_GMID_DISPLAY 
                WHERE ROOT_GMID IS NOT NULL 
                AND PATH_GMID IS NOT NULL
            )
            SELECT 
                f.ROOT_GMID,
                f.PATH_GMID,
                f.fact_count,
                d.DISPLAY,
                CASE 
                    WHEN d.PATH_GMID IS NOT NULL THEN 'MATCHED'
                    ELSE 'ORPHAN_IN_FACT'
                END as relationship_status
            FROM fact_gmids f
            LEFT JOIN dim_gmids d ON f.ROOT_GMID = d.ROOT_GMID AND f.PATH_GMID = d.PATH_GMID
            
            ${includeOrphans ? `
            UNION ALL
            
            SELECT 
                d.ROOT_GMID,
                d.PATH_GMID,
                0 as fact_count,
                d.DISPLAY,
                'ORPHAN_IN_DIM' as relationship_status
            FROM dim_gmids d
            LEFT JOIN fact_gmids f ON d.ROOT_GMID = f.ROOT_GMID AND d.PATH_GMID = f.PATH_GMID
            WHERE f.PATH_GMID IS NULL
            LIMIT ${Math.min(sampleSize, 1000)}
            ` : ''}
            
            ORDER BY fact_count DESC, ROOT_GMID, PATH_GMID
        `;
        
        console.log('📊 Executing GMID relationship analysis...');
        
        const analysisResult = await new Promise((resolve, reject) => {
            conn.execute({
                sqlText: analysisSql,
                complete: (err, stmt, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            });
        });
        
        // Analyze the results
        const stats = {
            totalAnalyzed: analysisResult.length,
            matched: analysisResult.filter(r => r.RELATIONSHIP_STATUS === 'MATCHED').length,
            orphansInFact: analysisResult.filter(r => r.RELATIONSHIP_STATUS === 'ORPHAN_IN_FACT').length,
            orphansInDim: analysisResult.filter(r => r.RELATIONSHIP_STATUS === 'ORPHAN_IN_DIM').length
        };
        
        stats.matchPercentage = stats.totalAnalyzed > 0 ? 
            Math.round((stats.matched / stats.totalAnalyzed) * 100) : 0;
        
        const result = {
            success: true,
            message: `GMID relationship analysis complete for ${stats.totalAnalyzed} combinations`,
            analysis: analysisResult,
            statistics: stats,
            sampleSize: sampleSize,
            includeOrphans: includeOrphans
        };
        
        console.log(`✅ GMID relationship analysis complete:`, stats);
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error in GMID relationship analysis:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});


// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🔄 Shutting down server gracefully...');
    closeSnowflakeConnection();
    process.exit(0);
});


process.on('SIGTERM', () => {
    console.log('🔄 Shutting down server gracefully...');
    closeSnowflakeConnection();
    process.exit(0);
});


app.listen(PORT, () => {
    console.log(`✅ Optimized Snowflake database server listening on http://localhost:${PORT}`);
    console.log(`📊 Performance features:`);
    console.log(`   🎯 Smart column selection with validation`);
    console.log(`   💾 Schema caching (${CACHE_TTL/1000/60}min TTL)`);
    console.log(`   🔍 Automatic field validation`);
    console.log(`   ⚡ Optimized queries with DISTINCT`);
    console.log(`📊 Available endpoints:`);
    console.log(`   GET  /api/data/:table?fields=FIELD1,FIELD2 - Smart column selection`);
    console.log(`   POST /api/dimension-fields/:table - Validated field fetching`);
    console.log(`   POST /api/validate-fields - Batch field validation`);
    console.log(`   POST /api/clear-cache - Clear schema cache`);
    console.log(`   GET  /api/dimension-schema/:table - Get table schema`);
    console.log(`   GET  /api/health - Health check with cache info`);
});