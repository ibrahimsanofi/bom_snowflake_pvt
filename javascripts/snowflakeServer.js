/*
Optimized Snowflake Server with Smart Column Selection
*/

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { executeSnowflakeQuery, connectToSnowflake, closeSnowflakeConnection } = require('./snowflakeClient');

const app = express();
const PORT = 3000;

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
        const conn = await connectToSnowflake();
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
        // const limit = Math.min(options.limit || 5000, 10000); 
        const orderBy = validation.validFields[0]; // Order by first field
        
        // Add WHERE clause to filter out nulls for better performance
        const whereClause = `WHERE ${validation.validFields[0]} IS NOT NULL`;
        
        // const sqlQuery = `
        //     SELECT ${distinct} ${fieldsString} 
        //     FROM ONEMNS_PROD.DMT_BOM.${tableName} 
        //     ${whereClause}
        //     ORDER BY ${orderBy} 
        //     LIMIT ${limit}
        // `.trim();

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
 * GENERIC: Fallback filtered endpoint for other dimension tables
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