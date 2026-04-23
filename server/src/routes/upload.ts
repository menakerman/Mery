import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import db from '../db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);
router.use(requireRole('manager', 'secretary'));

// Download sample Excel file
router.get('/sample', (_req: Request, res: Response) => {
  const headers = [
    'שם פרטי', 'שם משפחה', 'תעודת זהות', 'טלפון', 'אימייל',
    'רמת הסמכה', 'תוקף הסמכה', 'סטטוס רפואי', 'תוקף רפואי', 'צוות', 'הערות',
  ];
  const sampleRows = [
    ['ישראל', 'ישראלי', '123456789', '0501234567', 'israel@example.com', 'צוללן 1', '2027-01-15', 'valid', '2027-06-01', 'צוות אלפא', ''],
    ['דנה', 'כהן', '987654321', '0529876543', 'dana@example.com', 'צוללן 2', '2026-12-01', 'expired', '2026-03-01', 'צוות בטא', 'צריך חידוש'],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  // Set column widths
  ws['!cols'] = headers.map(() => ({ wch: 16 }));

  XLSX.utils.book_append_sheet(wb, ws, 'צוללים');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=sample_divers.xlsx');
  res.send(buf);
});

// Preview Excel data
router.post('/preview', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'קובץ נדרש' });
    return;
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, any>[];
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    res.json({ headers, rows: rows.slice(0, 50), totalRows: rows.length });
  } catch {
    res.status(400).json({ error: 'שגיאה בקריאת הקובץ' });
  }
});

// Import Excel data
router.post('/import', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'קובץ נדרש' });
    return;
  }

  const mapping = JSON.parse(req.body.mapping || '{}') as Record<string, string>;

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, any>[];

    // Build certification level lookup
    const certLevels = db.prepare('SELECT id, name FROM certification_levels').all() as { id: number; name: string }[];
    const certMap = new Map(certLevels.map(c => [c.name.trim().toLowerCase(), c.id]));

    // Build team lookup
    const teams = db.prepare('SELECT id, name FROM teams').all() as { id: number; name: string }[];
    const teamMap = new Map(teams.map(t => [t.name.trim().toLowerCase(), t.id]));

    const upsert = db.prepare(`
      INSERT INTO divers (first_name, last_name, id_number, phone, email, certification_level_id, certification_expiry, medical_status, medical_expiry_date, medical_last_updated, team_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
      ON CONFLICT(id_number) DO UPDATE SET
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        phone = excluded.phone,
        email = excluded.email,
        certification_level_id = excluded.certification_level_id,
        certification_expiry = excluded.certification_expiry,
        medical_status = excluded.medical_status,
        medical_expiry_date = excluded.medical_expiry_date,
        medical_last_updated = datetime('now'),
        team_id = excluded.team_id,
        notes = excluded.notes,
        updated_at = datetime('now')
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

          const firstName = getValue('first_name');
          const lastName = getValue('last_name');
          const idNumber = getValue('id_number');

          if (!firstName || !lastName || !idNumber) {
            errors.push(`שורה ${i + 2}: שם פרטי, שם משפחה ותעודת זהות נדרשים`);
            continue;
          }

          const certName = getValue('certification_level').toLowerCase();
          const certId = certName ? (certMap.get(certName) || null) : null;

          const teamName = getValue('team').toLowerCase();
          const teamId = teamName ? (teamMap.get(teamName) || null) : null;

          const medicalStatus = getValue('medical_status') || 'pending';

          upsert.run(
            firstName, lastName, idNumber,
            getValue('phone'), getValue('email'),
            certId, getValue('certification_expiry') || null,
            ['valid', 'expired', 'pending'].includes(medicalStatus) ? medicalStatus : 'pending',
            getValue('medical_expiry_date') || null,
            teamId, getValue('notes')
          );
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

export default router;
