const pool = require('../db');

async function checkSchema() {
  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('Tables in database:', tables.rows.map(r => r.table_name));

    for (const row of tables.rows) {
      const cols = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [row.table_name]);
      console.log(`\nColumns in table '${row.table_name}':`, cols.rows);
    }
  } catch (err) {
    console.error('Schema check failed:', err.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
