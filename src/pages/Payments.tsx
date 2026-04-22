import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../domain/store";
import { appPath } from "../lib/routes";
import { fmtDate, today } from "../lib/format";
import { useFormatters } from "../lib/useFormatters";
import NumericInput from "../components/NumericInput";

export default function Payments() {
  const { state, addPayment } = useStore();
  const { money } = useFormatters();

  const [clientId, setClientId] = useState("");
  const [loanId, setLoanId] = useState("");
  const [amount, setAmount] = useState(0);
  const [payDate, setPayDate] = useState(today());
  const [method, setMethod] = useState("efectivo");
  const [note, setNote] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (state.clients.length === 0) {
      setClientId("");
      setLoanId("");
      return;
    }
    if (!clientId || !state.clients.some((c) => c.id === clientId)) {
      setClientId(state.clients[0].id);
    }
  }, [state.clients, clientId]);

  const activeLoansForClient = useMemo(
    () =>
      state.loans.filter((l) => l.clientId === clientId && l.status === "active"),
    [state.loans, clientId]
  );

  useEffect(() => {
    if (activeLoansForClient.length === 0) {
      setLoanId("");
      return;
    }
    if (!loanId || !activeLoansForClient.some((l) => l.id === loanId)) {
      setLoanId(activeLoansForClient[0].id);
    }
  }, [activeLoansForClient, loanId]);

  const clientName = (id: string) => state.clients.find((c) => c.id === id)?.name ?? "—";

  const rows = [...state.payments].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  );

  const onSubmitPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!loanId || amount <= 0) return;
    const created = await addPayment(loanId, amount, payDate, method, note || undefined);
    if (created) {
      setAmount(0);
      setNote("");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pagos</h1>
          <p className="page-subtitle">
            Registro global de cobros y alta de pagos sobre préstamos activos.
          </p>
        </div>
        {savedFlash ? <span className="chip success">Pago registrado</span> : null}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <strong>Registrar nuevo pago</strong>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Elige el cliente y un préstamo <strong>activo</strong>; el importe se imputa a las
            cuotas según las reglas del préstamo.
          </div>
        </div>

        {state.clients.length === 0 ? (
          <div className="empty">
            Necesitas al menos un cliente.
            <Link to={appPath("/clientes/nuevo")} className="btn btn-primary">
              Nuevo cliente
            </Link>
          </div>
        ) : activeLoansForClient.length === 0 ? (
          <div className="empty">
            {clientId
              ? "Este cliente no tiene préstamos activos (cerrados o sin cartera)."
              : "Selecciona un cliente."}
            <Link to={appPath("/prestamos/nuevo")} className="btn btn-primary">
              Nuevo préstamo
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmitPayment}>
            <div className="form-grid">
              <div className="field">
                <label>Cliente</label>
                <select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setLoanId("");
                  }}
                >
                  {state.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Préstamo activo</label>
                <select
                  value={loanId}
                  onChange={(e) => setLoanId(e.target.value)}
                  required
                >
                  {activeLoansForClient.map((l) => {
                    const inst = state.installments.filter((i) => i.loanId === l.id);
                    const pending = inst.reduce((a, i) => a + (i.total - i.paid), 0);
                    return (
                      <option key={l.id} value={l.id}>
                        {money(l.principal)} · pendiente {money(pending)}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="field">
                <label>Monto</label>
                <NumericInput value={amount} fractionDigits={2} min={0} onChange={setAmount} />
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
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="field">
                <label>Nota</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Referencia opcional"
                />
              </div>
            </div>
            <div className="row" style={{ marginTop: 14, justifyContent: "flex-end", gap: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={!loanId || amount <= 0}>
                Registrar pago
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <strong>Historial de pagos</strong>
          <span className="chip muted">{rows.length}</span>
        </div>
        {rows.length === 0 ? (
          <div className="empty">Aún no hay pagos en el historial.</div>
        ) : (
          <div style={{ overflow: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Préstamo</th>
                  <th>Método</th>
                  <th style={{ textAlign: "right" }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const loan = state.loans.find((l) => l.id === p.loanId);
                  const cname = loan ? clientName(loan.clientId) : "—";
                  return (
                    <tr key={p.id}>
                      <td>{fmtDate(p.date)}</td>
                      <td>
                        {loan ? (
                          <Link to={appPath(`/clientes/${loan.clientId}`)}>{cname}</Link>
                        ) : (
                          cname
                        )}
                      </td>
                      <td>
                        {loan ? (
                          <Link to={appPath(`/prestamos/${loan.id}`)} className="mono">
                            {loan.id.slice(0, 8)}…
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="muted">{p.method ?? "—"}</td>
                      <td className="mono" style={{ textAlign: "right" }}>
                        {money(p.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
