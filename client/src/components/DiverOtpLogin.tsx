import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

type Step = 'contact' | 'otp';

export default function DiverOtpLogin() {
  const [step, setStep] = useState<Step>('contact');
  const [contact, setContact] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [code, setCode] = useState('');
  const [diverId, setDiverId] = useState<number>(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const loginWithOtp = useAuthStore(s => s.loginWithOtp);
  const navigate = useNavigate();

  // Countdown timer for OTP expiry display
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/diver-auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: contact.trim(), id_number: idNumber.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setDiverId(data.diver_id);
      setStep('otp');
      setCountdown(300); // 5 minutes
      setTimeout(() => codeInputRef.current?.focus(), 100);
    } catch {
      setError('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/diver-auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diver_id: diverId, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      const diver = data.diver;
      loginWithOtp(data.token, diver.id, `${diver.first_name} ${diver.last_name}`);
      navigate('/');
    } catch {
      setError('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setError('');
    setCode('');
    setLoading(true);
    try {
      const res = await fetch('/api/diver-auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: contact.trim(), id_number: idNumber.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setCountdown(300);
    } catch {
      setError('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 px-4">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-blue-800">מרי</h1>
          <p className="text-gray-500 mt-2 text-sm sm:text-base">צפייה בסטטוס צולל</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">{error}</div>
        )}

        {step === 'contact' && (
          <form onSubmit={requestOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">טלפון או אימייל</label>
              <input
                type="text"
                value={contact}
                onChange={e => setContact(e.target.value)}
                placeholder="050-1234567 או email@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תעודת זהות</label>
              <input
                type="text"
                value={idNumber}
                onChange={e => setIdNumber(e.target.value)}
                placeholder="123456789"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm"
            >
              {loading ? 'שולח...' : 'שלח קוד אימות'}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-sm text-gray-500 hover:text-blue-600"
              >
                התחברות כמנהל / מזכירה / מד"ר
              </button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm text-center">
              קוד אימות נשלח. הקוד תקף ל-{countdown > 0 ? formatTime(countdown) : 'פג תוקף'}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">קוד אימות (6 ספרות)</label>
              <input
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-[0.5em] font-mono"
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm"
            >
              {loading ? 'מאמת...' : 'אימות'}
            </button>
            <div className="flex justify-between items-center text-sm">
              <button
                type="button"
                onClick={resendOtp}
                disabled={loading}
                className="text-blue-600 hover:underline disabled:opacity-50"
              >
                שלח קוד חדש
              </button>
              <button
                type="button"
                onClick={() => { setStep('contact'); setCode(''); setError(''); }}
                className="text-gray-500 hover:text-gray-700"
              >
                חזרה
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
