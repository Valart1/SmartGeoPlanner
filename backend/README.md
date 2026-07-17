# SmartGeoPlanner Backend

A Node.js/Express backend API for SmartGeoPlanner using PostgreSQL.

## Setup Instructions

### 1. Install PostgreSQL 18
Make sure PostgreSQL 18 is installed and running on your system.

### 2. Create Database
```sql
CREATE DATABASE smartgeoplanner;
```

### 3. Install Dependencies
```bash
cd backend
npm install
```

### 4. Configure Environment
Copy `.env.example` to `.env` and update the values:
```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL credentials:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=smartgeoplanner
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d
PORT=3000
```

### 5. Run Migration
```bash
npm run migrate
```

### 6. Start Server
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)
- `POST /api/auth/logout` - Logout user

### Tasks
- `GET /api/tasks` - Get all tasks for user
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Events
- `GET /api/events` - Get all events for user
- `POST /api/events` - Create new event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

## Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Database Schema

### users
- `id` (UUID) - Primary key
- `email` (string) - Unique email
- `username` (string) - Unique username
- `display_name` (string) - Optional display name
- `password_hash` (string) - Bcrypt hashed password
- `is_email_verified` (boolean)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### tasks
- `id` (UUID) - Primary key
- `user_id` (UUID) - Foreign key to users
- `title` (string)
- `description` (text)
- `priority` (enum: low, medium, high)
- `status` (enum: pending, in_progress, completed)
- `is_completed` (boolean)
- `due_date` (date)
- `due_time` (string)
- `location` (jsonb)
- `notification_id` (string)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### events
- `id` (UUID) - Primary key
- `user_id` (UUID) - Foreign key to users
- `title` (string)
- `description` (text)
- `date` (date)
- `start_time` (string)
- `end_time` (string)
- `color` (string)
- `location` (jsonb)
- `notification_id` (string)
- `is_all_day` (boolean)
- `created_at` (timestamp)
- `updated_at` (timestamp)

## Security Features
- Bcrypt password hashing
- JWT token authentication
- Row-level security (users can only access their own data)
- Helmet for security headers
- CORS enabled
- Input validation

## Next Steps
After setting up the backend, you'll need to update the React Native app to use the API instead of AsyncStorage. See the frontend integration guide for details.