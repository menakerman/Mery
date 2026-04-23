import { Router, Request, Response } from 'express';
import db from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

function enrichDiver(diver: any) {
  const certs = db.prepare(`
    SELECT dc.*, cl.name as level_name FROM diver_certifications dc
    JOIN certification_levels cl ON dc.certification_level_id = cl.id
    WHERE dc.diver_id = ? ORDER BY cl.sort_order
  `).all(diver.id) as any[];

  const teams = db.prepare(`
    SELECT t.id, t.name FROM diver_teams dt
    JOIN teams t ON dt.team_id = t.id
    WHERE dt.diver_id = ? ORDER BY t.name
  `).all(diver.id) as any[];

  return {
    ...diver,
    certifications: certs,
    certification_names: certs.map((c: any) => c.level_name).join(', ') || '-',
    teams,
    team_names: teams.map((t: any) => t.name).join(', ') || '-',
  };
}

function diverIsInTeam(diverId: number, teamId: number | null): boolean {
  if (!teamId) return false;
  const row = db.prepare('SELECT 1 FROM diver_teams WHERE diver_id = ? AND team_id = ?').get(diverId, teamId);
  return !!row;
}

// Get all divers (filtered by role)
router.get('/', (req: Request, res: Response) => {
  const { role, teamId, diverId } = req.auth!;

  let baseQuery = 'SELECT d.* FROM divers d';
  let rows: any[];

  if (role === 'diver') {
    if (!diverId) { res.json([]); return; }
    rows = [db.prepare(baseQuery + ' WHERE d.id = ?').get(diverId)].filter(Boolean);
  } else if (role === 'madar') {
    rows = db.prepare(
      baseQuery + ' WHERE d.id IN (SELECT diver_id FROM diver_teams WHERE team_id = ?) ORDER BY d.last_name, d.first_name'
    ).all(teamId) as any[];
  } else {
    const search = req.query.search as string;
    if (search) {
      const s = `%${search}%`;
      rows = db.prepare(
        baseQuery + ' WHERE d.first_name LIKE ? OR d.last_name LIKE ? OR d.id_number LIKE ? ORDER BY d.last_name, d.first_name'
      ).all(s, s, s) as any[];
    } else {
      rows = db.prepare(baseQuery + ' ORDER BY d.last_name, d.first_name').all() as any[];
    }
  }

  res.json(rows.map(enrichDiver));
});

// Get single diver
router.get('/:id', (req: Request, res: Response) => {
  const { role, teamId, diverId } = req.auth!;
  const id = parseInt(req.params.id as string);

  const diver = db.prepare('SELECT * FROM divers WHERE id = ?').get(id) as any;
  if (!diver) { res.status(404).json({ error: 'צולל לא נמצא' }); return; }

  if (role === 'diver' && diver.id !== diverId) { res.status(403).json({ error: 'אין הרשאה' }); return; }
  if (role === 'madar' && !diverIsInTeam(diver.id, teamId)) { res.status(403).json({ error: 'אין הרשאה' }); return; }

  res.json(enrichDiver(diver));
});

// Lookup diver by ID number
router.get('/lookup/:idNumber', (req: Request, res: Response) => {
  const diver = db.prepare('SELECT * FROM divers WHERE id_number = ?').get(req.params.idNumber) as any;
  if (!diver) { res.status(404).json({ error: 'צולל לא נמצא' }); return; }
  if (req.auth!.role === 'diver' && diver.id !== req.auth!.diverId) { res.status(403).json({ error: 'אין הרשאה' }); return; }
  res.json(enrichDiver(diver));
});

// Create diver
router.post('/', requireRole('manager', 'secretary', 'madar'), (req: Request, res: Response) => {
  const { first_name, last_name, id_number, phone, email, medical_status, medical_expiry_date, notes, team_ids } = req.body;

  if (!first_name || !last_name || !id_number) {
    res.status(400).json({ error: 'שם פרטי, שם משפחה ותעודת זהות נדרשים' });
    return;
  }
  if (!phone) {
    res.status(400).json({ error: 'מספר טלפון הוא שדה חובה' });
    return;
  }

  try {
    const result = db.prepare(`
      INSERT INTO divers (first_name, last_name, id_number, phone, email, medical_status, medical_expiry_date, medical_last_updated, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).run(first_name, last_name, id_number, phone || '', email || '', medical_status || 'pending', medical_expiry_date || null, notes || '');

    const diverId = result.lastInsertRowid as number;

    // Insert teams
    if (Array.isArray(team_ids)) {
      const insertTeam = db.prepare('INSERT OR IGNORE INTO diver_teams (diver_id, team_id) VALUES (?, ?)');
      for (const tid of team_ids) {
        if (tid) insertTeam.run(diverId, tid);
      }
    }

    res.status(201).json({ id: diverId });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      if (e.message.includes('phone')) res.status(409).json({ error: 'מספר טלפון כבר קיים במערכת' });
      else if (e.message.includes('email')) res.status(409).json({ error: 'כתובת אימייל כבר קיימת במערכת' });
      else res.status(409).json({ error: 'תעודת זהות כבר קיימת במערכת' });
      return;
    }
    throw e;
  }
});

// Update diver
router.put('/:id', requireRole('manager', 'secretary', 'madar'), (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);

  if (req.auth!.role === 'madar' && !diverIsInTeam(id, req.auth!.teamId)) {
    res.status(403).json({ error: 'אין הרשאה' });
    return;
  }

  const { first_name, last_name, id_number, phone, email, medical_status, medical_expiry_date, notes, team_ids } = req.body;

  if (!phone) {
    res.status(400).json({ error: 'מספר טלפון הוא שדה חובה' });
    return;
  }

  try {
    const result = db.prepare(`
      UPDATE divers SET
        first_name = ?, last_name = ?, id_number = ?, phone = ?, email = ?,
        medical_status = ?, medical_expiry_date = ?, medical_last_updated = datetime('now'),
        notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(first_name, last_name, id_number, phone || '', email || '', medical_status || 'pending', medical_expiry_date || null, notes || '', id);

    if (result.changes === 0) { res.status(404).json({ error: 'צולל לא נמצא' }); return; }

    // Sync teams
    if (Array.isArray(team_ids)) {
      db.prepare('DELETE FROM diver_teams WHERE diver_id = ?').run(id);
      const insertTeam = db.prepare('INSERT OR IGNORE INTO diver_teams (diver_id, team_id) VALUES (?, ?)');
      for (const tid of team_ids) {
        if (tid) insertTeam.run(id, tid);
      }
    }

    res.json({ success: true });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      if (e.message.includes('phone')) res.status(409).json({ error: 'מספר טלפון כבר קיים במערכת' });
      else if (e.message.includes('email')) res.status(409).json({ error: 'כתובת אימייל כבר קיימת במערכת' });
      else res.status(409).json({ error: 'תעודת זהות כבר קיימת במערכת' });
      return;
    }
    throw e;
  }
});

// Delete diver
router.delete('/:id', requireRole('manager'), (req: Request, res: Response) => {
  const result = db.prepare('DELETE FROM divers WHERE id = ?').run(parseInt(req.params.id as string));
  if (result.changes === 0) { res.status(404).json({ error: 'צולל לא נמצא' }); return; }
  res.json({ success: true });
});

export default router;
