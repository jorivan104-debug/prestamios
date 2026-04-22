import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../domain/store";
import { appPath } from "../lib/routes";

export default function NewClient() {
  const nav = useNavigate();
  const { addClient } = useStore();
  const [form, setForm] = useState({
    name: "",
    document: "",
    phone: "",
    email: "",
    notes: "",
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await addClient({
      name: form.name.trim(),
      document: form.document.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });
    nav(appPath("/clientes"));
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Nuevo cliente</h1>
          <p className="page-subtitle">Datos básicos de contacto e identificación.</p>
        </div>
      </div>

      <form className="card" onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="field">
            <label>Nombre completo *</label>
            <input
              autoFocus
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Documento</label>
            <input
              value={form.document}
              onChange={(e) => setForm({ ...form, document: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Teléfono</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label>Notas</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="row" style={{ marginTop: 18, justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={() => nav(-1)}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Guardar cliente
          </button>
        </div>
      </form>
    </>
  );
}
