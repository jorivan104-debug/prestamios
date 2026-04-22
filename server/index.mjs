import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import * as jose from "jose";
import { getDb, isMember, userHasPermission, getUserPermissionsForOrg, getUserOrgId } from "./db.mjs";
import { buildAmortization, applyPaymentToState } from "./loan-math.mjs";

const d = getDb;

const PORT = Number(
  process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 3847)
);
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-insecure-change-in-production"
);

const app = express();
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "12mb" }));

function getAuthUser(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  const token = h.slice(7);
  return jose.jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] })
    .then((r) => {
      return { id: r.payload.sub, email: r.payload.email };
    })
    .catch(() => null);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/** Registro público deshabilitado (administrador creado por el servidor al iniciar). */
app.get("/api/auth/registration-open", (_req, res) => {
  res.json({ open: false });
});

function insertCollaboratorRole(db, orgId) {
  const collabId = randomUUID();
  db.prepare(
    "INSERT INTO roles (id, organization_id, name, description, is_system) VALUES (?, ?, ?, ?, 0)"
  ).run(collabId, orgId, "Colaborador", "Usuario invitado — ajusta permisos en Equipo y roles", 0);
  return collabId;
}

/** Rol no-Propietario para invitados; crea «Colaborador» si la org solo tiene roles de sistema. */
function resolveInviteRoleId(db, orgId, requestedRoleId) {
  const rid = String(requestedRoleId || "").trim();
  if (rid) {
    const r = db
      .prepare("SELECT id, is_system FROM roles WHERE id = ? AND organization_id = ?")
      .get(rid, orgId);
    if (!r) return { error: "bad_role" };
    if (r.is_system) return { error: "No se puede asignar el rol Propietario por invitación" };
    return { roleId: r.id };
  }
  const any = db
    .prepare("SELECT id FROM roles WHERE organization_id = ? AND is_system = 0 LIMIT 1")
    .get(orgId);
  if (any) return { roleId: any.id };
  return { roleId: insertCollaboratorRole(db, orgId) };
}

app.post("/api/auth/register", (_req, res) => {
  return res.status(403).json({
    error:
      "El registro público no está disponible. Usa la cuenta administradora del sistema (inicio de sesión).",
  });
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) {
    return res.status(400).json({ error: "Email y contraseña requeridos" });
  }
  const db = d();
  const u = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!u || !bcrypt.compareSync(password, u.password_hash)) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }
  const token = await new jose.SignJWT({ sub: u.id, email: u.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
  return res.json({
    accessToken: token,
    user: { id: u.id, email: u.email },
  });
});

app.get("/api/auth/me", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const db = d();
  const orgId = getUserOrgId(db, u.id);
  const permissions = orgId ? getUserPermissionsForOrg(db, u.id, orgId) : [];
  return res.json({
    user: { id: u.id, email: u.email },
    organizationId: orgId,
    permissions,
  });
});

app.post("/api/auth/bootstrap", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Nombre requerido" });
  const db = d();
  if (getUserOrgId(db, u.id)) {
    return res.status(400).json({ error: "user_already_has_organization" });
  }
  const orgId = randomUUID();
  const roleId = randomUUID();
  const allPermIds = db.prepare("SELECT id FROM permissions").all().map((x) => x.id);
  const run = db.transaction(() => {
    db.prepare("INSERT INTO organizations (id, name) VALUES (?, ?)").run(orgId, name);
    db.prepare(
      "INSERT INTO roles (id, organization_id, name, description, is_system) VALUES (?, ?, ?, ?, 1)"
    ).run(roleId, orgId, "Propietario", "Control total del sistema");
    const insRP = db.prepare("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
    for (const pid of allPermIds) {
      insRP.run(roleId, pid);
    }
    db.prepare(
      "INSERT INTO organization_members (user_id, organization_id, role_id) VALUES (?, ?, ?)"
    ).run(u.id, orgId, roleId);
    insertCollaboratorRole(db, orgId);
  });
  try {
    run();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "No se pudo crear la organización" });
  }
  const permissions = getUserPermissionsForOrg(db, u.id, orgId);
  return res.json({ organizationId: orgId, permissions });
});

