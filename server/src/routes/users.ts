import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import db from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(requireRole('manager'));

router.get('/', (_req: Request, res: Response) => {
  res.json(
    db.prepare('SELECT id, username, full_name, role, team_id, diver_id, created_at FROM users ORDER BY full_name').all()
  );
});

router.post('/', (req: Request, res: Response) => {
  const { username, password, full_name, role, team_id, diver_id } = req.body;
  if (!username || !password || !full_name || !role) {
    res.status(400).json({ error: 'כל השדות נדרשים' });
    return;
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, full_name, role, team_id, diver_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(username, hash, full_name, role, team_id || null, diver_id || null);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'שם משתמש כבר קיים' });
      return;
    }
    throw e;
  }
});

router.put('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const { username, password, full_name, role, team_id, diver_id } = req.body;

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(
      'UPDATE users SET username = ?, password_hash = ?, full_name = ?, role = ?, team_id = ?, diver_id = ? WHERE id = ?'
    ).run(username, hash, full_name, role, team_id || null, diver_id || null, id);
  } else {
    db.prepare(
      'UPDATE users SET username = ?, full_name = ?, role = ?, team_id = ?, diver_id = ? WHERE id = ?'
    ).run(username, full_name, role, team_id || null, diver_id || null, id);
  }

  res.json({ success: true });
});

router.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (id === req.auth!.userId) {
    res.status(400).json({ error: 'לא ניתן למחוק את המשתמש הנוכחי' });
    return;
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
