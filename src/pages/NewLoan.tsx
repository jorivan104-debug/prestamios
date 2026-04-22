import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useStore } from "../domain/store";
import { appPath } from "../lib/routes";
import { buildAmortization } from "../domain/amortization";
import type { Frequency, Loan } from "../domain/types";
import { fmtDate, today } from "../lib/format";
import { useFormatters } from "../lib/useFormatters";
import NumericInput from "../components/NumericInput";

export default function NewLoan() {
  const nav = useNavigate();
  const location = useLocation();
  const { state, addLoan } = useStore();
  const { money, decimal, integer } = useFormatters();
  const initRef = useRef(false);

  const [form, setForm] = useState({
    clientId: "",
    principal: 1000,
    annualRate: state.organization.defaultAnnualRate,
    termCount: 12,
    frequency: "monthly" as Frequency,
    startDate: today(),
  });

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const fromNav = (location.state as { clientId?: string } | null)?.clientId;
    const cid =
      fromNav && state.clients.some((c) => c.id === fromNav)
        ? fromNav
        : state.clients[0]?.id ?? "";
    setForm((f) => ({
      ...f,
      clientId: cid,
      annualRate: state.organization.defaultAnnualRate,
    }));
  }, [location.state, state.clients, state.organization.defaultAnnualRate]);

  const preview = useMemo(() => {
    if (!form.clientId || form.principal <= 0 || form.termCount <= 0) return [];
    const loan: Loan = {
      id: "preview",
      clientId: form.clientId,
      principal: Number(form.principal),
      annualRate: Number(form.annualRate),
      termCount: Math.round(Number(form.termCount)),
      frequency: form.frequency,
      startDate: form.startDate,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    return buildAmortization(loan);
  }, [form]);

  const colTotals = useMemo(() => {
    if (preview.length === 0) return { principal: 0, interest: 0, total: 0 };
    return preview.reduce(
      (acc, i) => ({
        principal: acc.principal + i.principal,
        interest: acc.interest + i.interest,
        total: acc.total + i.total,
      }),
      { principal: 0, interest: 0, total: 0 }
    );
  }, [preview]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.clientId) return;
    const loan = await addLoan({
      clientId: form.clientId,
      principal: Number(form.principal),
      annualRate: Number(form.annualRate),
      termCount: Math.max(1, Math.round(Number(form.termCount))),
      frequency: form.frequency,
      startDate: form.startDate,
    });
    nav(appPath(`/prestamos/${loan.id}`));
  };

  if (state.clients.length === 0) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Nuevo préstamo</h1>
        </div>
        <div className="empty">
          Necesitas al menos un cliente para crear un préstamo.
          <Link to={appPath("/clientes/nuevo")} className="btn btn-primary">
            Crear cliente
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Nuevo préstamo</h1>
          <p className="page-subtitle">
            Ajusta los parámetros y revisa la <strong>estimación de cuotas</strong> antes de
            confirmar. Sistema francés (cuota fija). Tasa anual por defecto:{" "}
            <span className="mono">{decimal(state.organization.defaultAnnualRate, 2)} %</span>.
          </p>
        </div>
      </div>

      <form className="card" onSubmit={onSubmit}>
        <div style={{ marginBottom: 14 }}>
          <strong>Parámetros del préstamo</strong>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Los importes se muestran en <span className="mono">{state.organization.currency}</span>.
            Puedes modificar valores con formato español (miles con punto, decimales con coma).
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Cliente *</label>
            <select
              required
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            >
              {state.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Fecha de desembolso</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Capital</label>
            <NumericInput
              value={form.principal}
              fractionDigits={2}
              min={0.01}
              onChange={(n) => setForm({ ...form, principal: n })}
            />
          </div>
          <div className="field">
            <label>Tasa anual (%)</label>
            <NumericInput
              value={form.annualRate}
              fractionDigits={2}
              min={0}
              max={100}
              onChange={(n) => setForm({ ...form, annualRate: n })}
            />
          </div>
          <div className="field">
            <label>Número de cuotas</label>
            <NumericInput
              value={form.termCount}
              fractionDigits={0}
              min={1}
              max={600}
              onChange={(n) => setForm({ ...form, termCount: Math.round(n) })}
            />
          </div>
          <div className="field">
            <label>Frecuencia</label>
            <select
              value={form.frequency}
              onChange={(e) =>
                setForm({ ...form, frequency: e.target.value as Frequency })
              }
            >
              <option value="monthly">Mensual</option>
              <option value="biweekly">Quincenal</option>
              <option value="weekly">Semanal</option>
            </select>
          </div>
        </div>

        <hr className="sep" />

        <div
          style={{
            border: "1px solid #2a3f7a",
            borderRadius: 12,
            padding: 16,
            background: "linear-gradient(180deg, #101c3d 0%, #0c1631 100%)",
            marginBottom: 16,
          }}
        >
          <div className="row between" style={{ marginBottom: 8 }}>
            <strong>Estimación de cuotas</strong>
            <span className="chip muted">No se guarda hasta pulsar «Crear préstamo»</span>
          </div>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 14px" }}>
            La tabla siguiente es solo orientativa; al crear el préstamo se fijará el plan en la
            cartera.
          </p>
          <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
            <div>
              <div className="stat-label">Total estimado a pagar</div>
              <div className="stat-value mono">{money(colTotals.total)}</div>
              <div className="stat-sub">
                Suma capital (tabla): {money(colTotals.principal)} · Intereses:{" "}
                {money(colTotals.interest)}
              </div>
            </div>
            <div>
              <div className="stat-label">Cuotas estimadas</div>
              <div className="stat-value mono">{integer(preview.length)}</div>
              <div className="stat-sub">
                Primera cuota: {preview[0] ? fmtDate(preview[0].dueDate) : "—"}
              </div>
            </div>
          </div>
          {preview.length > 0 ? (
            <div
              style={{
                marginTop: 14,
                maxHeight: 340,
                overflow: "auto",
                border: "1px solid var(--border)",
                borderRadius: 10,
              }}
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Vencimiento</th>
                    <th style={{ textAlign: "right" }}>Capital</th>
                    <th style={{ textAlign: "right" }}>Interés</th>
                    <th style={{ textAlign: "right" }}>Cuota</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((i) => (
                    <tr key={i.number}>
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
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#0c1631" }}>
                    <td colSpan={2}>
                      <strong>Totales</strong>
                    </td>
                    <td className="mono" style={{ textAlign: "right" }}>
                      <strong>{money(colTotals.principal)}</strong>
                    </td>
                    <td className="mono" style={{ textAlign: "right" }}>
                      <strong>{money(colTotals.interest)}</strong>
                    </td>
                    <td className="mono" style={{ textAlign: "right" }}>
                      <strong>{money(colTotals.total)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="empty" style={{ marginTop: 12 }}>
              Completa capital, tasa y plazo para ver la estimación.
            </div>
          )}
        </div>

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={() => nav(-1)}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={preview.length === 0}>
            Crear préstamo
          </button>
        </div>
      </form>
    </>
  );
}
