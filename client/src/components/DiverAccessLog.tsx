import { useState, useEffect } from 'react';
import { api } from '../services/api';

type Tab = 'divers' | 'staff';

interface DiverLogEntry {
  id: number;
  diver_id: number;
  first_name: string;
  last_name: string;
  id_number: string;
  ip_address: string;
  accessed_at: string;
}

interface StaffLogEntry {
  id: number;
  username: string;
  full_name: string;
  success: number;
  ip_address: string;
  reason: string;
  attempted_at: string;
}

export default function DiverAccessLog() {
  const [tab, setTab] = useState<Tab>('staff');

  const tabClass = (t: Tab) =>
    `px-3 sm:px-4 py-2 rounded-t-lg text-xs sm:text-sm font-medium transition ${
      tab === t ? 'bg-white text-blue-700 border-t-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
    }`;

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">יומן גישה</h2>
      <div className="flex gap-1 border-b mb-0">
        <button className={tabClass('staff')} onClick={() => setTab('staff')}>משתמשי מערכת</button>
        <button className={tabClass('divers')} onClick={() => setTab('divers')}>צוללים</button>
      </div>
      <div className="bg-white rounded-b-xl rounded-tl-none shadow-md p-4 sm:p-6">
        {tab === 'divers' && <DiverLog />}
        {tab === 'staff' && <StaffLog />}
      </div>
    </div>
  );
}

function DiverLog() {
  const [rows, setRows] = useState<DiverLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = (newOffset = 0) => {
    setLoading(true);
    api.get<{ rows: DiverLogEntry[]; total: number }>(`/diver-auth/access-log?limit=${limit}&offset=${newOffset}`)
      .then(data => { setRows(data.rows); setTotal(data.total); setOffset(newOffset); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = search
    ? rows.filter(r => `${r.first_name} ${r.last_name}`.includes(search) || r.id_number.includes(search))
    : rows;

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input type="text" placeholder="חיפוש לפי שם או ת.ז..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
      </div>
      <div className="text-xs text-gray-500 mb-2">סה"כ {total} רשומות</div>

      {loading ? <div className="text-center py-6 text-gray-500 text-sm">טוען...</div> :
       filtered.length === 0 ? <div className="text-center py-6 text-gray-400 text-sm">אין רשומות</div> : (
        <>
          <div className="sm:hidden space-y-2">
            {filtered.map(r => (
              <div key={r.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{r.first_name} {r.last_name}</span>
                  <span className="text-xs text-gray-500">{new Date(r.accessed_at + 'Z').toLocaleDateString('he-IL')}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>ת.ז: {r.id_number}</span>
                  <span>{new Date(r.accessed_at + 'Z').toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">שם</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">ת.ז</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">תאריך</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">שעה</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-medium">{r.first_name} {r.last_name}</td>
                    <td className="px-3 py-2 text-gray-600">{r.id_number}</td>
                    <td className="px-3 py-2">{new Date(r.accessed_at + 'Z').toLocaleDateString('he-IL')}</td>
                    <td className="px-3 py-2">{new Date(r.accessed_at + 'Z').toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-3 py-2 text-gray-500">{r.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={total} limit={limit} offset={offset} onNavigate={load} />
        </>
      )}
    </div>
  );
}

function StaffLog() {
  const [rows, setRows] = useState<StaffLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = (newOffset = 0) => {
    setLoading(true);
    api.get<{ rows: StaffLogEntry[]; total: number }>(`/auth/login-log?limit=${limit}&offset=${newOffset}`)
      .then(data => { setRows(data.rows); setTotal(data.total); setOffset(newOffset); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = search
    ? rows.filter(r => r.full_name.includes(search) || r.username.includes(search))
    : rows;

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input type="text" placeholder="חיפוש לפי שם או שם משתמש..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
      </div>
      <div className="text-xs text-gray-500 mb-2">סה"כ {total} רשומות</div>

      {loading ? <div className="text-center py-6 text-gray-500 text-sm">טוען...</div> :
       filtered.length === 0 ? <div className="text-center py-6 text-gray-400 text-sm">אין רשומות</div> : (
        <>
          <div className="sm:hidden space-y-2">
            {filtered.map(r => (
              <div key={r.id} className={`rounded-lg p-3 ${r.success ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm">{r.full_name || r.username}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {r.success ? 'הצלחה' : 'נכשל'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(r.attempted_at + 'Z').toLocaleDateString('he-IL')}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{r.reason}</span>
                  <span>{new Date(r.attempted_at + 'Z').toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">משתמש</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">שם</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">סטטוס</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">סיבה</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">תאריך</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">שעה</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(r => (
                  <tr key={r.id} className={r.success ? '' : 'bg-red-50/50'}>
                    <td className="px-3 py-2 text-gray-600">{r.username}</td>
                    <td className="px-3 py-2 font-medium">{r.full_name || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {r.success ? 'הצלחה' : 'נכשל'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.reason}</td>
                    <td className="px-3 py-2">{new Date(r.attempted_at + 'Z').toLocaleDateString('he-IL')}</td>
                    <td className="px-3 py-2">{new Date(r.attempted_at + 'Z').toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-3 py-2 text-gray-500">{r.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={total} limit={limit} offset={offset} onNavigate={load} />
        </>
      )}
    </div>
  );
}

function Pagination({ total, limit, offset, onNavigate }: { total: number; limit: number; offset: number; onNavigate: (o: number) => void }) {
  if (total <= limit) return null;
  return (
    <div className="flex justify-center gap-3 mt-4">
      <button onClick={() => onNavigate(Math.max(0, offset - limit))} disabled={offset === 0}
        className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 transition">הקודם</button>
      <span className="text-sm text-gray-500 self-center">{offset + 1}-{Math.min(offset + limit, total)} מתוך {total}</span>
      <button onClick={() => onNavigate(offset + limit)} disabled={offset + limit >= total}
        className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 transition">הבא</button>
    </div>
  );
}
