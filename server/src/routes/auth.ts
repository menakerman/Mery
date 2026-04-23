import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db';
import { signToken, authenticate, requireRole } from '../middleware/auth';

const MAX_ATTEMPTS = 3;
const LOCKOUT_HOURS = 12;

const router = Router();

function logLoginAttempt(username: string, fullName: string, success: boolean, ip: string, reason: string) {
  db.prepare(
    'INSERT INTO user_login_log (username, full_name, success, ip_address, reason) VALUES (?, ?, ?, ?, ?)'
  ).run(username, fullName, success ? 1 : 0, ip, reason);
}

function checkLockout(username: string): string | null {
  const attempts = db.prepare(
    'SELECT * FROM user_login_attempts WHERE username = ?'
  ).get(username) as any;

  if (attempts?.locked_until && new Date(attempts.locked_until + 'Z') > new Date()) {
    const unlockTime = new Date(attempts.locked_until + 'Z');
    return `החשבון נעול. נסה שוב אחרי ${unlockTime.toLocaleString('he-IL')}`;
  }
  return null;
}

function recordFailedAttempt(username: string): { locked: boolean; remaining: number } {
  const attempts = db.prepare(
    'SELECT * FROM user_login_attempts WHERE username = ?'
  ).get(username) as any;

  if (attempts) {
    const newCount = attempts.failed_attempts + 1;
    if (newCount >= MAX_ATTEMPTS) {
      db.prepare(
        `UPDATE user_login_attempts SET failed_attempts = ?, locked_until = datetime('now', '+${LOCKOUT_HOURS} hours'), last_attempt_at = datetime('now') WHERE username = ?`
      ).run(newCount, username);
      return { locked: true, remaining: 0 };
    }
    db.prepare(
      `UPDATE user_login_attempts SET failed_attempts = ?, last_attempt_at = datetime('now') WHERE username = ?`
    ).run(newCount, username);
    return { locked: false, remaining: MAX_ATTEMPTS - newCount };
  } else {
    db.prepare(
      'INSERT INTO user_login_attempts (username, failed_attempts) VALUES (?, 1)'
    ).run(username);
    return { locked: false, remaining: MAX_ATTEMPTS - 1 };
  }
}

function resetAttempts(username: string) {
  db.prepare(
    'UPDATE user_login_attempts SET failed_attempts = 0, locked_until = NULL WHERE username = ?'
  ).run(username);
}

// Step 1: Verify username + password
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'שם משתמש וסיסמה נדרשים' });
    return;
  }

  const ip = req.ip || '';

  // Check lockout
  const lockMsg = checkLockout(username);
  if (lockMsg) {
    logLoginAttempt(username, '', false, ip, 'חשבון נעול');
    res.status(403).json({ error: lockMsg });
    return;
  }

  const user = db.prepare(
    'SELECT id, username, password_hash, full_name, role, team_id, diver_id FROM users WHERE username = ?'
  ).get(username) as any;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    const result = recordFailedAttempt(username);
    const reason = result.locked
      ? `ננעל אחרי ${MAX_ATTEMPTS} ניסיונות כושלים`
      : 'סיסמה שגויה';
    logLoginAttempt(username, user?.full_name || '', false, ip, reason);

    if (result.locked) {
      res.status(403).json({ error: `החשבון ננעל ל-${LOCKOUT_HOURS} שעות עקב ${MAX_ATTEMPTS} ניסיונות כושלים` });
    } else {
      res.status(401).json({ error: `שם משתמש או סיסמה שגויים. נותרו ${result.remaining} ניסיונות` });
    }
    return;
  }

  // Password correct - reset attempts, proceed to OTP
  resetAttempts(username);
  console.log(`[Staff OTP] ${user.full_name} (${user.username}): 150475`);

  res.json({
    pending_user_id: user.id,
    full_name: user.full_name,
  });
});

// Step 2: Verify OTP and issue token
router.post('/verify-otp', (req: Request, res: Response) => {
  const { pending_user_id, code } = req.body;
  if (!pending_user_id || !code) {
    res.status(400).json({ error: 'קוד אימות נדרש' });
    return;
  }

  const STAFF_OTP = '150475';
  const ip = req.ip || '';

  const user = db.prepare(
    'SELECT id, username, full_name, role, team_id, diver_id FROM users WHERE id = ?'
  ).get(pending_user_id) as any;

  if (!user) {
    res.status(404).json({ error: 'משתמש לא נמצא' });
    return;
  }

  if (code.trim() !== STAFF_OTP) {
    logLoginAttempt(user.username, user.full_name, false, ip, 'קוד OTP שגוי');
    res.status(401).json({ error: 'קוד אימות שגוי' });
    return;
  }

  // Success
  logLoginAttempt(user.username, user.full_name, true, ip, 'התחברות מוצלחת');

  const token = signToken({
    userId: user.id,
    role: user.role,
    teamId: user.team_id,
    diverId: user.diver_id,
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      team_id: user.team_id,
      diver_id: user.diver_id,
      created_at: '',
    },
  });
});

// Get user login log - manager only
router.get('/login-log', authenticate, requireRole('manager'), (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const offset = parseInt(req.query.offset as string) || 0;

  const rows = db.prepare(
    'SELECT * FROM user_login_log ORDER BY attempted_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM user_login_log').get() as { count: number };

  res.json({ rows, total: total.count });
});

router.get('/me', authenticate, (req: Request, res: Response) => {
  const user = db.prepare(
    'SELECT id, username, full_name, role, team_id, diver_id, created_at FROM users WHERE id = ?'
  ).get(req.auth!.userId) as any;
  if (!user) {
    res.status(404).json({ error: 'משתמש לא נמצא' });
    return;
  }
  res.json(user);
});

export default router;
