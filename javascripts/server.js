/*
xxx
*/

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { executeSnowflakeQuery, connectToSnowflake, closeSnowflakeConnection } = require('./snowflakeClient');

const app = express();
const PORT = 3000;

app.use(cors()); 
app.use(express.json());


/**
 * ENHANCED: New endpoint for fetching specific fields from dimension tables
 * Usage: POST /api/dimension-fields/:table
 * Body: { "fields": ["FIELD1", "FIELD2", ...] }
 * Example: POST /api/dimension-fields/DIM_LE
 *          Body: { "fields": ["LE", "LE_DESC", "COUNTRY"] }
 */
app.post('/api/dimension-fields/:table', async (req, res) => {
  const rawTable = req.params.table;
  const tableName = rawTable.toUpperCase();
  const { fields } = req.body;

  // Validate input
  if (!fields || !Array.isArray(fields) || fields.length === 0) {
    return res.status(400).json({ 
      error: 'Missing or invalid fields array in request body' 
    });
  }

  // Sanitize field names to prevent SQL injection
  const sanitizedFields = fields.map(field => {
    // Only allow alphanumeric characters, underscores, and dots
    if (!/^[A-Za-z0-9_\.]+$/.test(field)) {
      throw new Error(`Invalid field name: ${field}`);
    }
    return field.toUpperCase();
  });

  try {
    console.log(`⏳ Fetching fields [${sanitizedFields.join(', ')}] from ${tableName}...`);
    
    const conn = await connectToSnowflake();
    
    // Build SQL query with specific fields
    const fieldsString = sanitizedFields.join(', ');
    const sqlQuery = `SELECT DISTINCT ${fieldsString} FROM ONEMNS_PROD.DMT_BOM.${tableName} WHERE ${sanitizedFields[0]} IS NOT NULL ORDER BY ${sanitizedFields[0]}`;
    
    console.log(`📊 Executing SQL: ${sqlQuery}`);
    
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
      
      // Log progress for large datasets
      if (rowCount % 1000 === 0) {
        console.log(`📊 Streamed ${rowCount} rows from ${tableName}...`);
      }
    });
    
    stream.on('end', () => {
      console.log(`✅ Completed streaming ${rowCount} rows from ${tableName} (fields: ${sanitizedFields.join(', ')})`);
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
    
    if (err.message.includes('Invalid field name')) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ 
        error: `Error fetching fields from ${tableName}: ${err.message}` 
      });
    }
  }
});


/**
 * Route générique pour récupérer toutes les lignes d'une table.
 * Usage: GET /api/data/:table
 * Exemple: GET /api/data/DIM_LE
 */
app.get('/api/data/:table', async (req, res) => {
  const rawTable = req.params.table;


  const tableName = rawTable.toUpperCase();

  try {
    const conn = await connectToSnowflake();
    const stream = conn.execute({
      sqlText: `SELECT * FROM ONEMNS_PROD.DMT_BOM.${tableName}`,
      streamResult: true
    }).streamRows();

    res.setHeader('Content-Type', 'application/x-ndjson');

    stream.on('data', row => res.write(JSON.stringify(row) + '\n'));
    stream.on('end', () => res.end());
    stream.on('error', err => {
      console.error(`Erreur stream ${tableName}:`, err.message);
      res.status(500).end();
    });
  } catch (err) {
    console.error('Erreur Snowflake:', err.message);
    res.status(500).json({ error: `Erreur lors de la récupération de ${tableName}` });
  }
});


