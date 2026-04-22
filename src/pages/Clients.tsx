import { Link, useNavigate } from "react-router-dom";
import { usePermission } from "../auth/AuthContext";
import { useStore } from "../domain/store";
import { fmtDate } from "../lib/format";
import { appPath } from "../lib/routes";
import { useFormatters } from "../lib/useFormatters";

export default function Clients() {
  const nav = useNavigate();
  const { state, deleteClient } = useStore();
  const { integer } = useFormatters();
  const canCreate = usePermission("clients.create");
  const canDelete = usePermission("clients.delete");

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">
            Personas a las que se les otorga préstamos. Pulsa una fila para abrir su ficha.
          </p>
        </div>
        {canCreate ? (
          <Link to={appPath("/clientes/nuevo")} className="btn btn-primary">
            Nuevo cliente
          </Link>
        ) : null}
      </div>

      <div className="card">
        {state.clients.length === 0 ? (
          <div className="empty">
            Aún no hay clientes registrados.
            {canCreate ? (
              <Link to={appPath("/clientes/nuevo")} className="btn btn-primary">
                Crear el primero
              </Link>
            ) : null}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Documento</th>
                <th>Contacto</th>
                <th>Préstamos</th>
                <th>Alta</th>
                <th style={{ textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {state.clients.map((c) => {
                const count = state.loans.filter((l) => l.clientId === c.id).length;
                return (
                  <tr
                    key={c.id}
                    className="clickable-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => nav(appPath(`/clientes/${c.id}`))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        nav(appPath(`/clientes/${c.id}`));
                      }
                    }}
                  >
                    <td>
                      <strong>{c.name}</strong>
                      {c.notes ? (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {c.notes}
                        </div>
                      ) : null}
                    </td>
                    <td className="mono">{c.document || "—"}</td>
                    <td className="muted">
                      {c.phone ?? ""} {c.email ? `· ${c.email}` : ""}
                    </td>
                    <td className="mono">{integer(count)}</td>
                    <td>{fmtDate(c.createdAt)}</td>
                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        <Link to={appPath(`/clientes/${c.id}`)} className="btn">
                          Abrir
                        </Link>
                        <button
                          className="btn btn-danger"
                          disabled={count > 0 || !canDelete}
                          onClick={() => {
                            if (confirm(`¿Eliminar a ${c.name}?`))
                              void deleteClient(c.id);
                          }}
                          title={
                            count > 0
                              ? "No se puede eliminar: tiene préstamos asociados"
                              : "Eliminar"
                          }
                        >
                          Eliminar
                        </button>
                      </div>
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
