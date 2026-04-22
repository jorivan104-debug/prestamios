import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../domain/store";
import { appPath } from "../lib/routes";
import { fmtDate } from "../lib/format";
import { useFormatters } from "../lib/useFormatters";

export default function ClientDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { state } = useStore();
  const { money, decimal, integer } = useFormatters();

  const client = state.clients.find((c) => c.id === id);

  const loans = useMemo(
    () => state.loans.filter((l) => l.clientId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.loans, id]
  );

  const loanIds = useMemo(() => new Set(loans.map((l) => l.id)), [loans]);

  const installments = useMemo(
    () => state.installments.filter((i) => loanIds.has(i.loanId)),
    [state.installments, loanIds]
  );

  const payments = useMemo(
    () =>
      state.payments
        .filter((p) => loanIds.has(p.loanId))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [state.payments, loanIds]
  );

  const activeLoans = loans.filter((l) => l.status === "active").length;
  const outstanding = installments.reduce((a, i) => a + (i.total - i.paid), 0);
  const totalPaid = payments.reduce((a, p) => a + p.amount, 0);
  const nextDue = [...installments]
    .filter((i) => i.status !== "paid")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  if (!client) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Cliente</h1>
        </div>
        <div className="empty">
          No se encontró el cliente.
          <button type="button" className="btn" onClick={() => nav(appPath("/clientes"))}>
            Volver
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            <Link to={appPath("/clientes")}>Clientes</Link> / {client.name}
          </div>
          <h1 className="page-title">{client.name}</h1>
          <p className="page-subtitle">
            {client.document ? (
              <span className="mono">{client.document}</span>
            ) : (
              "Sin documento"
            )}
            {client.phone || client.email ? (
              <>
                {" "}
                ·{" "}
                <span className="muted">
                  {[client.phone, client.email].filter(Boolean).join(" · ")}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="row">
          <Link
            to={appPath("/prestamos/nuevo")}
            state={{ clientId: client.id }}
            className="btn btn-primary"
          >
            Nuevo préstamo
          </Link>
        </div>
      </div>

      <div className="grid cols-4">
        <div className="card">
          <div className="stat-label">Préstamos activos</div>
          <div className="stat-value mono">{integer(activeLoans)}</div>
          <div className="stat-sub">{integer(loans.length)} totales</div>
        </div>
        <div className="card">
          <div className="stat-label">Saldo pendiente</div>
          <div className="stat-value mono">{money(outstanding)}</div>
          <div className="stat-sub">Suma de todas las cuotas</div>
        </div>
        <div className="card">
          <div className="stat-label">Total cobrado</div>
          <div className="stat-value mono">{money(totalPaid)}</div>
          <div className="stat-sub">{integer(payments.length)} pagos registrados</div>
        </div>
        <div className="card">
          <div className="stat-label">Próximo vencimiento</div>
          <div className="stat-value mono" style={{ fontSize: 18 }}>
            {nextDue ? fmtDate(nextDue.dueDate) : "—"}
          </div>
          <div className="stat-sub">
            {nextDue ? (
              <>
                Cuota #{nextDue.number} · {money(nextDue.total - nextDue.paid)}
              </>
            ) : (
              "Sin cuotas pendientes"
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <strong>Préstamos de este cliente</strong>
        </div>
        {loans.length === 0 ? (
          <div className="empty">Este cliente aún no tiene préstamos.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Capital</th>
                <th>Tasa</th>
                <th>Plazo</th>
                <th>Inicio</th>
                <th>Estado</th>
                <th style={{ textAlign: "right" }}>Saldo pendiente</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => {
                const mine = state.installments.filter((i) => i.loanId === l.id);
                const o = mine.reduce((a, i) => a + (i.total - i.paid), 0);
                const overdue = mine.some((i) => i.status === "overdue");
                return (
                  <tr key={l.id}>
                    <td className="mono">{money(l.principal)}</td>
                    <td className="mono">{decimal(l.annualRate, 2)} %</td>
                    <td>
                      {l.termCount} ·{" "}
                      <span className="muted">
                        {l.frequency === "monthly"
                          ? "mensual"
                          : l.frequency === "biweekly"
                          ? "quincenal"
                          : "semanal"}
                      </span>
                    </td>
                    <td>{fmtDate(l.startDate)}</td>
                    <td>
                      {l.status === "closed" ? (
                        <span className="chip success">Cerrado</span>
                      ) : overdue ? (
                        <span className="chip danger">En mora</span>
                      ) : (
                        <span className="chip">Activo</span>
                      )}
                    </td>
                    <td className="mono" style={{ textAlign: "right" }}>
                      {money(o)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link to={appPath(`/prestamos/${l.id}`)} className="btn">
                        Abrir
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <strong>Pagos de este cliente</strong>
          <span className="chip muted">{integer(payments.length)}</span>
        </div>
        {payments.length === 0 ? (
          <div className="empty">Sin pagos registrados.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Préstamo</th>
                <th>Método</th>
                <th style={{ textAlign: "right" }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.date)}</td>
                  <td>
                    <Link to={appPath(`/prestamos/${p.loanId}`)} className="mono">
                      {p.loanId.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="muted">{p.method ?? "—"}</td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {money(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
