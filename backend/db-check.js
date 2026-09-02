/**
 * db-check.js – Quick database inspection utility.
 * Usage: node db-check.js
 * Shows all users (with admin flag) and row counts for tasks/events.
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

(async () => {
  const db = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smartgeoplanner',
  });

  try {
    const users = await db.query(
      `SELECT username, email, display_name, is_admin, is_email_verified, created_at
       FROM users ORDER BY created_at ASC`
    );
    const counts = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM users) AS total_users,
         (SELECT COUNT(*) FROM users WHERE is_admin) AS total_admins,
         (SELECT COUNT(*) FROM tasks) AS total_tasks,
         (SELECT COUNT(*) FROM events) AS total_events`
    );

    console.log('=== COUNTS ===');
    console.log(JSON.stringify(counts.rows[0], null, 2));
    console.log('=== USERS ===');
    if (users.rows.length === 0) {
      console.log('No users found.');
    } else {
      users.rows.forEach((u, i) => {
        console.log(
          `${i + 1}. ${u.username} <${u.email}>` +
          ` | admin: ${u.is_admin}` +
          ` | created: ${u.created_at.toISOString()}`
        );
      });
    }
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();