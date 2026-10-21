const pool = require('../db');

async function testOtpAndJoinedData() {
  try {
    const res = await pool.query(
      `SELECT r.id, r.status, r.otp_code, p.full_name AS driver_name, p.upi_id
       FROM rides r
       LEFT JOIN profiles p ON r.driver_id = p.id
       ORDER BY r.created_at DESC LIMIT 2`
    );
    console.log('Sample rides query success! Count:', res.rows.length);
    console.log(res.rows);
    await pool.end();
  } catch (err) {
    console.error('Test error:', err.message);
    process.exit(1);
  }
}

testOtpAndJoinedData();
