import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { appPath } from "../lib/routes";
import { fetchRegistrationOpen, isApiEnabled } from "../lib/api";

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
  const [registrationOpen, setRegistrationOpen] = useState(false);

  const registrationClosedNotice = Boolean(
    (location.state as { registrationClosed?: boolean } | null)?.registrationClosed
  );

  useEffect(() => {
    if (!configured) return;
    void fetchRegistrationOpen().then(setRegistrationOpen);
  }, [configured]);

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
        <h1 className="page-title" style={{ fontSize: "1.35rem" }}>
          Iniciar sesión
        </h1>
        <p className="page-subtitle" style={{ marginBottom: 18 }}>
          Accede a tu organización y datos en la nube.
        </p>
        <form onSubmit={onSubmit} className="form-grid">
          {registrationClosedNotice ? (
            <div className="chip" style={{ gridColumn: "1 / -1" }}>
              El registro público está cerrado. Pide al administrador que te dé de alta en Equipo.
            </div>
          ) : null}
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
          {registrationOpen ? (
            <>
              ¿Sin cuenta? <Link to="/register">Crear cuenta (solo primer usuario)</Link>
              {" · "}
            </>
          ) : null}
          <Link to="/">Volver al inicio</Link>
        </p>
      </div>
    </div>
  );
}
