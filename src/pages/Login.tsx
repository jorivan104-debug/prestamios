import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD_HINT } from "../lib/defaultAdmin";
import { appPath } from "../lib/routes";
import { isApiEnabled } from "../lib/api";

export default function Login() {
  const { signIn, user, configured, ready } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const from =
    typeof (location.state as { from?: string } | null)?.from === "string"
      ? (location.state as { from: string }).from
      : appPath("/");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!configured || !ready || !user) return;
    nav(from.startsWith("/app") ? from : appPath("/"), { replace: true });
  }, [configured, ready, user, from, nav]);

  if (!isApiEnabled()) {
    return <Navigate to={appPath("/")} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const r = await signIn(email.trim(), password);
    setLoading(false);
    if (r.error) {
      setErr(r.error);
      return;
    }
    nav(from, { replace: true });
  };

  if (configured && ready && user) {
    return (
      <div className="auth-page">
        <p className="muted">Redirigiendo…</p>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="card" style={{ maxWidth: 400, width: "100%" }}>
        <img src="/img/logo.png" alt="" className="auth-logo" />
        <h1 className="page-title" style={{ fontSize: "1.35rem" }}>
          Iniciar sesión
        </h1>
        <p className="page-subtitle" style={{ marginBottom: 18 }}>
          Accede a tu organización y datos en la nube.
        </p>
        <div className="chip" style={{ marginBottom: 14, fontSize: 13, lineHeight: 1.45 }}>
          Cuenta administradora por defecto:{" "}
          <strong className="mono">{DEFAULT_ADMIN_EMAIL}</strong> / contraseña:{" "}
          <strong className="mono">{DEFAULT_ADMIN_PASSWORD_HINT}</strong>
          <span className="muted">
            {" "}
            (cámbiala en producción con variables <span className="mono">DEFAULT_ADMIN_*</span> en el servidor).
          </span>
        </div>
        <form onSubmit={onSubmit} className="form-grid">
          {err ? (
            <div className="chip danger" style={{ gridColumn: "1 / -1" }}>
              {err}
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="login-pass">Contraseña</label>
            <input
              id="login-pass"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </div>
        </form>
        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          Más usuarios: el administrador los crea en <strong>Equipo</strong>.{" "}
          <Link to="/">Volver al inicio</Link>
        </p>
      </div>
    </div>
  );
}
