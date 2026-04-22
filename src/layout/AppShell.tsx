import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth, usePermission } from "../auth/AuthContext";
import { appPath } from "../lib/routes";
import { useStore } from "../domain/store";

export default function AppShell() {
  const { state, mode } = useStore();
  const { configured, user, signOut } = useAuth();
  const org = state.organization;
  const location = useLocation();
  const navigate = useNavigate();
  const canDash = usePermission("app.dashboard.view");
  const canClients = usePermission("clients.read");
  const canLoans = usePermission("loans.read");
  const canPayments = usePermission("payments.read");
  const canTeam = usePermission("roles.read");
  const canSettings = usePermission("org.settings.manage");

  useEffect(() => {
    document.title = `${org.name} · PrestaYa`;
  }, [org.name]);

  const dataHint =
    mode === "remote"
      ? "Datos en la nube (organización vinculada)."
      : "Datos en tu navegador (modo demo).";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          {org.logoDataUrl ? (
            <img
              src={org.logoDataUrl}
              alt=""
              className="brand-logo-img"
              width={34}
              height={34}
            />
          ) : (
            <div className="brand-logo" />
          )}
          <div>
            <div>{org.name}</div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
              PrestaYa
            </div>
          </div>
        </div>
        <div className="sidebar-body">
          <nav className="nav">
            {canDash ? (
              <NavLink to={appPath("/")} end>
                Panel
              </NavLink>
            ) : null}
            {canClients ? <NavLink to={appPath("/clientes")}>Clientes</NavLink> : null}
            {canLoans ? <NavLink to={appPath("/prestamos")}>Préstamos</NavLink> : null}
            {canPayments ? <NavLink to={appPath("/pagos")}>Pagos</NavLink> : null}
          </nav>
        </div>
        <div className="sidebar-footer">
          <nav className="nav">
            {canTeam ? <NavLink to={appPath("/equipo")}>Equipo y roles</NavLink> : null}
            {canSettings ? <NavLink to={appPath("/configuracion")}>Configuración</NavLink> : null}
          </nav>
          {configured && user ? (
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 11, lineHeight: 1.4 }}>
                {user.email}
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: 8, width: "100%", fontSize: 12 }}
                onClick={() =>
                  void signOut().then(() => {
                    navigate("/login", { replace: true });
                  })
                }
              >
                Cerrar sesión
              </button>
            </div>
          ) : null}
          <div className="muted" style={{ fontSize: 11, lineHeight: 1.45, marginTop: 10 }}>
            {dataHint}
            {!location.pathname.endsWith("/configuracion") ? (
              <>
                <br />
                Moneda: <span className="mono">{org.currency}</span>
              </>
            ) : null}
          </div>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
