import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (_req: Request, res: Response) => {
  res.json(db.prepare(`
    SELECT t.*, u.full_name as madar_name
    FROM teams t
    LEFT JOIN users u ON t.madar_user_id = u.id
    ORDER BY t.name
  `).all());
});

router.post('/', requireRole('manager'), (req: Request, res: Response) => {
  const { name, madar_user_id } = req.body;
  if (!name) {
    res.status(400).json({ error: 'שם נדרש' });
    return;
  }
  const result = db.prepare(
    'INSERT INTO teams (name, madar_user_id) VALUES (?, ?)'
  ).run(name, madar_user_id || null);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', requireRole('manager'), (req: Request, res: Response) => {
  const { name, madar_user_id } = req.body;
  const result = db.prepare(
    'UPDATE teams SET name = ?, madar_user_id = ? WHERE id = ?'
  ).run(name, madar_user_id || null, parseInt(req.params.id as string));
  if (result.changes === 0) {
    res.status(404).json({ error: 'צוות לא נמצא' });
    return;
  }
  res.json({ success: true });
});

router.delete('/:id', requireRole('manager'), (req: Request, res: Response) => {
  const result = db.prepare('DELETE FROM teams WHERE id = ?').run(parseInt(req.params.id as string));
  if (result.changes === 0) {
    res.status(404).json({ error: 'צוות לא נמצא' });
    return;
  }
  res.json({ success: true });
});

export default router;
