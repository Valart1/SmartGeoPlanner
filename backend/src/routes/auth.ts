import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendVerificationEmail } from '../services/mailer';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const VERIFICATION_CODE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a long, random one-time verification token (used in email links). */
function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Hash the raw verification token so a leaked DB dump can't be replayed. */
function hashVerificationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Public base URL the phone's browser can reach for the verify link. */
function publicBaseUrl(): string {
  return (process.env.APP_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/** Build the one-click verification link embedded in the email. */
function buildVerifyUrl(token: string): string {
  return `${publicBaseUrl()}/api/auth/verify-email?token=${token}`;
}

function signToken(user: { id: string; email: string; username: string }): string {
  const secret = process.env.JWT_SECRET || 'default_secret';
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    secret,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
  );
}

/** Map a snake_case users row to the camelCase User the app expects. */
function mapUser(row: any) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    isEmailVerified: row.is_email_verified,
    isAdmin: row.is_admin,
    createdAt: row.created_at,
  };
}

/** Render the confirmation HTML page shown after clicking the verify link. */
function renderVerifyPage(title: string, message: string, ok: boolean): string {
  const icon = ok ? '✅' : '⚠️';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title} — Smart Geo-Planner</title>
</head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#0F0E1A;color:#FFFFFF;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="max-width:420px;margin:24px;padding:32px;background:#1C1A2E;border-radius:16px;border:1px solid #2E2C45;text-align:center;">
    <div style="font-size:56px;margin-bottom:16px;">${icon}</div>
    <h1 style="font-size:24px;margin:0 0 12px 0;">${title}</h1>
    <p style="color:#B0AECF;line-height:22px;margin:0 0 24px 0;">${message}</p>
    <p style="color:#6B6987;font-size:13px;margin:0;">You can now return to the Smart Geo-Planner app.</p>
  </div>
