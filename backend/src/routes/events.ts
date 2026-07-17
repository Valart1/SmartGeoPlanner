import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all events for user
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM events WHERE user_id = $1 ORDER BY date ASC, start_time ASC',
      [req.user!.id]
    );

    const events = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time,
      color: row.color,
      location: row.location,
      notificationId: row.notification_id,
      isAllDay: row.is_all_day,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({ events });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create event
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const { title, description, date, startTime, endTime, color, location, isAllDay } = req.body;

  if (!title || !date || !startTime || !endTime || !color) {
    return res.status(400).json({ error: 'Title, date, start time, end time, and color are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO events (user_id, title, description, date, start_time, end_time, color, location, is_all_day)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user!.id, title, description, date, startTime, endTime, color, location || null, isAllDay || false]
    );

    const event = result.rows[0];
    res.status(201).json({
      event: {
        id: event.id,
        userId: event.user_id,
        title: event.title,
        description: event.description,
        date: event.date,
        startTime: event.start_time,
        endTime: event.end_time,
        color: event.color,
        location: event.location,
        notificationId: event.notification_id,
        isAllDay: event.is_all_day,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
      }
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update event
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Verify event belongs to user
    const existing = await pool.query(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [id, req.user!.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Build update query
    const setClause = Object.keys(updates)
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');

    const values = [id, ...Object.values(updates)];

    const result = await pool.query(
      `UPDATE events SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );

    const event = result.rows[0];
    res.json({
      event: {
        id: event.id,
        userId: event.user_id,
        title: event.title,
        description: event.description,
        date: event.date,
        startTime: event.start_time,
        endTime: event.end_time,
        color: event.color,
        location: event.location,
        notificationId: event.notification_id,
        isAllDay: event.is_all_day,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
      }
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete event
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM events WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user!.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event deleted' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;