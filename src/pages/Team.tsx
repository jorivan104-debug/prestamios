import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, usePermission } from "../auth/AuthContext";
import { PERMISSION_IDS } from "../auth/catalog";
import {
  assignMemberRole,
  createRole,
  deleteRole,
  inviteOrganizationMember,
  listOrganizationMembersRpc,
  listRolePermissionIds,
  listRoles,
  replaceRolePermissions,
  updateRoleMeta,
  type RoleRow,
} from "../data/remoteData";

const MODULE_LABEL: Record<string, string> = {
  app: "Aplicación",
  clientes: "Clientes",
  prestamos: "Préstamos",
  pagos: "Pagos",
  configuracion: "Configuración",
  equipo: "Equipo",
};

function moduleOf(code: string): string {
  if (code.startsWith("app.")) return "app";
  if (code.startsWith("clients.")) return "clientes";
  if (code.startsWith("loans.")) return "prestamos";
  if (code.startsWith("payments.")) return "pagos";
  if (code.startsWith("org.")) return "configuracion";
  if (code.startsWith("users.") || code.startsWith("roles.")) return "equipo";
  return "otros";
}

export default function Team() {
  const { organizationId, configured, refreshPermissions } = useAuth();
  const canReadRoles = usePermission("roles.read");
  const canUpdateRoles = usePermission("roles.update");
  const canCreateRoles = usePermission("roles.create");
  const canDeleteRoles = usePermission("roles.delete");
  const canAssign = usePermission("users.assign_role");
  const canSeeMembers = usePermission("roles.read") || usePermission("users.invite");
  const canInvite = usePermission("users.invite");

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [permSet, setPermSet] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<
    { user_id: string; email: string; role_id: string; role_name: string }[]
  >([]);
  const [err, setErr] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteErr, setInviteErr] = useState<string | null>(null);

  const selected = useMemo(
    () => roles.find((r) => r.id === selectedId) ?? null,
    [roles, selectedId]
  );

  const load = useCallback(async () => {
    if (!configured || !organizationId || !canReadRoles) return;
    setErr(null);
    try {
      const r = await listRoles(organizationId);
      setRoles(r);
      setSelectedId((prev) => {
        if (prev && r.some((x) => x.id === prev)) return prev;
        return r[0]?.id ?? null;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al cargar roles");
    }
  }, [configured, organizationId, canReadRoles]);

  const loadMembers = useCallback(async () => {
    if (!configured || !organizationId || !canSeeMembers) return;
    try {
      const m = await listOrganizationMembersRpc(organizationId);
      setMembers(m);
    } catch {
      setMembers([]);
    }
  }, [configured, organizationId, canSeeMembers]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (!selectedId || !organizationId || !canReadRoles) {
      setPermSet(new Set());
      return;
    }
    let cancelled = false;
    void listRolePermissionIds(selectedId, organizationId).then((ids) => {
      if (!cancelled) setPermSet(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, organizationId, canReadRoles]);

  const grouped = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const code of PERMISSION_IDS) {
      const mod = moduleOf(code);
      if (!m[mod]) m[mod] = [];
      m[mod].push(code);
    }
    return m;
  }, []);

  const togglePerm = (id: string) => {
    if (!canUpdateRoles) return;
    setPermSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveMatrix = async () => {
    if (!selectedId || !canUpdateRoles) return;
    setSaving(true);
    setErr(null);
    try {
      await replaceRolePermissions(selectedId, organizationId!, [...permSet]);
      await refreshPermissions();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar permisos");
    }
    setSaving(false);
  };

  const onCreateRole = async (e: FormEvent) => {
    e.preventDefault();
    if (!organizationId || !canCreateRoles || !newRoleName.trim()) return;
    setErr(null);
    try {
      const id = await createRole(organizationId, newRoleName.trim(), newRoleDesc.trim());
      setNewRoleName("");
      setNewRoleDesc("");
      await load();
      setSelectedId(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al crear rol");
    }
  };

  const onInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!organizationId || !inviteEmail.trim() || invitePassword.length < 6) return;
    setInviteBusy(true);
    setInviteErr(null);
    setInviteMsg(null);
    try {
      await inviteOrganizationMember(organizationId, {
        email: inviteEmail.trim(),
        password: invitePassword,
        roleId: inviteRoleId || undefined,
      });
      setInviteEmail("");
      setInvitePassword("");
      setInviteMsg("Usuario creado. Ya puede iniciar sesión con ese email y contraseña.");
      await loadMembers();
    } catch (ex) {
      setInviteErr(ex instanceof Error ? ex.message : "No se pudo invitar");
    }
    setInviteBusy(false);
  };

  const onDeleteRole = async (id: string) => {
    if (!canDeleteRoles) return;
    if (!confirm("¿Eliminar este rol? Los miembros no deben usarlo.")) return;
    setErr(null);
    try {
      await deleteRole(id, organizationId!);
      await load();
      setSelectedId(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo eliminar (¿en uso?)");
    }
  };

  const onRenameRole = async () => {
    if (!selected || !canUpdateRoles) return;
    const name = prompt("Nombre del rol", selected.name);
    if (name === null || !name.trim()) return;
    setErr(null);
    try {
      await updateRoleMeta(selected.id, organizationId!, { name: name.trim() });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al renombrar");
    }
  };

  if (!configured) {
    return (
      <div className="page-header">
        <h1 className="page-title">Equipo y roles</h1>
        <p className="page-subtitle">
          Activa el backend: en <code className="mono">.env</code> define{" "}
          <code className="mono">VITE_USE_API=true</code> y ejecuta <code className="mono">npm run dev:all</code>{" "}
          (Vite + API local).
        </p>
      </div>
    );
  }

  if (!canReadRoles) {
    return (
      <div className="page-header">
        <h1 className="page-title">Equipo y roles</h1>
        <p className="page-subtitle">No tienes permiso para ver esta sección.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Equipo y roles</h1>
          <p className="page-subtitle">
            Roles personalizados por organización y permisos atómicos del producto.
          </p>
        </div>
      </div>

      {err ? (
        <div className="chip danger" style={{ marginBottom: 14 }}>
          {err}
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 18 }}>
        <h2 className="page-title" style={{ fontSize: "1.1rem" }}>
          Miembros
        </h2>
        {!canSeeMembers ? (
          <p className="muted">Sin permiso para listar el equipo.</p>
        ) : members.length === 0 ? (
          <p className="muted">No hay miembros o no tienes permiso de lectura.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Rol</th>
                {canAssign ? <th>Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td>{m.email}</td>
                  <td>{m.role_name}</td>
                  {canAssign ? (
                    <td>
                      <select
                        className="btn btn-ghost"
                        style={{ width: "100%", maxWidth: 220 }}
                        value={m.role_id}
                        onChange={async (e) => {
                          if (!organizationId) return;
                          try {
                            await assignMemberRole(organizationId, m.user_id, e.target.value);
                            await loadMembers();
                            await refreshPermissions();
                          } catch (ex) {
                            setErr(ex instanceof Error ? ex.message : "Error al asignar rol");
                          }
                        }}
                      >
                        {roles
                          .filter((r) => !r.is_system || r.id === m.role_id)
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                              {r.is_system ? " (Propietario)" : ""}
                            </option>
                          ))}
                      </select>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canInvite ? (
          <form
            onSubmit={onInvite}
            className="form-grid"
            style={{
              marginTop: 20,
              paddingTop: 18,
              borderTop: "1px solid var(--border, rgba(0,0,0,0.08))",
            }}
          >
            <h3 className="page-title" style={{ fontSize: "1rem", gridColumn: "1 / -1", margin: 0 }}>
              Dar de alta usuario
            </h3>
            <p className="muted" style={{ fontSize: 13, gridColumn: "1 / -1", margin: 0 }}>
              Crea la cuenta aquí (no desde la página de registro público). No puedes asignar el rol
              Propietario; elige otro rol o deja el predeterminado Colaborador.
            </p>
            {inviteErr ? (
              <div className="chip danger" style={{ gridColumn: "1 / -1" }}>
                {inviteErr}
              </div>
            ) : null}
            {inviteMsg ? (
              <div className="chip success" style={{ gridColumn: "1 / -1" }}>
                {inviteMsg}
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="invite-email">Email del nuevo usuario</label>
              <input
                id="invite-email"
                type="email"
                autoComplete="off"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="invite-pass">Contraseña inicial (mín. 6)</label>
              <input
                id="invite-pass"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="invite-role">Rol</label>
              <select
                id="invite-role"
                className="btn btn-ghost"
                style={{ width: "100%", maxWidth: 320 }}
                value={inviteRoleId}
                onChange={(e) => setInviteRoleId(e.target.value)}
              >
                <option value="">Colaborador (predeterminado)</option>
                {roles
                  .filter((r) => !r.is_system)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary" disabled={inviteBusy}>
                {inviteBusy ? "Creando…" : "Crear usuario"}
              </button>
            </div>
          </form>
        ) : (
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            Sin permiso <code className="mono">users.invite</code> no puedes dar de alta cuentas nuevas.
          </p>
        )}
      </div>

      <div className="row" style={{ alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div className="card" style={{ flex: "0 0 220px", minWidth: 200 }}>
          <h2 className="page-title" style={{ fontSize: "1.05rem" }}>
            Roles
          </h2>
          <ul className="nav" style={{ flexDirection: "column", gap: 4 }}>
            {roles.map((r) => (
              <li key={r.id} style={{ listStyle: "none" }}>
                <button
                  type="button"
                  className={r.id === selectedId ? "btn btn-primary" : "btn btn-ghost"}
                  style={{ width: "100%", justifyContent: "flex-start" }}
                  onClick={() => setSelectedId(r.id)}
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
          {canCreateRoles ? (
            <form onSubmit={onCreateRole} style={{ marginTop: 16 }}>
              <div className="field">
                <label>Nuevo rol</label>
                <input
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Nombre"
                />
              </div>
              <div className="field">
                <label>Descripción</label>
                <input
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                Crear rol
              </button>
            </form>
          ) : null}
        </div>

        <div className="card" style={{ flex: "1 1 420px", minWidth: 280 }}>
          {selected ? (
            <>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                <h2 className="page-title" style={{ fontSize: "1.05rem", margin: 0 }}>
                  {selected.name}
                  {selected.is_system ? (
                    <span className="chip" style={{ marginLeft: 8 }}>
                      Sistema
                    </span>
                  ) : null}
                </h2>
                <div className="row" style={{ gap: 8 }}>
                  {canUpdateRoles && !selected.is_system ? (
                    <button type="button" className="btn btn-ghost" onClick={() => void onRenameRole()}>
                      Renombrar
                    </button>
                  ) : null}
                  {canDeleteRoles && !selected.is_system ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void onDeleteRole(selected.id)}
                    >
                      Eliminar
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="muted" style={{ marginBottom: 16 }}>
                {selected.description || "Sin descripción."}
              </p>
              {Object.entries(grouped).map(([mod, codes]) => (
                <div key={mod} style={{ marginBottom: 18 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                    {MODULE_LABEL[mod] ?? mod}
                  </div>
                  <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    {codes.map((code) => (
                      <label key={code} className="row" style={{ gap: 8, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={permSet.has(code)}
                          disabled={!canUpdateRoles}
                          onChange={() => togglePerm(code)}
                        />
                        <span style={{ fontSize: 13 }}>{code}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {canUpdateRoles ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving}
                  onClick={() => void saveMatrix()}
                >
                  {saving ? "Guardando…" : "Guardar permisos del rol"}
                </button>
              ) : null}
            </>
          ) : (
            <p className="muted">Selecciona o crea un rol.</p>
          )}
        </div>
      </div>
    </>
  );
}
