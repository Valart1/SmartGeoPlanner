import { Router } from 'express';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * Register (or refresh) the current user's Expo push token.
 * Body: { token: string, platform?: 'android' | 'ios' }
 */
router.post('/register-token', authMiddleware, async (req: AuthRequest, res) => {
  const { token, platform } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Push token is required' });
  }

  try {
    await pool.query(
      `INSERT INTO push_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, token) DO UPDATE
         SET platform = EXCLUDED.platform, updated_at = CURRENT_TIMESTAMP`,
      [req.user!.id, token, platform || 'android']
    );

    res.json({ message: 'Push token registered' });
  } catch (error) {
    console.error('Register push token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Remove the current user's push token (e.g. on logout).
 * Body: { token: string }
 */
router.post('/unregister-token', authMiddleware, async (req: AuthRequest, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Push token is required' });
  }

  try {
    await pool.query('DELETE FROM push_tokens WHERE user_id = $1 AND token = $2', [
      req.user!.id,
      token,
    ]);
    res.json({ message: 'Push token removed' });
  } catch (error) {
    console.error('Unregister push token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;