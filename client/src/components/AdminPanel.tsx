import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { CertificationLevel, Team, User } from '../../../shared/types';

type Tab = 'certifications' | 'teams' | 'users' | 'settings';

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('certifications');

  const tabClass = (t: Tab) =>
    `px-3 sm:px-4 py-2 rounded-t-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${
      tab === t ? 'bg-white text-blue-700 border-t-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
    }`;

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">ניהול מערכת</h2>
      <div className="flex gap-1 border-b mb-0 overflow-x-auto">
        <button className={tabClass('certifications')} onClick={() => setTab('certifications')}>רמות הסמכה</button>
        <button className={tabClass('teams')} onClick={() => setTab('teams')}>צוותים</button>
        <button className={tabClass('users')} onClick={() => setTab('users')}>משתמשים</button>
        <button className={tabClass('settings')} onClick={() => setTab('settings')}>הגדרות</button>
      </div>
      <div className="bg-white rounded-b-xl rounded-tl-none shadow-md p-4 sm:p-6">
        {tab === 'certifications' && <CertificationsTab />}
        {tab === 'teams' && <TeamsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

function CertificationsTab() {
  const [items, setItems] = useState<CertificationLevel[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editId, setEditId] = useState<number | null>(null);

  const load = () => api.get<CertificationLevel[]>('/certifications').then(setItems);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!name) return;
    if (editId) {
      await api.put(`/certifications/${editId}`, { name, description, sort_order: 0 });
    } else {
      await api.post('/certifications', { name, description, sort_order: 0 });
    }
    setName(''); setDescription(''); setEditId(null);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm('למחוק?')) return;
    await api.delete(`/certifications/${id}`);
    load();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input placeholder="שם רמה" value={name} onChange={e => setName(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm flex-1" />
        <input placeholder="תיאור" value={description} onChange={e => setDescription(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm flex-1" />
        <div className="flex gap-2">
          <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 flex-1 sm:flex-none">
            {editId ? 'עדכן' : 'הוסף'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setName(''); setDescription(''); }}
            className="text-gray-500 text-sm">ביטול</button>}
        </div>
      </div>
      <div className="space-y-2">
        {items.map(c => (
          <div key={c.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg gap-2">
            <div className="min-w-0">
              <span className="font-medium text-sm">{c.name}</span>
              {c.description && <span className="text-gray-500 text-xs sm:text-sm mr-2">- {c.description}</span>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => { setEditId(c.id); setName(c.name); setDescription(c.description); }}
                className="text-blue-600 text-xs sm:text-sm hover:underline">ערוך</button>
              <button onClick={() => remove(c.id)} className="text-red-600 text-xs sm:text-sm hover:underline">מחק</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-gray-400 text-center py-4 text-sm">אין רמות הסמכה</div>}
      </div>
    </div>
  );
}

function TeamsTab() {
  const [items, setItems] = useState<(Team & { madar_name?: string })[]>([]);
  const [madarUsers, setMadarUsers] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [madarUserId, setMadarUserId] = useState<string>('');
  const [editId, setEditId] = useState<number | null>(null);

  const load = () => {
    api.get<(Team & { madar_name?: string })[]>('/teams').then(setItems);
    api.get<User[]>('/users').then(users =>
      setMadarUsers(users.filter(u => u.role === 'madar' || u.role === 'manager'))
    );
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!name) return;
    const body = { name, madar_user_id: madarUserId || null };
    if (editId) {
      await api.put(`/teams/${editId}`, body);
    } else {
      await api.post('/teams', body);
    }
    setName(''); setMadarUserId(''); setEditId(null);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm('למחוק?')) return;
    await api.delete(`/teams/${id}`);
    load();
  };

  const startEdit = (t: Team & { madar_name?: string }) => {
    setEditId(t.id);
    setName(t.name);
    setMadarUserId(t.madar_user_id ? String(t.madar_user_id) : '');
  };

  const cancelEdit = () => {
    setEditId(null);
    setName('');
    setMadarUserId('');
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input placeholder="שם צוות" value={name} onChange={e => setName(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm flex-1 min-w-0" />
        <select value={madarUserId} onChange={e => setMadarUserId(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm flex-1 min-w-0">
          <option value="">-- מד"ר אחראי --</option>
          {madarUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <div className="flex gap-2 shrink-0">
          <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 flex-1 sm:flex-none">
            {editId ? 'עדכן' : 'הוסף'}
          </button>
          {editId && <button onClick={cancelEdit}
            className="text-gray-500 text-sm">ביטול</button>}
        </div>
      </div>
      <div className="space-y-2">
        {items.map(t => (
          <div key={t.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg gap-2">
            <div className="min-w-0">
              <span className="font-medium text-sm">{t.name}</span>
              {t.madar_name && (
                <span className="text-gray-500 text-xs sm:text-sm mr-2">
                  — מד"ר: {t.madar_name}
                </span>
              )}
              {!t.madar_name && !t.madar_user_id && (
                <span className="text-orange-500 text-xs mr-2">ללא מד"ר</span>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => startEdit(t)}
                className="text-blue-600 text-xs sm:text-sm hover:underline">ערוך</button>
              <button onClick={() => remove(t.id)} className="text-red-600 text-xs sm:text-sm hover:underline">מחק</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-gray-400 text-center py-4 text-sm">אין צוותים</div>}
      </div>
    </div>
  );
}

function UsersTab() {
  const [items, setItems] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [divers, setDivers] = useState<{ id: number; first_name: string; last_name: string }[]>([]);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'diver' as string, team_id: '' as string, diver_id: '' as string });
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    api.get<User[]>('/users').then(setItems);
    api.get<Team[]>('/teams').then(setTeams);
    api.get<any[]>('/divers').then(d => setDivers(d.map(x => ({ id: x.id, first_name: x.first_name, last_name: x.last_name }))));
  };
  useEffect(() => { load(); }, []);

  const roleLabels: Record<string, string> = { manager: 'מנהל', secretary: 'מזכירה', madar: 'מד"ר', diver: 'צולל' };

  const resetForm = () => {
    setForm({ username: '', password: '', full_name: '', role: 'diver', team_id: '', diver_id: '' });
    setEditId(null);
    setShowForm(false);
  };

  const save = async () => {
    if (!form.username || !form.full_name || !form.role) return;
    if (!editId && !form.password) return;
    const actualPassword = form.password === '••••••' ? '' : form.password;
    const body = {
      ...form,
      team_id: form.team_id || null,
      diver_id: form.diver_id || null,
      password: actualPassword || undefined,
    };
    if (editId) {
      await api.put(`/users/${editId}`, body);
    } else {
      await api.post('/users', body);
    }
    resetForm();
    load();
  };

  const remove = async (id: number) => {
    if (!confirm('למחוק משתמש?')) return;
    try {
      await api.delete(`/users/${id}`);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const startEdit = (u: User) => {
    setEditId(u.id);
    setShowForm(true);
    setForm({
      username: u.username,
      password: '••••••',
      full_name: u.full_name,
      role: u.role,
      team_id: u.team_id ? String(u.team_id) : '',
      diver_id: u.diver_id ? String(u.diver_id) : '',
    });
  };

  return (
    <div>
      {!showForm && (
        <button onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 mb-4 w-full sm:w-auto">
          + הוסף משתמש
        </button>
      )}

      {showForm && (
        <div className="border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 bg-blue-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <input placeholder="שם משתמש" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder={editId ? 'סיסמה חדשה (ריק = ללא שינוי)' : 'סיסמה'} type="password"
              value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              onFocus={e => { if (editId && form.password === '••••••') setForm(p => ({ ...p, password: '' })); }}
              className="px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <input placeholder="שם מלא" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
              className="px-3 py-2 border rounded-lg text-sm" />
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="px-3 py-2 border rounded-lg text-sm">
              <option value="diver">צולל</option>
              <option value="madar">מד"ר</option>
              <option value="secretary">מזכירה</option>
              <option value="manager">מנהל</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <select value={form.team_id} onChange={e => setForm(p => ({ ...p, team_id: e.target.value }))}
              className="px-3 py-2 border rounded-lg text-sm">
              <option value="">-- צוות --</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={form.diver_id} onChange={e => setForm(p => ({ ...p, diver_id: e.target.value }))}
              className="px-3 py-2 border rounded-lg text-sm">
              <option value="">-- שיוך צולל --</option>
              {divers.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
              {editId ? 'עדכן' : 'הוסף'}
            </button>
            <button onClick={resetForm} className="text-gray-500 text-sm px-4 py-2">ביטול</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map(u => (
          <div key={u.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1">
                <span className="font-medium text-sm">{u.full_name}</span>
                <span className="text-gray-500 text-xs">({u.username})</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">{roleLabels[u.role]}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => startEdit(u)} className="text-blue-600 text-xs sm:text-sm hover:underline">ערוך</button>
              <button onClick={() => remove(u.id)} className="text-red-600 text-xs sm:text-sm hover:underline">מחק</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [applyMsg, setApplyMsg] = useState('');

  const load = () => {
    setLoading(true);
    api.get<Record<string, string>>('/config')
      .then(setConfig)
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const update = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/config', config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const applyDefaults = async () => {
    setApplyMsg('');
    try {
      const data = await api.post<{ certsAdded: number; teamsAdded: number }>('/config/apply-defaults');
      const parts = [];
      if (data.certsAdded > 0) parts.push(`${data.certsAdded} רמות הסמכה`);
      if (data.teamsAdded > 0) parts.push(`${data.teamsAdded} צוותים`);
      setApplyMsg(parts.length > 0 ? `נוספו: ${parts.join(', ')}` : 'הכל כבר קיים, לא נוספו רשומות חדשות');
    } catch {
      setApplyMsg('שגיאה ביישום ברירות מחדל');
    }
  };

  if (loading) return <div className="text-center py-4 text-gray-500 text-sm">טוען...</div>;

  const fields: { key: string; label: string; hint: string; type?: string }[] = [
    { key: 'org_name', label: 'שם הארגון', hint: 'מוצג בכותרת המערכת' },
    { key: 'otp_expiry_minutes', label: 'תוקף קוד OTP (דקות)', hint: 'כמה זמן הקוד תקף', type: 'number' },
    { key: 'otp_max_attempts', label: 'מקסימום ניסיונות OTP', hint: 'אחרי כמה ניסיונות שגויים נועלים', type: 'number' },
    { key: 'lockout_hours', label: 'שעות נעילה', hint: 'כמה שעות ננעל חשבון אחרי ניסיונות כושלים', type: 'number' },
    { key: 'medical_expiry_warning_days', label: 'אזהרת תוקף רפואי (ימים)', hint: 'כמה ימים לפני פקיעה להציג אזהרה', type: 'number' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base sm:text-lg font-semibold mb-3">הגדרות כלליות</h3>
        <div className="space-y-3">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input
                type={f.type || 'text'}
                value={config[f.key] || ''}
                onChange={e => update(f.key, e.target.value)}
                className="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">{f.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-base sm:text-lg font-semibold mb-2">ברירות מחדל לאתחול</h3>
        <p className="text-xs sm:text-sm text-gray-500 mb-3">
          רמות הסמכה וצוותים שייווצרו אוטומטית בלחיצת "יישם". הפרד בפסיקים.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">רמות הסמכה ברירת מחדל</label>
            <input
              type="text"
              value={config.default_certification_levels || ''}
              onChange={e => update('default_certification_levels', e.target.value)}
              placeholder="צולל 1, צולל 2, מדריך"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">צוותים ברירת מחדל</label>
            <input
              type="text"
              value={config.default_teams || ''}
              onChange={e => update('default_teams', e.target.value)}
              placeholder="צוות אלפא, צוות בטא"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={applyDefaults}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition"
          >
            יישם ברירות מחדל
          </button>
          {applyMsg && <p className="text-sm text-green-700">{applyMsg}</p>}
        </div>
      </div>

      <div className="border-t pt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? 'שומר...' : 'שמור הגדרות'}
        </button>
        {saved && <span className="text-green-600 text-sm">נשמר בהצלחה</span>}
      </div>
    </div>
  );
}