// --- mapeo estado app ---
function mapState(db, orgId) {
  const o = db.prepare("SELECT * FROM organizations WHERE id = ?").get(orgId);
  if (!o) return null;
  const organization = {
    name: o.name,
    logoDataUrl: o.logo_data_url || "",
    currency: o.currency,
    defaultAnnualRate: o.default_annual_rate,
  };
  const clients = db
    .prepare(
      "SELECT * FROM clients WHERE organization_id = ? ORDER BY created_at DESC"
    )
    .all(orgId)
    .map((c) => ({
      id: c.id,
      name: c.name,
      document: c.document || "",
      phone: c.phone || undefined,
      email: c.email || undefined,
      notes: c.notes || undefined,
      createdAt: c.created_at,
    }));
  const loans = db
    .prepare("SELECT * FROM loans WHERE organization_id = ? ORDER BY created_at DESC")
    .all(orgId)
    .map((l) => ({
      id: l.id,
      clientId: l.client_id,
      principal: l.principal,
      annualRate: l.annual_rate,
      termCount: l.term_count,
      frequency: l.frequency,
      startDate: String(l.start_date).slice(0, 10),
      status: l.status,
      createdAt: l.created_at,
    }));
  const loanIds = loans.map((l) => l.id);
  let installments = [];
  if (loanIds.length) {
    const ph = db.prepare(
      `SELECT * FROM installments WHERE loan_id IN (${loanIds.map(() => "?").join(",")})`
    );
    installments = ph.all(...loanIds).map((i) => ({
      id: i.id,
      loanId: i.loan_id,
      number: i.number,
      dueDate: String(i.due_date).slice(0, 10),
      principal: i.principal,
      interest: i.interest,
      total: i.total,
      paid: i.paid,
      status: i.status,
    }));
  }
  const payments = db
    .prepare("SELECT * FROM payments WHERE organization_id = ? ORDER BY created_at DESC")
    .all(orgId)
    .map((p) => ({
      id: p.id,
      loanId: p.loan_id,
      date: String(p.date).slice(0, 10),
      amount: p.amount,
      method: p.method || undefined,
      note: p.note || undefined,
      allocations: JSON.parse(p.allocations || "[]"),
      createdAt: p.created_at,
    }));
  return { organization, clients, loans, installments, payments };
}

app.get("/api/orgs/:orgId/state", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const { orgId } = req.params;
  const db = d();
  if (!isMember(db, u.id, orgId)) {
    return res.status(403).json({ error: "not_member" });
  }
  const st = mapState(db, orgId);
  if (!st) return res.status(404).json({ error: "not_found" });
  return res.json(st);
});

app.patch("/api/orgs/:orgId", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const { orgId } = req.params;
  const db = d();
  if (!isMember(db, u.id, orgId) || !userHasPermission(db, u.id, orgId, "org.settings.manage")) {
    return res.status(403).json({ error: "forbidden" });
  }
  const patch = req.body || {};
  const row = {};
  if (patch.name != null) row.name = String(patch.name);
  if (patch.logoDataUrl != null) row.logo_data_url = patch.logoDataUrl;
  if (patch.currency != null) row.currency = String(patch.currency);
  if (patch.defaultAnnualRate != null) row.default_annual_rate = Number(patch.defaultAnnualRate);
  const sets = Object.keys(row);
  if (sets.length === 0) return res.json({ ok: true });
  const sql = `UPDATE organizations SET ${sets.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`;
  const params = { ...row, id: orgId };
  db.prepare(sql).run(params);
  return res.json({ ok: true });
});

