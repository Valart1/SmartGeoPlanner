import http from 'http';
import app from './app';
import dotenv from 'dotenv';
import { pool } from './db';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Ensure accounts whose email is listed in ADMIN_EMAILS always stay admin,
// even if the flag was removed manually.
async function ensureAdmins(): Promise<void> {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.length === 0) return;
  try {
    const result = await pool.query(
      'UPDATE users SET is_admin = TRUE WHERE email = ANY($1) RETURNING email',
      [adminEmails]
    );
    result.rows.forEach((row) => console.log(`[admin] ${row.email} granted admin rights`));
  } catch (err) {
    console.error('[admin] Failed to ensure admin accounts:', err);
  }
}

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  void ensureAdmins();
});