import { FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useInstallmentsForLoan, useStore } from "../domain/store";
import { appPath } from "../lib/routes";
import { fmtDate, today } from "../lib/format";
import { useFormatters } from "../lib/useFormatters";
import NumericInput from "../components/NumericInput";

export default function LoanDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { state, addPayment } = useStore();
  const { money, decimal, integer } = useFormatters();
  const loan = state.loans.find((l) => l.id === id);
  const installments = useInstallmentsForLoan(id);
  const payments = state.payments.filter((p) => p.loanId === id);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>(today());
  const [payMethod, setPayMethod] = useState<string>("efectivo");
  const [payNote, setPayNote] = useState<string>("");

  if (!loan) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Préstamo</h1>
        </div>
        <div className="empty">
          No se encontró el préstamo.
          <button className="btn" onClick={() => nav(appPath("/prestamos"))}>
            Volver
          </button>
        </div>
      </>
    );
  }

  const client = state.clients.find((c) => c.id === loan.clientId);
  const outstanding = installments.reduce((a, i) => a + (i.total - i.paid), 0);
  const paidAmount = installments.reduce((a, i) => a + i.paid, 0);
  const nextDue = installments.find((i) => i.status !== "paid");

  const onPay = async (e: FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0) return;
    const created = await addPayment(loan.id, Number(payAmount), payDate, payMethod, payNote);
    if (created) {
      setPayAmount(0);
      setPayNote("");
    }
  };

  const statusChip = (s: string) => {
    if (s === "paid")
      return (
        <span className="chip success">
          <span className="badge-dot dot-success" /> Pagada
        </span>
      );
    if (s === "overdue")
      return (
        <span className="chip danger">
          <span className="badge-dot dot-danger" /> Vencida
        </span>
      );
    if (s === "partial")
      return (
        <span className="chip warn">
          <span className="badge-dot dot-warn" /> Parcial
        </span>
      );
    return (
      <span className="chip">
        <span className="badge-dot dot-muted" /> Pendiente
      </span>
    );
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            <Link to={appPath("/prestamos")}>Préstamos</Link> /{" "}
            <span className="mono">{loan.id.slice(0, 6)}</span>
            {client ? (
              <>
                {" "}
                ·{" "}
                <Link to={appPath(`/clientes/${client.id}`)}>{client.name}</Link>
              </>
            ) : null}
          </div>
          <h1 className="page-title">{client?.name ?? "Cliente"}</h1>
          <p className="page-subtitle">
            {money(loan.principal)} · {decimal(loan.annualRate, 2)} % anual · {integer(loan.termCount)}{" "}
            {loan.frequency === "monthly"
              ? "cuotas mensuales"
              : loan.frequency === "biweekly"
              ? "cuotas quincenales"
              : "cuotas semanales"}
          </p>
        </div>
        <div>
          {loan.status === "closed" ? (
            <span className="chip success">
              <span className="badge-dot dot-success" /> Cerrado
            </span>
          ) : (
            <span className="chip">
              <span className="badge-dot dot-success" /> Activo
            </span>
          )}
        </div>
      </div>

      <div className="grid cols-3">
        <div className="card">
          <div className="stat-label">Saldo pendiente</div>
          <div className="stat-value mono">{money(outstanding)}</div>
          <div className="stat-sub">Pagado: {money(paidAmount)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Próxima cuota</div>
          <div className="stat-value mono">
            {nextDue ? money(nextDue.total - nextDue.paid) : "—"}
          </div>
          <div className="stat-sub">
            {nextDue ? `#${nextDue.number} · ${fmtDate(nextDue.dueDate)}` : "Todas pagadas"}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Desembolso</div>
          <div className="stat-value mono" style={{ fontSize: 20 }}>
            {fmtDate(loan.startDate)}
          </div>
          <div className="stat-sub">Creado: {fmtDate(loan.createdAt)}</div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 20 }}>
        <div className="card">
          <div style={{ marginBottom: 10 }}>
            <strong>Registrar pago</strong>
          </div>
          <form onSubmit={onPay}>
            <div className="form-grid">
              <div className="field">
                <label>Monto</label>
                <NumericInput
                  value={payAmount}
                  fractionDigits={2}
                  min={0}
                  onChange={setPayAmount}
                />
              </div>
              <div className="field">
                <label>Fecha</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Método</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="field">
                <label>Nota</label>
                <input
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Referencia, observación…"
                />
              </div>
            </div>
            <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  nextDue && setPayAmount(Number((nextDue.total - nextDue.paid).toFixed(2)))
                }
                disabled={!nextDue}
              >
                Pagar cuota siguiente
              </button>
              <button type="submit" className="btn btn-primary" disabled={outstanding <= 0}>
                Registrar pago
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <strong>Historial de pagos</strong>
            <span className="chip muted">{integer(payments.length)}</span>
          </div>
          {payments.length === 0 ? (
            <div className="empty">Aún no se han registrado pagos.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Método</th>
                  <th style={{ textAlign: "right" }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.date)}</td>
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
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 10 }}>
          <strong>Plan de cuotas</strong>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Vencimiento</th>
              <th style={{ textAlign: "right" }}>Capital</th>
              <th style={{ textAlign: "right" }}>Interés</th>
              <th style={{ textAlign: "right" }}>Cuota</th>
              <th style={{ textAlign: "right" }}>Pagado</th>
              <th style={{ textAlign: "right" }}>Pendiente</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {installments.map((i) => (
              <tr key={i.id}>
                <td className="mono">{i.number}</td>
                <td>{fmtDate(i.dueDate)}</td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {money(i.principal)}
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {money(i.interest)}
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {money(i.total)}
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {money(i.paid)}
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {money(Math.max(0, i.total - i.paid))}
                </td>
                <td>{statusChip(i.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