</body>
</html>`;
}

// Register
router.post('/register', async (req, res) => {
  const { email, username, password, displayName } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Email, username, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const emailKey = String(email).trim().toLowerCase();
  const usernameKey = String(username).trim().toLowerCase();

  if (!EMAIL_REGEX.test(emailKey)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  try {
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [emailKey, usernameKey]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Emails listed in ADMIN_EMAILS (comma-separated) are always created as admins
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = adminEmails.includes(emailKey);

    // Email verification token (valid 24h) — one-click link is sent by email.
    const verificationToken = generateVerificationToken();
    const tokenHash = hashVerificationToken(verificationToken);
    const verificationExpiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

    // Create user — always created UNVERIFIED until the email is confirmed.
    const result = await pool.query(
      `INSERT INTO users (email, username, display_name, password_hash,
                          is_email_verified, is_admin, verification_code_hash, verification_expires_at)
       VALUES ($1, $2, $3, $4, FALSE, $7, $5, $6)
       RETURNING id, email, username, display_name, is_email_verified, is_admin, created_at`,
      [emailKey, usernameKey, displayName || username, passwordHash, tokenHash, verificationExpiresAt, isAdmin]
    );

    const user = result.rows[0];

    // Email the one-click verify link (or log it loudly in dev mode).
    const verifyUrl = buildVerifyUrl(verificationToken);
    let mailResult: Awaited<ReturnType<typeof sendVerificationEmail>> = { delivered: false, mode: 'dev' };
    try {
      mailResult = await sendVerificationEmail(emailKey, verifyUrl);
    } catch (mailError) {
      console.error('[auth] Verification email failed to send:', mailError);
    }

    // NOTE: no JWT is issued — the account must be verified before sign-in.
    res.status(201).json({
      user: mapUser(user),
      requiresEmailVerification: true,
      // Dev convenience: when SMTP is not configured the link is returned so
      // the flow can be tested locally. Never sent in SMTP (production) mode.
      ...(mailResult.mode === 'dev' ? { devVerifyUrl: verifyUrl } : {}),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify email — one-click magic link.
// The email contains a /verify-email?token=... link the user taps in their
// inbox; this GET endpoint marks the account verified and returns an HTML page.
router.get('/verify-email', async (req, res) => {
  const token = String(req.query.token ?? '').trim();

  if (!token) {
    return res
      .status(400)
      .send(renderVerifyPage('Invalid link', 'This verification link is invalid. Please request a new one.', false));
  }

  try {
    const tokenHash = hashVerificationToken(token);

    const result = await pool.query(
      'SELECT id, email, username, display_name, is_email_verified, is_admin, created_at, verification_code_hash, verification_expires_at FROM users WHERE verification_code_hash = $1',
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res
        .status(400)
        .send(renderVerifyPage('Invalid link', 'This verification link is invalid or has already been used. Request a new one and try again.', false));
    }

    const user = result.rows[0];

    if (user.is_email_verified) {
      return res
        .status(200)
        .send(renderVerifyPage('Already verified', 'Your email is already verified — you can sign in to the app.', true));
    }

    if (!user.verification_expires_at || new Date(user.verification_expires_at).getTime() < Date.now()) {
      return res
        .status(400)
        .send(renderVerifyPage('Link expired', 'This verification link has expired. Request a new one from the app.', false));
    }

    // Success — mark verified and consume the token.
    await pool.query(
      `UPDATE users SET is_email_verified = TRUE, verification_code_hash = NULL, verification_expires_at = NULL
       WHERE id = $1`,
      [user.id]
    );

    return res
      .status(200)
      .send(renderVerifyPage('Email verified ✓', 'Your Smart Geo-Planner account is now active. Open the app and sign in.', true));
  } catch (error) {
    console.error('Verify email error:', error);
    return res
      .status(500)
      .send(renderVerifyPage('Something went wrong', 'Unable to verify your email right now. Please try again later.', false));
  }
});

// Resend verification link
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const emailKey = String(email).trim().toLowerCase();

  try {
    const result = await pool.query(
      'SELECT id, email, is_email_verified FROM users WHERE email = $1',
      [emailKey]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No account found for that email.' });
    }

    const user = result.rows[0];

    if (user.is_email_verified) {
      return res.json({ message: 'That email is already verified.' });
    }

    const verificationToken = generateVerificationToken();
    const tokenHash = hashVerificationToken(verificationToken);
    const verificationExpiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

    await pool.query(
      'UPDATE users SET verification_code_hash = $1, verification_expires_at = $2 WHERE id = $3',
      [tokenHash, verificationExpiresAt, user.id]
    );

    const verifyUrl = buildVerifyUrl(verificationToken);
    let mailResult;
    try {
      mailResult = await sendVerificationEmail(emailKey, verifyUrl);
    } catch (mailError) {
      console.error('[auth] Resend verification email failed:', mailError);
      return res.status(500).json({ error: 'Failed to resend the verification email.' });
    }

    res.json({
      message: 'A new verification link has been sent.',
      ...(mailResult.mode === 'dev' ? { devVerifyUrl: verifyUrl } : {}),
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Email/username and password are required' });
  }

  try {
    const identifierKey = identifier.trim().toLowerCase();

    // Find user
    const result = await pool.query(
      'SELECT id, email, username, display_name, password_hash, is_email_verified, is_admin, created_at FROM users WHERE email = $1 OR username = $2',
      [identifierKey, identifierKey]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email/username or password' });
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email/username or password' });
    }

    // Email verification gate
    if (!user.is_email_verified) {
      return res.status(403).json({
        error: 'Please verify your email before signing in. Check your inbox for the verification code.',
        needsVerification: true,
        email: user.email,
      });
    }

    // Generate JWT token
    const secret = process.env.JWT_SECRET || 'default_secret';
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      secret,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        isEmailVerified: user.is_email_verified,
        isAdmin: user.is_admin,
        createdAt: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, username, display_name, is_email_verified, is_admin, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        isEmailVerified: user.is_email_verified,
        isAdmin: user.is_admin,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Password-reset placeholder. This checks the backend only; no local account
// fallback exists in the frontend.
router.post('/forgot-password', async (req, res) => {
  const { identifier } = req.body;

  if (!identifier) {
    return res.status(400).json({ error: 'Email or username is required' });
  }

  try {
    const identifierKey = String(identifier).trim().toLowerCase();
    const result = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $1',
      [identifierKey]
    );

    res.json({ exists: result.rows.length > 0 });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout (client-side token removal)
router.post('/logout', authMiddleware, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Delete current user account. Related tasks/events are removed by ON DELETE CASCADE.
router.delete('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [req.user!.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Account deleted' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