app.get('/api/get_fact_names', async (req, res) => {
  try {
    const conn = await connectToSnowflake();
    const stream = conn.execute({
      sqlText: `SELECT TABLE_NAME FROM ONEMNS_PROD.INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'DMT_BOM' AND TABLE_NAME LIKE 'FACT_%'`,
      streamResult: true
    }).streamRows();

    res.setHeader('Content-Type', 'application/x-ndjson');

    stream.on('data', row => res.write(JSON.stringify(row) + '\n'));
    stream.on('end', () => res.end());
    stream.on('error', err => {
      console.error('Erreur stream FACT_NAMES:', err.message);
      res.status(500).end();
    });
  } catch (err) {
    console.error('Erreur Snowflake:', err.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des noms de tables FACT_' });
  }
});


app.get('/api/get_bom_dim', async (req, res) => {
  try {
    const conn = await connectToSnowflake();
    const stream = conn.execute({
      sqlText: `SELECT DIM_TABLE FROM ONEMNS_PROD.DMT_BOM.SETUP WHERE FACT_TABLE = 'FACT_BOM'`,
      streamResult: true
    }).streamRows();

    res.setHeader('Content-Type', 'application/x-ndjson');

    stream.on('data', row => res.write(JSON.stringify(row) + '\n'));
    stream.on('end', () => res.end());
    stream.on('error', err => {
      console.error('Erreur stream BOM_DIM:', err.message);
      res.status(500).end();
    });
  } catch (err) {
    console.error('Erreur Snowflake:', err.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des noms des DIM_ de la BOM' });
  }
});


app.get('/api/data/FACT_BOM/filtered', async (req, res) => {
    try {
        console.log('🔍 Filtered fact data request:', req.query);
        
        // Build WHERE clause from query parameters
        const whereConditions = [];
        const params = [];
        
        // Process each filter parameter
        Object.entries(req.query).forEach(([field, values]) => {
            if (values && values.trim()) {
                // Sanitize field name
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
        
        // Build the optimized SQL query
        let sql = `
            SELECT 
                LE, COST_ELEMENT, COMPONENT_GMID, ROOT_SMARTCODE, 
                ITEM_COST_TYPE, COMPONENT_MATERIAL_TYPE, MC, ZYEAR,
                COST_UNIT, QTY_UNIT
            FROM ONEMNS_PROD.DMT_BOM.FACT_BOM
        `;
        
        if (whereConditions.length > 0) {
            sql += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        
        // Add filters to exclude null/zero measures for better performance
        sql += whereConditions.length > 0 ? ' AND ' : ' WHERE ';
        sql += `(COST_UNIT IS NOT NULL AND COST_UNIT != 0) OR (QTY_UNIT IS NOT NULL AND QTY_UNIT != 0)`;
        
        // Add reasonable limit to prevent huge result sets [50,000 rows]
        sql += ` LIMIT 50000`;
        
        console.log('📊 Executing optimized SQL:', sql);
        console.log('📊 With parameters:', params);
        
        // Execute query using streaming for better performance
        const conn = await connectToSnowflake();
        const stream = conn.execute({
            sqlText: sql,
            binds: params,
            streamResult: true
        }).streamRows();
        
        // Set response headers for NDJSON streaming
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        let rowCount = 0;
        
        // Stream results as NDJSON
        stream.on('data', row => {
            res.write(JSON.stringify(row) + '\n');
            rowCount++;
            
            // Log progress for large datasets
            if (rowCount % 5000 === 0) {
                console.log(`📊 Streamed ${rowCount} filtered fact rows...`);
            }
        });
        
        stream.on('end', () => {
            console.log(`✅ Completed streaming ${rowCount} filtered fact rows`);
            res.end();
        });
        
        stream.on('error', err => {
            console.error('❌ Stream error in filtered fact data:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message });
            } else {
                res.end();
            }
        });
        
    } catch (error) {
        console.error('❌ Error in filtered fact data endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ENHANCED: Health check endpoint for monitoring
 */
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
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
      test_query: result.length > 0 ? 'passed' : 'failed'
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

/**
 * ENHANCED: Endpoint to get available fields for a dimension table
 * Usage: GET /api/dimension-schema/:table
 */
app.get('/api/dimension-schema/:table', async (req, res) => {
  const rawTable = req.params.table;
  const tableName = rawTable.toUpperCase();

  try {
    const conn = await connectToSnowflake();
    const stream = conn.execute({
      sqlText: `
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
        FROM ONEMNS_PROD.INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'DMT_BOM' 
        AND TABLE_NAME = '${tableName}'
        ORDER BY ORDINAL_POSITION
      `,
      streamResult: true
    }).streamRows();

    res.setHeader('Content-Type', 'application/x-ndjson');

    stream.on('data', row => res.write(JSON.stringify(row) + '\n'));
    stream.on('end', () => res.end());
    stream.on('error', err => {
      console.error(`Schema error for ${tableName}:`, err.message);
      res.status(500).end();
    });
  } catch (err) {
    console.error('Schema fetch error:', err.message);
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
  res.status(404).json({ error: `Endpoint not found: ${req.method} ${req.path}` });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Enhanced Snowflake database server listening on http://localhost:${PORT}`);
  console.log(`📊 New endpoints available:`);
  console.log(`   POST /api/dimension-fields/:table - Fetch specific fields`);
  console.log(`   GET  /api/dimension-schema/:table - Get table schema`);
  console.log(`   GET  /api/health - Health check`);
  console.log(`   GET  /api/data/FACT_BOM/filtered - Optimized filtered facts`);
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
  console.log(`✅ Snowflake database server listens on http://localhost:${PORT}`);
});
