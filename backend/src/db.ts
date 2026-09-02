import { Pool, types } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Dates.
// node-postgres parses date-only values using the server's local timezone,
// which shifts the calendar day when the Date is serialized to JSON in any
// timezone east of UTC (e.g. stored 2026-09-05 → "2026-09-04T22:00:00.000Z").
// The frontend then truncates the ISO string and gets the wrong day, so
// same-day events/tasks appear to be "in the past" and are hidden.
types.setTypeParser(types.builtins.DATE, (value) => value);

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smartgeoplanner',
});

export default pool;