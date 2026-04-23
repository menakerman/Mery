import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db';
import { signToken, authenticate } from '../middleware/auth';

const router = Router();

// Step 1: Verify username + password, return pending_user_id
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'שם משתמש וסיסמה נדרשים' });
    return;
  }

  const user = db.prepare(
    'SELECT id, username, password_hash, full_name, role, team_id, diver_id FROM users WHERE username = ?'
  ).get(username) as any;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
    return;
  }

  // Don't issue token yet - require OTP
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

  // Hardcoded OTP for staff
  const STAFF_OTP = '150475';

  if (code.trim() !== STAFF_OTP) {
    res.status(401).json({ error: 'קוד אימות שגוי' });
    return;
  }

  const user = db.prepare(
    'SELECT id, username, full_name, role, team_id, diver_id FROM users WHERE id = ?'
  ).get(pending_user_id) as any;

  if (!user) {
    res.status(404).json({ error: 'משתמש לא נמצא' });
    return;
  }

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
