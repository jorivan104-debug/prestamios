import { FormEvent, useEffect, useMemo, useState } from "react";
import { useStore } from "../domain/store";
import NumericInput from "../components/NumericInput";
import { createMoneyFormatter } from "../lib/numberEs";

const CURRENCIES = [
  { code: "EUR", label: "Euro (EUR)" },
  { code: "USD", label: "Dólar EE.UU. (USD)" },
  { code: "COP", label: "Peso colombiano (COP)" },
  { code: "MXN", label: "Peso mexicano (MXN)" },
  { code: "ARS", label: "Peso argentino (ARS)" },
  { code: "CLP", label: "Peso chileno (CLP)" },
  { code: "PEN", label: "Sol peruano (PEN)" },
  { code: "GBP", label: "Libra esterlina (GBP)" },
];

export default function Settings() {
  const { state, updateOrganization, mode } = useStore();
  const org = state.organization;
  const [name, setName] = useState(org.name);
  const [currency, setCurrency] = useState(org.currency);
  const [rate, setRate] = useState(org.defaultAnnualRate);
  const [savedFlash, setSavedFlash] = useState(false);

  const previewMoney = useMemo(() => createMoneyFormatter(currency), [currency]);

  useEffect(() => {
    setName(org.name);
    setCurrency(org.currency);
    setRate(org.defaultAnnualRate);
  }, [org.name, org.currency, org.defaultAnnualRate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await updateOrganization({
      name: name.trim() || org.name,
      currency,
      defaultAnnualRate: rate,
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const onLogo = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === "string") void updateOrganization({ logoDataUrl: r });
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">
            Datos de la organización y valores por defecto de la aplicación.
            {mode === "remote" ? " Los cambios se guardan en el servidor." : null}
          </p>
        </div>
        {savedFlash ? <span className="chip success">Cambios guardados</span> : null}
      </div>

      <form className="card" onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="org-name">Nombre de la organización</label>
            <input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Cooperativa Los Andes"
            />
          </div>
          <div className="field">
            <label htmlFor="org-currency">Moneda de la aplicación</label>
            <select
              id="org-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Vista previa: {previewMoney(1234567.89)}
            </div>
          </div>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>Logo</label>
          <div className="row" style={{ gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 12,
                border: "1px solid var(--border)",
                overflow: "hidden",
                background: "var(--input-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {org.logoDataUrl ? (
                <img
                  src={org.logoDataUrl}
                  alt="Logo"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <span className="muted" style={{ fontSize: 11, textAlign: "center", padding: 6 }}>
                  Sin logo
                </span>
              )}
            </div>
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onLogo(e.target.files?.[0] ?? null)}
              />
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                {mode === "remote"
                  ? "Se guarda en la base de datos (data URL). Para logos grandes, comprime la imagen antes."
                  : "Se guarda en el navegador (data URL). Para logos grandes, comprime la imagen antes."}
              </div>
              {org.logoDataUrl ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ marginTop: 10 }}
                  onClick={() => void updateOrganization({ logoDataUrl: "" })}
                >
                  Quitar logo
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="field" style={{ marginTop: 14, maxWidth: 280 }}>
          <label htmlFor="org-rate">Tasa anual predeterminada (%)</label>
          <NumericInput
            id="org-rate"
            value={rate}
            fractionDigits={2}
            min={0}
            max={100}
            onChange={setRate}
          />
        </div>

        <div className="row" style={{ marginTop: 20, justifyContent: "flex-end" }}>
          <button type="submit" className="btn btn-primary">
            Guardar configuración
          </button>
        </div>
      </form>
    </>
  );
}
