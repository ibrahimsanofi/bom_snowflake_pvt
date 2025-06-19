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
        console.log('Filtered fact data request:', req.query);
        
        // Build WHERE clause from query parameters
        const whereConditions = [];
        const params = [];
        
        // Process each filter parameter
        Object.entries(req.query).forEach(([field, values]) => {
            if (values && values.trim()) {
                const valueArray = values.split(',').map(v => v.trim()).filter(v => v);
                if (valueArray.length > 0) {
                    const placeholders = valueArray.map(() => '?').join(',');
                    whereConditions.push(`${field} IN (${placeholders})`);
                    params.push(...valueArray);
                }
            }
        });
        
        // Build the SQL query
        let sql = `
            SELECT 
                LE, COST_ELEMENT, COMPONENT_GMID, ROOT_SMARTCODE, 
                ITEM_COST_TYPE, COMPONENT_MATERIAL_TYPE, MC, ZYEAR,
                COST_UNIT, QTY_UNIT
            FROM FACT_BOM
        `;
        
        if (whereConditions.length > 0) {
            sql += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        
        // Add reasonable limit to prevent huge result sets
        sql += ` LIMIT 10000`;
        
        console.log('Executing SQL:', sql);
        console.log('With parameters:', params);
        
        // Execute query (adjust based on your database setup)
        const results = await executeSnowflakeQuery(sql, params);
        
        // Set response headers for NDJSON
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-cache');
        
        // Stream results as NDJSON
        for (const row of results) {
            res.write(JSON.stringify(row) + '\n');
        }
        
        res.end();
        
    } catch (error) {
        console.error('Error in filtered fact data endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});


app.listen(PORT, () => {
  console.log(`✅ Snowflake database server listens on http://localhost:${PORT}`);
});
