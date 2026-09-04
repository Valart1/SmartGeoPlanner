import { pool } from './db';
import bcrypt from 'bcrypt';

/**
 * Migration script to migrate local AsyncStorage users to PostgreSQL
 * This script should be run once when deploying the backend
 */

async function migrate() {
  console.log('Starting migration...');

  // Create tables if they don't exist
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      username VARCHAR(100) UNIQUE NOT NULL,
      display_name VARCHAR(255),
      password_hash VARCHAR(255) NOT NULL,
      is_email_verified BOOLEAN DEFAULT FALSE,
      verification_code_hash VARCHAR(64),
      verification_expires_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
      status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed')),
      is_completed BOOLEAN NOT NULL DEFAULT FALSE,
      due_date DATE,
      due_time VARCHAR(10),
      location JSONB,
      notification_id VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      date DATE NOT NULL,
      start_time VARCHAR(10) NOT NULL,
      end_time VARCHAR(10) NOT NULL,
      color VARCHAR(20) NOT NULL,
      location JSONB,
      notification_id VARCHAR(255),
      is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `;

  try {
    await pool.query(schema);
    console.log('Tables created successfully');
    console.log('Migration completed!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();