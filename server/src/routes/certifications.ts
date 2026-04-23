import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (_req: Request, res: Response) => {
  res.json(db.prepare('SELECT * FROM certification_levels ORDER BY sort_order, name').all());
});

router.post('/', requireRole('manager'), (req: Request, res: Response) => {
  const { name, description, sort_order } = req.body;
  if (!name) {
    res.status(400).json({ error: 'שם נדרש' });
    return;
  }
  const result = db.prepare(
    'INSERT INTO certification_levels (name, description, sort_order) VALUES (?, ?, ?)'
  ).run(name, description || '', sort_order || 0);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', requireRole('manager'), (req: Request, res: Response) => {
  const { name, description, sort_order } = req.body;
  const result = db.prepare(
    'UPDATE certification_levels SET name = ?, description = ?, sort_order = ? WHERE id = ?'
  ).run(name, description || '', sort_order || 0, parseInt(req.params.id as string));
  if (result.changes === 0) {
    res.status(404).json({ error: 'רמת הסמכה לא נמצאה' });
    return;
  }
  res.json({ success: true });
});

router.delete('/:id', requireRole('manager'), (req: Request, res: Response) => {
  const result = db.prepare('DELETE FROM certification_levels WHERE id = ?').run(parseInt(req.params.id as string));
  if (result.changes === 0) {
    res.status(404).json({ error: 'רמת הסמכה לא נמצאה' });
    return;
  }
  res.json({ success: true });
});

export default router;
