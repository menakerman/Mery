import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import db from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
router.use(authenticate);

// Get activities for a diver
router.get('/:diverId', (req: Request, res: Response) => {
  const diverId = parseInt(req.params.diverId as string);
  const { role, teamId, diverId: authDiverId } = req.auth!;

  // Divers can only see their own activities
  if (role === 'diver' && diverId !== authDiverId) {
    res.status(403).json({ error: 'אין הרשאה' });
    return;
  }

  // Madar can only see their team's divers
  if (role === 'madar') {
    const diver = db.prepare('SELECT team_id FROM divers WHERE id = ?').get(diverId) as any;
    if (!diver || diver.team_id !== teamId) {
      res.status(403).json({ error: 'אין הרשאה' });
      return;
    }
  }

  const activities = db.prepare(`
    SELECT da.*, u.full_name as created_by_name
    FROM diver_activities da
    LEFT JOIN users u ON da.created_by = u.id
    ORDER BY da.activity_date DESC, da.created_at DESC
  `).all();

  // Filter by diver_id in JS since we need the JOIN
  const filtered = (activities as any[]).filter((a: any) => a.diver_id === diverId);
  res.json(filtered);
});

// Add activity
router.post('/', requireRole('manager', 'secretary', 'madar'), (req: Request, res: Response) => {
  const { diver_id, activity_date, activity_name, diver_role, location, notes } = req.body;

  if (!diver_id || !activity_date || !activity_name) {
    res.status(400).json({ error: 'תאריך ושם פעילות נדרשים' });
    return;
  }

  // Madar can only add to own team
  if (req.auth!.role === 'madar') {
    const diver = db.prepare('SELECT team_id FROM divers WHERE id = ?').get(diver_id) as any;
    if (!diver || diver.team_id !== req.auth!.teamId) {
      res.status(403).json({ error: 'אין הרשאה' });
      return;
    }
  }

  const result = db.prepare(`
    INSERT INTO diver_activities (diver_id, activity_date, activity_name, diver_role, location, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(diver_id, activity_date, activity_name, diver_role || '', location || '', notes || '', req.auth!.userId || null);

  res.status(201).json({ id: result.lastInsertRowid });
});

// Update activity
router.put('/:id', requireRole('manager', 'secretary', 'madar'), (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const { activity_date, activity_name, diver_role, location, notes } = req.body;

  // Madar check
  if (req.auth!.role === 'madar') {
    const activity = db.prepare(`
      SELECT da.diver_id, d.team_id FROM diver_activities da
      JOIN divers d ON da.diver_id = d.id WHERE da.id = ?
    `).get(id) as any;
    if (!activity || activity.team_id !== req.auth!.teamId) {
      res.status(403).json({ error: 'אין הרשאה' });
      return;
    }
  }

  const result = db.prepare(`
    UPDATE diver_activities SET activity_date = ?, activity_name = ?, diver_role = ?, location = ?, notes = ?
    WHERE id = ?
  `).run(activity_date, activity_name, diver_role || '', location || '', notes || '', id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'פעילות לא נמצאה' });
    return;
  }
  res.json({ success: true });
});

// Delete activity
router.delete('/:id', requireRole('manager', 'secretary', 'madar'), (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);

  if (req.auth!.role === 'madar') {
    const activity = db.prepare(`
      SELECT da.diver_id, d.team_id FROM diver_activities da
      JOIN divers d ON da.diver_id = d.id WHERE da.id = ?
    `).get(id) as any;
    if (!activity || activity.team_id !== req.auth!.teamId) {
      res.status(403).json({ error: 'אין הרשאה' });
      return;
    }
  }

  const result = db.prepare('DELETE FROM diver_activities WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'פעילות לא נמצאה' });
    return;
  }
  res.json({ success: true });
});

// Download sample activity Excel
router.get('/import/sample', requireRole('manager', 'secretary'), (_req: Request, res: Response) => {
  const headers = ['תאריך', 'תעודת זהות', 'שם פעילות'];
  const sampleRows = [
    ['2026-04-10', '123456789', 'צלילת אימון'],
    ['2026-04-10', '987654321', 'צלילת אימון'],
    ['2026-03-15', '123456789', 'תרגיל חיפוש והצלה'],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws, 'פעילויות');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=sample_activities.xlsx');
  res.send(buf);
});

// Import activities from Excel
router.post('/import', requireRole('manager', 'secretary'), upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'קובץ נדרש' });
    return;
  }

  const mapping = JSON.parse(req.body.mapping || '{}') as Record<string, string>;

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as Record<string, any>[];

    // Build diver id_number -> id lookup
    const divers = db.prepare('SELECT id, id_number FROM divers').all() as { id: number; id_number: string }[];
    const diverMap = new Map(divers.map(d => [d.id_number.trim(), d.id]));

    const insert = db.prepare(`
      INSERT INTO diver_activities (diver_id, activity_date, activity_name, diver_role, location, notes, created_by)
      VALUES (?, ?, ?, '', '', '', ?)
    `);

    let imported = 0;
    let errors: string[] = [];

    const importAll = db.transaction(() => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const getValue = (field: string) => {
            const col = mapping[field];
            return col ? String(row[col] || '').trim() : '';
          };

          const dateStr = getValue('activity_date');
          const idNumber = getValue('id_number');
          const activityName = getValue('activity_name');

          if (!dateStr || !idNumber || !activityName) {
            errors.push(`שורה ${i + 2}: תאריך, תעודת זהות ושם פעילות נדרשים`);
            continue;
          }

          const diverId = diverMap.get(idNumber);
          if (!diverId) {
            errors.push(`שורה ${i + 2}: צולל עם ת.ז ${idNumber} לא נמצא במערכת`);
            continue;
          }

          // Normalize date - handle Excel date formats
          let normalizedDate = dateStr;
          // Try to parse if it looks like DD/MM/YYYY or similar
          const dateParts = dateStr.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
          if (dateParts) {
            normalizedDate = `${dateParts[3]}-${dateParts[2].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
          }

          insert.run(diverId, normalizedDate, activityName, req.auth!.userId || null);
          imported++;
        } catch (e: any) {
          errors.push(`שורה ${i + 2}: ${e.message}`);
        }
      }
    });

    importAll();
    res.json({ imported, errors, total: rows.length });
  } catch {
    res.status(400).json({ error: 'שגיאה בעיבוד הקובץ' });
  }
});

// Preview activity Excel
router.post('/import/preview', requireRole('manager', 'secretary'), upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'קובץ נדרש' });
    return;
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as Record<string, any>[];
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    res.json({ headers, rows: rows.slice(0, 50), totalRows: rows.length });
  } catch {
    res.status(400).json({ error: 'שגיאה בקריאת הקובץ' });
  }
});

export default router;
