import { FormEvent, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { StoreProvider } from "../domain/store";

function OrgBootstrap() {
  const { bootstrapOrganization } = useAuth();
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setErr(null);
    setLoading(true);
    const r = await bootstrapOrganization(n);
    setLoading(false);
    if (r.error) setErr(r.error);
  };

  return (
    <div className="auth-page">
      <div className="card" style={{ maxWidth: 420, width: "100%" }}>
        <img src="/img/logo.png" alt="" className="auth-logo" />
        <h1 className="page-title" style={{ fontSize: "1.35rem" }}>
          Crear organización
        </h1>
        <p className="page-subtitle" style={{ marginBottom: 18 }}>
          Completa el nombre de tu entidad para vincular tu cuenta al almacenamiento en el servidor local.
        </p>
        <form onSubmit={onSubmit} className="form-grid">
          {err ? (
            <div className="chip danger" style={{ gridColumn: "1 / -1" }}>
              {err}
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="org-bootstrap-name">Nombre de la organización</label>
            <input
              id="org-bootstrap-name"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Cooperativa Los Andes"
            />
          </div>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Guardando…" : "Continuar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StoreShell() {
  const { configured, user, organizationId } = useAuth();
  if (configured && user && !organizationId) {
    return <OrgBootstrap />;
  }
  const remote = configured && !!organizationId;
  return (
    <StoreProvider mode={remote ? "remote" : "local"} organizationId={organizationId}>
      <Outlet />
    </StoreProvider>
  );
}