app.post("/api/orgs/:orgId/clients", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const { orgId } = req.params;
  const db = d();
  if (!isMember(db, u.id, orgId) || !userHasPermission(db, u.id, orgId, "clients.create")) {
    return res.status(403).json({ error: "forbidden" });
  }
  const c = req.body;
  const id = randomUUID();
  db.prepare(
    `INSERT INTO clients (id, organization_id, name, document, phone, email, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    orgId,
    String(c.name),
    c.document != null ? String(c.document) : "",
    c.phone != null ? String(c.phone) : null,
    c.email != null ? String(c.email) : null,
    c.notes != null ? String(c.notes) : null
  );
  const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
  return res.json({
    id: row.id,
    name: row.name,
    document: row.document || "",
    phone: row.phone || undefined,
    email: row.email || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
  });
});

app.delete("/api/orgs/:orgId/clients/:clientId", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const { orgId, clientId } = req.params;
  const db = d();
  if (!isMember(db, u.id, orgId) || !userHasPermission(db, u.id, orgId, "clients.delete")) {
    return res.status(403).json({ error: "forbidden" });
  }
  const n = db
    .prepare("SELECT count(*) as n FROM loans WHERE client_id = ? AND organization_id = ?")
    .get(clientId, orgId).n;
  if (n > 0) return res.status(400).json({ error: "client_has_loans" });
  db.prepare("DELETE FROM clients WHERE id = ? AND organization_id = ?").run(clientId, orgId);
  return res.json({ ok: true });
});

app.post("/api/orgs/:orgId/loans", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const { orgId } = req.params;
  const db = d();
  if (!isMember(db, u.id, orgId) || !userHasPermission(db, u.id, orgId, "loans.create")) {
    return res.status(403).json({ error: "forbidden" });
  }
  const b = req.body;
  const loanId = randomUUID();
  const loan = {
    id: loanId,
    clientId: String(b.clientId),
    principal: Number(b.principal),
    annualRate: Number(b.annualRate),
    termCount: Math.round(Number(b.termCount)),
    frequency: b.frequency,
    startDate: String(b.startDate).slice(0, 10),
    status: "active",
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO loans (id, organization_id, client_id, principal, annual_rate, term_count, frequency, start_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`
  ).run(
    loanId,
    orgId,
    loan.clientId,
    loan.principal,
    loan.annualRate,
    loan.termCount,
    loan.frequency,
    loan.startDate
  );
  const schedule = buildAmortization(loan);
  const insI = db.prepare(
    `INSERT INTO installments (id, loan_id, number, due_date, principal, interest, total, paid, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const i of schedule) {
    insI.run(
      i.id,
      loanId,
      i.number,
      i.dueDate,
      i.principal,
      i.interest,
      i.total,
      i.paid,
      i.status
    );
  }
  return res.json({ loan, installments: schedule });
});

app.post("/api/orgs/:orgId/loans/:loanId/payments", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const { orgId, loanId } = req.params;
  const db = d();
  if (!isMember(db, u.id, orgId) || !userHasPermission(db, u.id, orgId, "payments.create")) {
    return res.status(403).json({ error: "forbidden" });
  }
  const b = req.body;
  const amount = Number(b.amount);
  const date = String(b.date).slice(0, 10);
  const state = mapState(db, orgId);
  if (!state) return res.status(404).json({ error: "not_found" });
  const { next, payment } = applyPaymentToState(
    state,
    loanId,
    amount,
    date,
    b.method != null ? String(b.method) : undefined,
    b.note != null ? String(b.note) : undefined
  );
  if (!payment) return res.status(400).json({ error: "no_payment" });
  const payId = randomUUID();
  db.prepare(
    `INSERT INTO payments (id, organization_id, loan_id, date, amount, method, note, allocations) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    payId,
    orgId,
    loanId,
    payment.date,
    payment.amount,
    payment.method || null,
    payment.note || null,
    JSON.stringify(payment.allocations)
  );
  for (const inst of next.installments.filter((i) => i.loanId === loanId)) {
    db.prepare("UPDATE installments SET paid = ?, status = ? WHERE id = ?").run(
      inst.paid,
      inst.status,
      inst.id
    );
  }
  const l = next.loans.find((x) => x.id === loanId);
  if (l) {
    db.prepare("UPDATE loans SET status = ? WHERE id = ?").run(l.status, loanId);
  }
  const pRow = db.prepare("SELECT * FROM payments WHERE id = ?").get(payId);
  return res.json({
    id: pRow.id,
    loanId: pRow.loan_id,
    date: String(pRow.date).slice(0, 10),
    amount: pRow.amount,
    method: pRow.method || undefined,
    note: pRow.note || undefined,
    allocations: JSON.parse(pRow.allocations),
    createdAt: pRow.created_at,
  });
});

// ---- roles / miembros ----
app.get("/api/orgs/:orgId/roles", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const { orgId } = req.params;
  const db = d();
  if (!isMember(db, u.id, orgId) || !userHasPermission(db, u.id, orgId, "roles.read")) {
    return res.status(403).json({ error: "forbidden" });
  }
  const rows = db
    .prepare(
      "SELECT id, name, description, is_system FROM roles WHERE organization_id = ? ORDER BY is_system DESC, name"
    )
    .all(orgId);
  return res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      is_system: Boolean(r.is_system),
    }))
  );
});

