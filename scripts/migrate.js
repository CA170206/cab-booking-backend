const fs = require('fs');
const path = require('path');
const defaultPool = require('../db');
const { ensureDemoAccounts } = require('./seed-demo');

async function runMigrations(customPool = null, options = { silent: false }) {
  const pool = customPool || defaultPool;
  const isDirectRun = !customPool;

  try {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    
    for (const file of files) {
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      if (!options.silent) console.log('Applying migration:', file);
      await pool.query(sql);
      if (!options.silent) console.log('Successfully applied:', file);
    }

    // Automatically ensure demo accounts exist
    await ensureDemoAccounts(pool);
    if (!options.silent) console.log('All migrations and seeds applied successfully.');
    return { success: true };
  } catch (err) {
    console.error('Migration failed:', err.message);
    if (isDirectRun) {
      process.exit(1);
    }
    throw err;
  } finally {
    if (isDirectRun) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
