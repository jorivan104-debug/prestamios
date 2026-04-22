import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { appPath } from "../lib/routes";
import { isApiEnabled } from "../lib/api";

export default function Register() {
  const { signUp, user, configured, ready } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!configured || !ready || !user) return;
    nav(appPath("/"), { replace: true });
  }, [configured, ready, user, nav]);

  if (!isApiEnabled()) {
    return <Navigate to={appPath("/")} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setLoading(true);
    const r = await signUp(email.trim(), password, orgName.trim() || "Mi organización");
    setLoading(false);
    if (r.error) {
      setErr(r.error);
      return;
    }
    setInfo(
      "Si tu proyecto requiere confirmación por email, revisa tu bandeja antes de entrar."
    );
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
      <div className="card" style={{ maxWidth: 420, width: "100%" }}>
        <h1 className="page-title" style={{ fontSize: "1.35rem" }}>
          Crear cuenta
        </h1>
        <p className="page-subtitle" style={{ marginBottom: 18 }}>
          Registro con email y nombre de organización. El primer usuario recibe el rol Propietario.
        </p>
        <form onSubmit={onSubmit} className="form-grid">
          {err ? (
            <div className="chip danger" style={{ gridColumn: "1 / -1" }}>
              {err}
            </div>
          ) : null}
          {info ? (
            <div className="chip success" style={{ gridColumn: "1 / -1" }}>
              {info}
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="reg-org">Nombre de la organización</label>
            <input
              id="reg-org"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Ej. Cooperativa Los Andes"
            />
          </div>
          <div className="field">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="reg-pass">Contraseña</label>
            <input
              id="reg-pass"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Creando…" : "Registrarme"}
            </button>
          </div>
        </form>
        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
          {" · "}
          <Link to="/">Inicio</Link>
        </p>
      </div>
    </div>
  );
}