app.get("/api/orgs/:orgId/roles/:roleId/permissions", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const { orgId, roleId } = req.params;
  const db = d();
  if (!isMember(db, u.id, orgId) || !userHasPermission(db, u.id, orgId, "roles.read")) {
    return res.status(403).json({ error: "forbidden" });
  }
  const r = db.prepare("SELECT id FROM roles WHERE id = ? AND organization_id = ?").get(roleId, orgId);
  if (!r) return res.status(404).json({ error: "not_found" });
  const pids = db
    .prepare("SELECT permission_id FROM role_permissions WHERE role_id = ?")
    .all(roleId)
    .map((x) => x.permission_id);
  return res.json(pids);
});

app.post("/api/orgs/:orgId/roles", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const { orgId } = req.params;
  const db = d();
  if (!isMember(db, u.id, orgId) || !userHasPermission(db, u.id, orgId, "roles.create")) {
    return res.status(403).json({ error: "forbidden" });
  }
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "name" });
  const id = randomUUID();
  const desc = req.body?.description != null ? String(req.body.description) : "";
  db.prepare("INSERT INTO roles (id, organization_id, name, description, is_system) VALUES (?, ?, ?, ?, 0)").run(
    id,
    orgId,
    name,
    desc
  );
  return res.json({ id });
});

app.patch("/api/orgs/:orgId/roles/:roleId", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const { orgId, roleId } = req.params;
  const db = d();
  if (!isMember(db, u.id, orgId) || !userHasPermission(db, u.id, orgId, "roles.update")) {
    return res.status(403).json({ error: "forbidden" });
  }
  const r = db.prepare("SELECT is_system FROM roles WHERE id = ? AND organization_id = ?").get(roleId, orgId);
  if (!r) return res.status(404).json({ error: "not_found" });
  if (r.is_system) return res.status(400).json({ error: "system_role" });
  if (req.body.name != null) {
    db.prepare("UPDATE roles SET name = ? WHERE id = ?").run(String(req.body.name).trim(), roleId);
  }
  if (req.body.description != null) {
    db.prepare("UPDATE roles SET description = ? WHERE id = ?").run(
      String(req.body.description),
      roleId
    );
  }
  return res.json({ ok: true });
});

app.put("/api/orgs/:orgId/roles/:roleId/permissions", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const { orgId, roleId } = req.params;
  const db = d();
  if (!isMember(db, u.id, orgId) || !userHasPermission(db, u.id, orgId, "roles.update")) {
    return res.status(403).json({ error: "forbidden" });
  }
  const role = db.prepare("SELECT id FROM roles WHERE id = ? AND organization_id = ?").get(roleId, orgId);
  if (!role) return res.status(404).json({ error: "not_found" });
  const permissionIds = Array.isArray(req.body?.permissionIds) ? req.body.permissionIds.map(String) : [];
  const run = db.transaction(() => {
    db.prepare("DELETE FROM role_permissions WHERE role_id = ?").run(roleId);
    const ins = db.prepare("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
    for (const pid of permissionIds) {
      if (db.prepare("SELECT 1 FROM permissions WHERE id = ?").get(pid)) {
        ins.run(roleId, pid);
      }
    }
  });
  run();
  return res.json({ ok: true });
});

app.delete("/api/orgs/:orgId/roles/:roleId", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const { orgId, roleId } = req.params;
  const db = d();
  if (!isMember(db, u.id, orgId) || !userHasPermission(db, u.id, orgId, "roles.delete")) {
    return res.status(403).json({ error: "forbidden" });
  }
  const r = db.prepare("SELECT is_system FROM roles WHERE id = ? AND organization_id = ?").get(roleId, orgId);
  if (!r) return res.status(404).json({ error: "not_found" });
  if (r.is_system) return res.status(400).json({ error: "system" });
  try {
    db.prepare("DELETE FROM roles WHERE id = ?").run(roleId);
  } catch (e) {
    return res.status(400).json({ error: "in_use" });
  }
  return res.json({ ok: true });
});

