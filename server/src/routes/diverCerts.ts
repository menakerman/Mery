import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Get certifications for a diver
router.get('/:diverId', (req: Request, res: Response) => {
  const diverId = parseInt(req.params.diverId as string);
  const { role, teamId, diverId: authDiverId } = req.auth!;

  if (role === 'diver' && diverId !== authDiverId) {
    res.status(403).json({ error: 'אין הרשאה' });
    return;
  }

  if (role === 'madar') {
    const diver = db.prepare('SELECT team_id FROM divers WHERE id = ?').get(diverId) as any;
    if (!diver || diver.team_id !== teamId) {
      res.status(403).json({ error: 'אין הרשאה' });
      return;
    }
  }

  const certs = db.prepare(`
    SELECT dc.*, cl.name as level_name, cl.description as level_description
    FROM diver_certifications dc
    JOIN certification_levels cl ON dc.certification_level_id = cl.id
    WHERE dc.diver_id = ?
    ORDER BY dc.expiry_date DESC, cl.sort_order
  `).all(diverId);

  res.json(certs);
});

// Add certification
router.post('/', requireRole('manager', 'secretary', 'madar'), (req: Request, res: Response) => {
  const { diver_id, certification_level_id, expiry_date, issued_date, notes } = req.body;

  if (!diver_id || !certification_level_id) {
    res.status(400).json({ error: 'צולל ורמת הסמכה נדרשים' });
    return;
  }

  if (req.auth!.role === 'madar') {
    const diver = db.prepare('SELECT team_id FROM divers WHERE id = ?').get(diver_id) as any;
    if (!diver || diver.team_id !== req.auth!.teamId) {
      res.status(403).json({ error: 'אין הרשאה' });
      return;
    }
  }

  const result = db.prepare(`
    INSERT INTO diver_certifications (diver_id, certification_level_id, expiry_date, issued_date, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(diver_id, certification_level_id, expiry_date || null, issued_date || null, notes || '');

  res.status(201).json({ id: result.lastInsertRowid });
});

// Update certification
router.put('/:id', requireRole('manager', 'secretary', 'madar'), (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const { certification_level_id, expiry_date, issued_date, notes } = req.body;

  if (req.auth!.role === 'madar') {
    const cert = db.prepare(`
      SELECT dc.diver_id, d.team_id FROM diver_certifications dc
      JOIN divers d ON dc.diver_id = d.id WHERE dc.id = ?
    `).get(id) as any;
    if (!cert || cert.team_id !== req.auth!.teamId) {
      res.status(403).json({ error: 'אין הרשאה' });
      return;
    }
  }

  const result = db.prepare(`
    UPDATE diver_certifications SET certification_level_id = ?, expiry_date = ?, issued_date = ?, notes = ?
    WHERE id = ?
  `).run(certification_level_id, expiry_date || null, issued_date || null, notes || '', id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'הסמכה לא נמצאה' });
    return;
  }
  res.json({ success: true });
});

// Delete certification
router.delete('/:id', requireRole('manager', 'secretary', 'madar'), (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);

  if (req.auth!.role === 'madar') {
    const cert = db.prepare(`
      SELECT dc.diver_id, d.team_id FROM diver_certifications dc
      JOIN divers d ON dc.diver_id = d.id WHERE dc.id = ?
    `).get(id) as any;
    if (!cert || cert.team_id !== req.auth!.teamId) {
      res.status(403).json({ error: 'אין הרשאה' });
      return;
    }
  }

  const result = db.prepare('DELETE FROM diver_certifications WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'הסמכה לא נמצאה' });
    return;
  }
  res.json({ success: true });
});

export default router;
