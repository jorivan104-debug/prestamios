import { Link } from "react-router-dom";
import { usePermission } from "../auth/AuthContext";
import { useStore } from "../domain/store";
import { fmtDate } from "../lib/format";
import { appPath } from "../lib/routes";
import { useFormatters } from "../lib/useFormatters";

export default function Dashboard() {
  const { state } = useStore();
  const canNewClient = usePermission("clients.create");
  const canNewLoan = usePermission("loans.create");
  const { money, integer } = useFormatters();
  const activeLoans = state.loans.filter((l) => l.status === "active");
  const overdue = state.installments.filter((i) => i.status === "overdue");
  const totalPrincipal = state.loans.reduce((a, l) => a + l.principal, 0);
  const totalPaid = state.payments.reduce((a, p) => a + p.amount, 0);
  const outstanding = state.installments.reduce(
    (a, i) => a + (i.total - i.paid),
    0
  );

  const upcoming = [...state.installments]
    .filter((i) => i.status === "pending" || i.status === "partial")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);

  const clientName = (id: string) =>
    state.clients.find((c) => c.id === id)?.name ?? "—";
  const loanClient = (loanId: string) => {
    const loan = state.loans.find((l) => l.id === loanId);
    return loan ? clientName(loan.clientId) : "—";
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Panel</h1>
          <p className="page-subtitle">
            Visión general de la cartera de préstamos.
          </p>
        </div>
        <div className="row">
          {canNewClient ? (
            <Link to={appPath("/clientes/nuevo")} className="btn">
              Nuevo cliente
            </Link>
          ) : null}
          {canNewLoan ? (
            <Link to={appPath("/prestamos/nuevo")} className="btn btn-primary">
              Nuevo préstamo
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid cols-4">
        <div className="card">
          <div className="stat-label">Clientes</div>
          <div className="stat-value mono">{integer(state.clients.length)}</div>
          <div className="stat-sub">Total registrados</div>
        </div>
        <div className="card">
          <div className="stat-label">Préstamos activos</div>
          <div className="stat-value mono">{integer(activeLoans.length)}</div>
          <div className="stat-sub">
            {integer(state.loans.length - activeLoans.length)} cerrados
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Saldo pendiente</div>
          <div className="stat-value mono">{money(outstanding)}</div>
          <div className="stat-sub">Sobre {money(totalPrincipal)} prestados</div>
        </div>
        <div className="card">
          <div className="stat-label">Cuotas en mora</div>
          <div className="stat-value mono" style={{ color: overdue.length ? "#fca5a5" : undefined }}>
            {integer(overdue.length)}
          </div>
          <div className="stat-sub">Cobrado total: {money(totalPaid)}</div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <strong>Próximos vencimientos</strong>
            <Link to={appPath("/prestamos")} className="btn btn-ghost">
              Ver todo
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="empty">Sin cuotas programadas aún.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Cuota</th>
                  <th>Vencimiento</th>
                  <th style={{ textAlign: "right" }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link to={appPath(`/prestamos/${i.loanId}`)}>
                        {loanClient(i.loanId)}
                      </Link>
                    </td>
                    <td>#{i.number}</td>
                    <td>{fmtDate(i.dueDate)}</td>
                    <td className="mono" style={{ textAlign: "right" }}>
                      {money(i.total - i.paid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <strong>En mora</strong>
            <span className="chip danger">{overdue.length}</span>
          </div>
          {overdue.length === 0 ? (
            <div className="empty">Sin cuotas vencidas. Bien hecho.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Cuota</th>
                  <th>Venció</th>
                  <th style={{ textAlign: "right" }}>Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {overdue.slice(0, 6).map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link to={appPath(`/prestamos/${i.loanId}`)}>
                        {loanClient(i.loanId)}
                      </Link>
                    </td>
                    <td>#{i.number}</td>
                    <td>{fmtDate(i.dueDate)}</td>
                    <td className="mono" style={{ textAlign: "right" }}>
                      {money(i.total - i.paid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
