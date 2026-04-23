import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface LogEntry {
  id: number;
  diver_id: number;
  first_name: string;
  last_name: string;
  id_number: string;
  ip_address: string;
  accessed_at: string;
}

export default function DiverAccessLog() {
  const [rows, setRows] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = (newOffset = 0) => {
    setLoading(true);
    api.get<{ rows: LogEntry[]; total: number }>(`/diver-auth/access-log?limit=${limit}&offset=${newOffset}`)
      .then(data => {
        setRows(data.rows);
        setTotal(data.total);
        setOffset(newOffset);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = search
    ? rows.filter(r =>
        `${r.first_name} ${r.last_name}`.includes(search) ||
        r.id_number.includes(search)
      )
    : rows;

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">יומן גישת צוללים</h2>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="חיפוש לפי שם או ת.ז..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-0 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>

      <div className="text-xs sm:text-sm text-gray-500 mb-2">
        סה"כ {total} רשומות
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">טוען...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400">אין רשומות</div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="sm:hidden space-y-2">
            {filtered.map(r => (
              <div key={r.id} className="bg-white rounded-xl shadow-sm p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-gray-800">{r.first_name} {r.last_name}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(r.accessed_at + 'Z').toLocaleDateString('he-IL')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>ת.ז: {r.id_number}</span>
                  <span>{new Date(r.accessed_at + 'Z').toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-xl shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">שם</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">ת.ז</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">תאריך</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">שעה</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">כתובת IP</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-sm">{r.first_name} {r.last_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.id_number}</td>
                    <td className="px-4 py-3 text-sm">{new Date(r.accessed_at + 'Z').toLocaleDateString('he-IL')}</td>
                    <td className="px-4 py-3 text-sm">{new Date(r.accessed_at + 'Z').toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => load(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 transition"
              >
                הקודם
              </button>
              <span className="text-sm text-gray-500 self-center">
                {offset + 1}-{Math.min(offset + limit, total)} מתוך {total}
              </span>
              <button
                onClick={() => load(offset + limit)}
                disabled={offset + limit >= total}
                className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 transition"
              >
                הבא
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
