import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all events (shared calendar: every user sees every event)
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, u.username AS creator_username, u.email AS creator_email
       FROM events e
       JOIN users u ON e.user_id = u.id
       ORDER BY e.date ASC, e.start_time ASC`
    );

    const events = result.rows.map((row: any) => ({
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
      creatorUsername: row.creator_username,
      creatorEmail: row.creator_email,
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
  const body = req.body ?? {};

  try {
    // Verify event belongs to user
    const existing = await pool.query(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [id, req.user!.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Map allowed camelCase fields → snake_case columns (injection-safe, matches
    // the camelCase model the frontend sends).
    const fieldMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      date: 'date',
      startTime: 'start_time',
      endTime: 'end_time',
      color: 'color',
      location: 'location',
      notificationId: 'notification_id',
      isAllDay: 'is_all_day',
    };

    const updates = Object.keys(body)
      .filter(key => key in fieldMap)
      .map(key => ({ column: fieldMap[key], value: body[key] }));

    if (updates.length === 0) {
      const current = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
      const event = current.rows[0];
      return res.json({
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
    }

    const setClause = updates.map((u, i) => `${u.column} = $${i + 1}`).join(', ');
    const values = updates.map(u => u.value);

    const result = await pool.query(
      `UPDATE events SET ${setClause} WHERE id = $${updates.length + 1} RETURNING *`,
      [...values, id]
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

// Delete event. The creator can always delete; admins may delete any event.
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const existing = await pool.query(
      'SELECT user_id FROM events WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (existing.rows[0].user_id !== req.user!.id) {
      const adminCheck = await pool.query(
        'SELECT is_admin FROM users WHERE id = $1',
        [req.user!.id]
      );
      if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
        return res.status(403).json({ error: 'You can only delete events you created' });
      }
    }

    const result = await pool.query(
      'DELETE FROM events WHERE id = $1 RETURNING id',
      [id]
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
