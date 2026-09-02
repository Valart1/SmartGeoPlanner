const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '',
  database: 'smartgeoplanner',
});

(async () => {
  try {
    const users = await pool.query(
      `SELECT id, email, username, display_name, is_email_verified, is_admin, created_at
       FROM users ORDER BY created_at ASC`
    );
    const counts = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM users) AS total_users,
         (SELECT COUNT(*) FROM users WHERE is_admin = TRUE) AS total_admins,
         (SELECT COUNT(*) FROM tasks) AS total_tasks,
         (SELECT COUNT(*) FROM events) AS total_events`
    );
    console.log('=== COUNTS ===');
    console.log(JSON.stringify(counts.rows[0], null, 2));
    console.log('=== USERS ===');
    if (users.rows.length === 0) {
      console.log('No users found in the database.');
    } else {
      users.rows.forEach((u, i) => {
        console.log(
          `${i + 1}. ${u.username} <${u.email}>` +
          ` | display_name: ${u.display_name || '-'}` +
          ` | is_admin: ${u.is_admin}` +
          ` | email_verified: ${u.is_email_verified}` +
          ` | created: ${u.created_at}`
        );
      });
    }
  } catch (err) {
    console.error('QUERY ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();