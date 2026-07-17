import { Router } from 'express';
import { pool } from '../db';
import { adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * Get all users (admin only)
 * GET /api/admin/users
 */
router.get('/users', adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT id, email, username, display_name, is_email_verified, is_admin, created_at, updated_at 
      FROM users 
      ORDER BY created_at DESC
    `);

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all tasks (admin only)
 * GET /api/admin/tasks
 */
router.get('/tasks', adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, u.email, u.username, u.display_name as user_display_name
      FROM tasks t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
    `);

    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Get all tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all events (admin only)
 * GET /api/admin/events
 */
router.get('/events', adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, u.email, u.username, u.display_name as user_display_name
      FROM events e
      JOIN users u ON e.user_id = u.id
      ORDER BY e.created_at DESC
    `);

    res.json({ events: result.rows });
  } catch (error) {
    console.error('Get all events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get dashboard statistics (admin only)
 * GET /api/admin/stats
 */
router.get('/stats', adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const [usersCount, tasksCount, eventsCount, completedTasks] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM tasks'),
      pool.query('SELECT COUNT(*) FROM events'),
      pool.query('SELECT COUNT(*) FROM tasks WHERE is_completed = TRUE'),
    ]);

    res.json({
      stats: {
        totalUsers: parseInt(usersCount.rows[0].count),
        totalTasks: parseInt(tasksCount.rows[0].count),
        totalEvents: parseInt(eventsCount.rows[0].count),
        completedTasks: parseInt(completedTasks.rows[0].count),
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;