import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Login from './components/Login';
import DiverOtpLogin from './components/DiverOtpLogin';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import DiverList from './components/DiverList';
import DiverForm from './components/DiverForm';
import DiverSelfView from './components/DiverSelfView';
import ExcelUpload from './components/ExcelUpload';
import AdminPanel from './components/AdminPanel';
import DiverAccessLog from './components/DiverAccessLog';
import ActivityImport from './components/ActivityImport';

function HomePage() {
  const user = useAuthStore(s => s.user);
  if (user?.role === 'diver') return <DiverSelfView />;
  return <DiverList />;
}

export default function App() {
  const init = useAuthStore(s => s.init);
  const loading = useAuthStore(s => s.loading);

  useEffect(() => { init(); }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">טוען...</div>;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/diver-login" element={<DiverOtpLogin />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<HomePage />} />
        <Route path="divers/:id" element={
          <ProtectedRoute roles={['manager', 'secretary', 'madar']}>
            <DiverForm />
          </ProtectedRoute>
        } />
        <Route path="upload" element={
          <ProtectedRoute roles={['manager', 'secretary']}>
            <ExcelUpload />
          </ProtectedRoute>
        } />
        <Route path="upload-activities" element={
          <ProtectedRoute roles={['manager', 'secretary']}>
            <ActivityImport />
          </ProtectedRoute>
        } />
        <Route path="admin" element={
          <ProtectedRoute roles={['manager']}>
            <AdminPanel />
          </ProtectedRoute>
        } />
        <Route path="access-log" element={
          <ProtectedRoute roles={['manager']}>
            <DiverAccessLog />
          </ProtectedRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
