const snowflake = require('snowflake-sdk');

let cachedConnection = null;
let connectingPromise = null;

function connectToSnowflake() {
  if (cachedConnection) {
    return Promise.resolve(cachedConnection); // ...reuse existing connection...
  }
  if (connectingPromise) {
    return connectingPromise; // ...reuse ongoing connection promise...
  }

  connectingPromise = new Promise((resolve, reject) => {
    const connection = snowflake.createConnection({
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
        connectingPromise = null;
        resolve(conn);
      })
      .catch(err => {
        connectingPromise = null;
        reject(new Error('❌ Snowflake connection failed: ' + err.message));
      });
  });

  return connectingPromise;
}

module.exports = { connectToSnowflake };

