/**
 * resend-verify.js — Force-unverify the admin account and send a fresh
 * verification email using the configured SMTP. Avoids shell-quoting issues.
 * Usage: node resend-verify.js
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const ADMIN_EMAIL = (process.env.ADMIN_EMAILS || 'latizylfiu@gmail.com').split(',')[0].trim().toLowerCase();

(async () => {
  const db = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smartgeoplanner',
  });

  try {
    // Reset the account to unverified so a new link can be sent.
    await db.query('UPDATE users SET is_email_verified = FALSE WHERE email = $1', [ADMIN_EMAIL]);

    // Trigger the resend endpoint on the running backend directly via HTTP.
    const http = require('http');
    const payload = JSON.stringify({ email: ADMIN_EMAIL });
    const result = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: 'localhost',
          port: parseInt(process.env.PORT || '3000'),
          path: '/api/auth/resend-verification',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve({ status: res.statusCode, body: data }));
        }
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    console.log('Reset user to unverified and triggered resend:');
    console.log('  status:', result.status);
    console.log('  body:', result.body);
    console.log('  APP_PUBLIC_BASE_URL =', process.env.APP_PUBLIC_BASE_URL || '(not set -> localhost)');
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();