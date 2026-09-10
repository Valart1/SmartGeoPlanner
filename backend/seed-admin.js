/**
 * seed-admin.js – Create (or update) the default admin account.
 * Usage: node seed-admin.js
 * Reads ADMIN_EMAILS, DB_* from .env. Password fixed via ADMIN_SEED_PASSWORD or default below.
 */
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ADMIN_EMAIL = (process.env.ADMIN_EMAILS || 'latizylfiu@gmail.com').split(',')[0].trim().toLowerCase();
const ADMIN_USERNAME = ADMIN_EMAIL.split('@')[0];
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || 'valart2002';

(async () => {
  const db = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smartgeoplanner',
  });

  try {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const existing = await db.query('SELECT id FROM users WHERE email = $1 OR username = $2', [ADMIN_EMAIL, ADMIN_USERNAME]);

    if (existing.rows.length > 0) {
      await db.query(
        'UPDATE users SET is_admin = TRUE, password_hash = $1 WHERE id = $2',
        [passwordHash, existing.rows[0].id]
      );
      console.log(`Admin account updated: ${ADMIN_EMAIL} (password reset, admin ensured)`);
    } else {
      await db.query(
        `INSERT INTO users (email, username, display_name, password_hash, is_email_verified, is_admin)
         VALUES ($1, $2, $3, $4, TRUE, TRUE)`,
        [ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_USERNAME, passwordHash]
      );
      console.log(`Admin account created: ${ADMIN_EMAIL}`);
    }
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