app.get("/api/orgs/:orgId/members", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const { orgId } = req.params;
  const db = d();
  if (!isMember(db, u.id, orgId)) {
    return res.status(403).json({ error: "not_member" });
  }
  if (
    !userHasPermission(db, u.id, orgId, "roles.read") &&
    !userHasPermission(db, u.id, orgId, "users.invite")
  ) {
    return res.status(403).json({ error: "forbidden" });
  }
  const rows = db
    .prepare(
      `SELECT m.user_id, u.email, m.role_id, r.name as role_name
     FROM organization_members m
     JOIN users u ON u.id = m.user_id
     JOIN roles r ON r.id = m.role_id
     WHERE m.organization_id = ?`
    )
    .all(orgId);
  return res.json(
    rows.map((x) => ({
      user_id: x.user_id,
      email: x.email,
      role_id: x.role_id,
      role_name: x.role_name,
    }))
  );
});

app.patch("/api/orgs/:orgId/members/:targetUserId", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const { orgId, targetUserId } = req.params;
  const db = d();
  if (!isMember(db, u.id, orgId) || !userHasPermission(db, u.id, orgId, "users.assign_role")) {
    return res.status(403).json({ error: "forbidden" });
  }
  const roleId = String(req.body?.roleId || "");
  const roleRow = db
    .prepare("SELECT id, is_system FROM roles WHERE id = ? AND organization_id = ?")
    .get(roleId, orgId);
  if (!roleRow) return res.status(400).json({ error: "bad_role" });
  const mem = db
    .prepare("SELECT role_id FROM organization_members WHERE user_id = ? AND organization_id = ?")
    .get(targetUserId, orgId);
  if (!mem) return res.status(404).json({ error: "not_found" });
  const isSystemRole = Number(roleRow.is_system) === 1;
  if (isSystemRole && mem.role_id !== roleId) {
    return res.status(400).json({
      error:
        "No se puede asignar el rol Propietario: solo un administrador por organización y no se traspasa desde aquí.",
    });
  }
  if (mem.role_id === roleId) {
    return res.json({ ok: true });
  }
  db.prepare("UPDATE organization_members SET role_id = ? WHERE user_id = ? AND organization_id = ?").run(
    roleId,
    targetUserId,
    orgId
  );
  return res.json({ ok: true });
});

app.post("/api/orgs/:orgId/members", async (req, res) => {
  const u = await getAuthUser(req);
  if (!u) return res.status(401).json({ error: "No autorizado" });
  const { orgId } = req.params;
  const db = d();
  if (!isMember(db, u.id, orgId) || !userHasPermission(db, u.id, orgId, "users.invite")) {
    return res.status(403).json({ error: "forbidden" });
  }
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || password.length < 6) {
    return res.status(400).json({ error: "Email y contraseña (mín. 6 caracteres) requeridos" });
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    return res.status(400).json({ error: "Ese email ya está registrado" });
  }
  const rolePick = resolveInviteRoleId(db, orgId, req.body?.roleId);
  if (rolePick.error) {
    return res.status(400).json({ error: rolePick.error });
  }
  const newUserId = randomUUID();
  const hash = bcrypt.hashSync(password, 10);
  try {
    db.transaction(() => {
      db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(
        newUserId,
        email,
        hash
      );
      db.prepare(
        "INSERT INTO organization_members (user_id, organization_id, role_id) VALUES (?, ?, ?)"
      ).run(newUserId, orgId, rolePick.roleId);
    })();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "No se pudo crear el usuario" });
  }
  return res.status(201).json({ user: { id: newUserId, email } });
});

// SPA estática (producción Docker): sirve dist/ y fallback a index.html
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");
const spaIndex = path.join(distDir, "index.html");
if (fs.existsSync(spaIndex)) {
  app.use(express.static(distDir, { index: false }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "not_found" });
    }
    res.sendFile(spaIndex, (err) => (err ? next(err) : undefined));
  });
  app.use((req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "not_found" });
    }
    res.status(404).send("Not found");
  });
} else {
  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "server_error" });
});

app.listen(PORT, "0.0.0.0", () => {
  const dbPath = process.env.DATABASE_PATH || "server/data/prestamos.sqlite";
  const spa = fs.existsSync(spaIndex) ? " + SPA" : "";
  console.log(`Servidor http://0.0.0.0:${PORT}${spa} (db: ${dbPath})`);
});
