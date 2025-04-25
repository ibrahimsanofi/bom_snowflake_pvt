const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { connectToSnowflake } = require('./snowflakeClient');

const app = express();
const PORT = 3000;

app.use(cors()); 
app.use(express.json());

const TABLE_NAME_REGEX = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Route générique pour récupérer toutes les lignes d'une table.
 * Usage: GET /api/data/:table
 * Exemple: GET /api/data/DIM_LE
 */
app.get('/api/data/:table', async (req, res) => {
  const rawTable = req.params.table;

  // Vérification du format du nom de table
  if (!TABLE_NAME_REGEX.test(rawTable)) {
    return res.status(400).json({ error: `Nom de table invalide: ${rawTable}` });
  }

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


app.listen(PORT, () => {
  console.log(`✅ Serveur backend en écoute sur http://localhost:${PORT}`);
});
