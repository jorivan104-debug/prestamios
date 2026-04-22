import { Link } from "react-router-dom";
import { appPath } from "../lib/routes";
import { isApiEnabled } from "../lib/api";

export default function Landing() {
  const hasBackend = isApiEnabled();
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-brand">Préstamos</div>
        <nav className="landing-nav">
          <Link to="/login" className="btn btn-ghost">
            Iniciar sesión
          </Link>
          {hasBackend ? (
            <Link to="/register" className="btn btn-primary">
              Crear cuenta
            </Link>
          ) : (
            <Link to={appPath("/")} className="btn btn-primary">
              Entrar (demo)
            </Link>
          )}
        </nav>
      </header>

      <section className="landing-hero">
        <h1>Gestión de préstamos clara y ordenada</h1>
        <p className="landing-lead">
          Plan de cuotas francés, seguimiento de mora, registro de pagos y ficha de clientes en un solo
          lugar.
        </p>
        <div className="landing-cta">
          {hasBackend ? (
            <>
              <Link to="/login" className="btn btn-primary btn-lg">
                Entrar
              </Link>
              <a href="#beneficios" className="btn btn-ghost btn-lg">
                Saber más
              </a>
            </>
          ) : (
            <Link to={appPath("/")} className="btn btn-primary btn-lg">
              Probar en modo demo
            </Link>
          )}
        </div>
      </section>

      <section id="beneficios" className="landing-benefits">
        <h2>Pensado para operaciones reales</h2>
        <ul>
          <li>
            <strong>Cuotas automáticas</strong>
            <span>Amortización francesa con calendario de vencimientos.</span>
          </li>
          <li>
            <strong>Pagos con reparto</strong>
            <span>Interés primero, capital después, alineado a cada cuota.</span>
          </li>
          <li>
            <strong>Roles por organización</strong>
            <span>Permisos atómicos y roles personalizables cuando uses la nube.</span>
          </li>
          <li>
            <strong>Privacidad</strong>
            <span>En modo demo los datos permanecen en tu navegador; con cuenta, acceso cifrado vía
            proveedor de autenticación.</span>
          </li>
        </ul>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <span className="muted">© {new Date().getFullYear()}</span>
          <span className="landing-footer-links">
            <span className="muted">Aviso legal: revisa la política de privacidad de tu despliegue.</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
