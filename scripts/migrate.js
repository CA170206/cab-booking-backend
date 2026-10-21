const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, '..', 'migrations', '001_create_payments_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Applying migration:', sqlPath);
    await pool.query(sql);
    console.log('Migration successfully applied!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
