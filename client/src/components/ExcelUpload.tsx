import { useState, useRef, useCallback } from 'react';
import { api } from '../services/api';

interface PreviewData {
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
}

const FIELDS = [
  { key: 'first_name', label: 'שם פרטי' },
  { key: 'last_name', label: 'שם משפחה' },
  { key: 'id_number', label: 'תעודת זהות' },
  { key: 'phone', label: 'טלפון' },
  { key: 'email', label: 'אימייל' },
  { key: 'certification_level', label: 'רמת הסמכה' },
  { key: 'certification_expiry', label: 'תוקף הסמכה' },
  { key: 'medical_status', label: 'סטטוס רפואי' },
  { key: 'medical_expiry_date', label: 'תוקף רפואי' },
  { key: 'team', label: 'צוות' },
  { key: 'notes', label: 'הערות' },
];

export default function ExcelUpload() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ imported: number; errors: string[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDownloadSample = useCallback(async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/upload/sample', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_divers.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError('');
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append('file', f);
      const data = await api.post<PreviewData>('/upload/preview', fd);
      setPreview(data);

      const autoMap: Record<string, string[]> = {
        first_name: ['שם פרטי', 'first_name', 'שם'],
        last_name: ['שם משפחה', 'last_name', 'משפחה'],
        id_number: ['תעודת זהות', 'ת.ז', 'id_number', 'id', 'tz'],
        phone: ['טלפון', 'phone', 'נייד'],
        email: ['אימייל', 'email', 'דוא"ל'],
        certification_level: ['רמת הסמכה', 'הסמכה', 'certification'],
        certification_expiry: ['תוקף הסמכה', 'cert_expiry'],
        medical_status: ['סטטוס רפואי', 'רפואי', 'medical_status'],
        medical_expiry_date: ['תוקף רפואי', 'medical_expiry'],
        team: ['צוות', 'team', 'קבוצה'],
        notes: ['הערות', 'notes'],
      };

      const newMapping: Record<string, string> = {};
      for (const [field, aliases] of Object.entries(autoMap)) {
        for (const header of data.headers) {
          if (aliases.some(a => header.trim().toLowerCase() === a.toLowerCase())) {
            newMapping[field] = header;
            break;
          }
        }
      }
      setMapping(newMapping);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError('');

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mapping', JSON.stringify(mapping));
      const data = await api.post<{ imported: number; errors: string[]; total: number }>('/upload/import', fd);
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">ייבוא מאקסל</h2>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">{error}</div>}

      {result && (
        <div className="bg-green-50 border border-green-200 p-3 sm:p-4 rounded-lg mb-4">
          <div className="text-green-800 font-medium text-sm sm:text-base">
            יובאו {result.imported} מתוך {result.total} שורות בהצלחה
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2 text-xs sm:text-sm text-red-600">
              <div className="font-medium">שגיאות:</div>
              {result.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-5 mb-4">
        <h3 className="text-sm sm:text-base font-semibold text-blue-800 mb-2">הנחיות להכנת קובץ האקסל</h3>
        <p className="text-xs sm:text-sm text-blue-700 mb-3">
          הקובץ צריך להיות בפורמט <strong>xlsx</strong> עם שורת כותרות בשורה הראשונה. שמות העמודות המומלצים:
        </p>
        <div className="overflow-x-auto -mx-1 mb-3">
          <table className="text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="text-blue-800">
                <th className="px-2 sm:px-3 py-1 text-right font-semibold border-b border-blue-200">עמודה</th>
                <th className="px-2 sm:px-3 py-1 text-right font-semibold border-b border-blue-200">חובה</th>
                <th className="px-2 sm:px-3 py-1 text-right font-semibold border-b border-blue-200">פורמט / ערכים</th>
              </tr>
            </thead>
            <tbody className="text-blue-700">
              <tr><td className="px-2 sm:px-3 py-1">שם פרטי</td><td className="px-2 sm:px-3 py-1">כן</td><td className="px-2 sm:px-3 py-1">טקסט</td></tr>
              <tr><td className="px-2 sm:px-3 py-1">שם משפחה</td><td className="px-2 sm:px-3 py-1">כן</td><td className="px-2 sm:px-3 py-1">טקסט</td></tr>
              <tr><td className="px-2 sm:px-3 py-1">תעודת זהות</td><td className="px-2 sm:px-3 py-1">כן</td><td className="px-2 sm:px-3 py-1">מספר (ייחודי לכל צולל)</td></tr>
              <tr><td className="px-2 sm:px-3 py-1">טלפון</td><td className="px-2 sm:px-3 py-1">לא</td><td className="px-2 sm:px-3 py-1">טקסט</td></tr>
              <tr><td className="px-2 sm:px-3 py-1">אימייל</td><td className="px-2 sm:px-3 py-1">לא</td><td className="px-2 sm:px-3 py-1">טקסט</td></tr>
              <tr><td className="px-2 sm:px-3 py-1">רמת הסמכה</td><td className="px-2 sm:px-3 py-1">לא</td><td className="px-2 sm:px-3 py-1">שם רמה כפי שהוגדרה בניהול</td></tr>
              <tr><td className="px-2 sm:px-3 py-1">תוקף הסמכה</td><td className="px-2 sm:px-3 py-1">לא</td><td className="px-2 sm:px-3 py-1">תאריך (YYYY-MM-DD)</td></tr>
              <tr><td className="px-2 sm:px-3 py-1">סטטוס רפואי</td><td className="px-2 sm:px-3 py-1">לא</td><td className="px-2 sm:px-3 py-1">valid / expired / pending</td></tr>
              <tr><td className="px-2 sm:px-3 py-1">תוקף רפואי</td><td className="px-2 sm:px-3 py-1">לא</td><td className="px-2 sm:px-3 py-1">תאריך (YYYY-MM-DD)</td></tr>
              <tr><td className="px-2 sm:px-3 py-1">צוות</td><td className="px-2 sm:px-3 py-1">לא</td><td className="px-2 sm:px-3 py-1">שם צוות כפי שהוגדר בניהול</td></tr>
              <tr><td className="px-2 sm:px-3 py-1">הערות</td><td className="px-2 sm:px-3 py-1">לא</td><td className="px-2 sm:px-3 py-1">טקסט חופשי</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-blue-600 mb-3">
          אם שמות העמודות שונים מהמומלץ, ניתן למפות אותן ידנית לאחר העלאת הקובץ.
          צולל עם תעודת זהות קיימת יעודכן במקום להיווצר מחדש.
        </p>
        <button
          onClick={handleDownloadSample}
          className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          הורד קובץ דוגמה
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
        <div className="mb-4 sm:mb-6">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="bg-blue-600 text-white px-4 sm:px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition w-full sm:w-auto"
          >
            בחר קובץ אקסל
          </button>
          {file && <div className="mt-2 sm:mt-0 sm:inline sm:mr-3 text-gray-600 text-sm">{file.name}</div>}
        </div>

        {loading && <div className="text-center py-4 text-gray-500">טוען...</div>}

        {preview && !loading && (
          <>
            <div className="mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">מיפוי עמודות</h3>
              <p className="text-xs sm:text-sm text-gray-500 mb-3">
                התאם את עמודות הקובץ לשדות המערכת (נמצאו {preview.totalRows} שורות)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {FIELDS.map(f => (
                  <div key={f.key} className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-medium text-gray-600 w-20 sm:w-28 shrink-0">{f.label}</span>
                    <select
                      value={mapping[f.key] || ''}
                      onChange={e => setMapping(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="flex-1 min-w-0 px-2 sm:px-3 py-1.5 border border-gray-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- לא ממופה --</option>
                      {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">תצוגה מקדימה</h3>
              <div className="overflow-x-auto border rounded-lg -mx-1">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {preview.headers.map(h => (
                        <th key={h} className="px-2 sm:px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.rows.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        {preview.headers.map(h => (
                          <td key={h} className="px-2 sm:px-3 py-2 whitespace-nowrap">{String(row[h] || '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <button
                onClick={handleImport}
                disabled={loading || !mapping.id_number}
                className="bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition w-full sm:w-auto"
              >
                ייבוא {preview.totalRows} שורות
              </button>
              {!mapping.id_number && (
                <span className="text-xs sm:text-sm text-orange-600">יש למפות לפחות את שדה תעודת הזהות</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
