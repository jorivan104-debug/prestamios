import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

/**
 * Sin variables Supabase: acceso libre a `/app` (demo con datos locales).
 * Con Supabase: exige sesión para entrar a `/app`.
 */
export default function RequireAuth() {
  const { configured, ready, user } = useAuth();
  const location = useLocation();

  if (!configured) {
    return <Outlet />;
  }
  if (!ready) {
    return (
      <div className="auth-page">
        <p className="muted">Cargando sesión…</p>
      </div>
    );
  }
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  return <Outlet />;
}
