import { Link } from "react-router-dom";
import { usePermission } from "../auth/AuthContext";
import { useStore } from "../domain/store";
import { fmtDate } from "../lib/format";
import { appPath } from "../lib/routes";
import { useFormatters } from "../lib/useFormatters";

export default function Loans() {
  const { state } = useStore();
  const { money, decimal } = useFormatters();
  const canCreate = usePermission("loans.create");

  const clientName = (id: string) =>
    state.clients.find((c) => c.id === id)?.name ?? "—";

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Préstamos</h1>
          <p className="page-subtitle">Cartera completa con estado y saldo.</p>
        </div>
        {canCreate ? (
          <Link to={appPath("/prestamos/nuevo")} className="btn btn-primary">
            Nuevo préstamo
          </Link>
        ) : null}
      </div>

      <div className="card">
        {state.loans.length === 0 ? (
          <div className="empty">
            No hay préstamos registrados.
            {canCreate ? (
              <Link to={appPath("/prestamos/nuevo")} className="btn btn-primary">
                Crear el primero
              </Link>
            ) : null}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
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
              {state.loans.map((l) => {
                const mine = state.installments.filter((i) => i.loanId === l.id);
                const outstanding = mine.reduce((a, i) => a + (i.total - i.paid), 0);
                const overdue = mine.some((i) => i.status === "overdue");
                return (
                  <tr key={l.id}>
                    <td>
                      <Link to={appPath(`/prestamos/${l.id}`)}>
                        <strong>{clientName(l.clientId)}</strong>
                      </Link>
                    </td>
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
                        <span className="chip success">
                          <span className="badge-dot dot-success" /> Cerrado
                        </span>
                      ) : overdue ? (
                        <span className="chip danger">
                          <span className="badge-dot dot-danger" /> En mora
                        </span>
                      ) : (
                        <span className="chip">
                          <span className="badge-dot dot-success" /> Activo
                        </span>
                      )}
                    </td>
                    <td className="mono" style={{ textAlign: "right" }}>
                      {money(outstanding)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link to={appPath(`/prestamos/${l.id}`)} className="btn">
                        Ver
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
