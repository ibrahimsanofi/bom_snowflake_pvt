const snowflake = require('snowflake-sdk');

let cachedConnection = null;

function connectToSnowflake() {
  return new Promise((resolve, reject) => {
    if (cachedConnection) {
      return resolve(cachedConnection); // 🔁 Reuse existing connection
    }

    connection = snowflake.createConnection({
        account: process.env.ACCOUNT,
        username: process.env.USER,
        role: process.env.ROLE,
        authenticator: 'externalbrowser',
        warehouse: process.env.WAREHOUSE,
        database: process.env.DATABASE,
        schema: process.env.SCHEMA
      });

      connection.connectAsync()
      .then(conn => {
        console.log('✅ Connected to Snowflake via SSO (async)');
        cachedConnection = conn;
        resolve(conn);
      })
      .catch(err => {
        reject(new Error('❌ Snowflake connection failed: ' + err.message));
      });
  });
}

module.exports = { connectToSnowflake };

