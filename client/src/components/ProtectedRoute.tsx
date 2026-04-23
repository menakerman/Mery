import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import type { Role } from '../../../shared/types';

export default function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { user, loading } = useAuthStore();

  if (loading) return <div className="text-center py-10">טוען...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
