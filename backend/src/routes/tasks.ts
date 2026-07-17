import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all tasks for user
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user!.id]
    );

    const tasks = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      isCompleted: row.is_completed,
      dueDate: row.due_date,
      dueTime: row.due_time,
      location: row.location,
      notificationId: row.notification_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create task
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const { title, description, priority, status, isCompleted, dueDate, dueTime, location } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tasks (user_id, title, description, priority, status, is_completed, due_date, due_time, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user!.id, title, description, priority || 'medium', status || 'pending', isCompleted || false, dueDate, dueTime, location || null]
    );

    const task = result.rows[0];
    res.status(201).json({
      task: {
        id: task.id,
        userId: task.user_id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        isCompleted: task.is_completed,
        dueDate: task.due_date,
        dueTime: task.due_time,
        location: task.location,
        notificationId: task.notification_id,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      }
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Verify task belongs to user
    const existing = await pool.query(
      'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
      [id, req.user!.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Build update query
    const setClause = Object.keys(updates)
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');

    const values = [id, ...Object.values(updates)];

    const result = await pool.query(
      `UPDATE tasks SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );

    const task = result.rows[0];
    res.json({
      task: {
        id: task.id,
        userId: task.user_id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        isCompleted: task.is_completed,
        dueDate: task.due_date,
        dueTime: task.due_time,
        location: task.location,
        notificationId: task.notification_id,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      }
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete task
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user!.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;