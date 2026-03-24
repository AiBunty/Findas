const fs = require('fs');
const path = require('path');

(async () => {
  const mysql = require(path.join(__dirname, '..', 'backend', 'node_modules', 'mysql2', 'promise'));

  let hostInput = process.env.FINDAS_DB_HOST || 'sdb-87.hosting.stackcp.net';
  let host = hostInput;
  let port = 3306;
  
  if (hostInput.includes(':')) {
    const parts = hostInput.split(':');
    host = parts[0];
    port = Number(parts[1]) || 3306;
  } else {
    port = Number(process.env.FINDAS_DB_PORT || 3306);
  }
  
  const user = process.env.FINDAS_DB_USER || 'findas';
  const database = process.env.FINDAS_DB_NAME || 'Findas-353131330571';
  const password = process.env.FINDAS_DB_PASS || '';

  if (!password) {
    console.error('FINDAS_DB_PASS is not set. Set it before running this script.');
    process.exit(1);
  }

  const schemaFile = path.join(__dirname, '..', 'backend', 'sql', 'serverbyt_mysql_schema.sql');
  let sql = fs.readFileSync(schemaFile, 'utf8');
  sql = sql.replace(/\bfindas_db\b/g, database);

  const conn = await mysql.createConnection({
    host,
    user,
    password,
    port,
    multipleStatements: true,
    charset: 'utf8mb4'
  });

  try {
    await conn.query(sql);
    console.log('Schema import completed successfully.');
  } finally {
    await conn.end();
  }
})().catch(err => {
  console.error('Schema import failed:', err.message);
  process.exit(1);
});
