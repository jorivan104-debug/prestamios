import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const defaultPath = path.join(dataDir, "prestamos.sqlite");

let db;

export function getDb() {
  if (db) return db;
  const file = process.env.DATABASE_PATH || defaultPath;
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  return db;
}

function initSchema(database) {
  database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    module TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo_data_url TEXT,
    currency TEXT NOT NULL DEFAULT 'EUR',
    default_annual_rate REAL NOT NULL DEFAULT 24,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_system INTEGER NOT NULL DEFAULT 0,
    UNIQUE (organization_id, name)
  );
  CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
  );
  CREATE TABLE IF NOT EXISTS organization_members (
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles (id),
    PRIMARY KEY (user_id, organization_id)
  );
  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    document TEXT DEFAULT '',
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    client_id TEXT NOT NULL REFERENCES clients (id) ON DELETE RESTRICT,
    principal REAL NOT NULL,
    annual_rate REAL NOT NULL,
    term_count INTEGER NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'biweekly', 'weekly')),
    start_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS installments (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL REFERENCES loans (id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    due_date TEXT NOT NULL,
    principal REAL NOT NULL,
    interest REAL NOT NULL,
    total REAL NOT NULL,
    paid REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    UNIQUE (loan_id, number)
  );
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    loan_id TEXT NOT NULL REFERENCES loans (id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    method TEXT,
    note TEXT,
    allocations TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `);

  const perms = [
    ["app.dashboard.view", "Ver panel", "app"],
    ["clients.read", "Ver clientes", "clientes"],
    ["clients.create", "Crear clientes", "clientes"],
    ["clients.update", "Editar clientes", "clientes"],
    ["clients.delete", "Eliminar clientes", "clientes"],
    ["loans.read", "Ver préstamos", "prestamos"],
    ["loans.create", "Crear préstamos", "prestamos"],
    ["loans.update", "Editar préstamos", "prestamos"],
    ["payments.read", "Ver pagos", "pagos"],
    ["payments.create", "Registrar pagos", "pagos"],
    ["org.settings.manage", "Configuración organización", "configuracion"],
    ["users.invite", "Invitar miembros", "equipo"],
    ["users.remove", "Quitar miembros", "equipo"],
    ["users.assign_role", "Asignar rol", "equipo"],
    ["roles.read", "Ver roles", "equipo"],
    ["roles.create", "Crear roles", "equipo"],
    ["roles.update", "Editar roles y permisos", "equipo"],
    ["roles.delete", "Eliminar roles", "equipo"],
  ];
  const insP = database.prepare(
    "INSERT OR IGNORE INTO permissions (id, description, module) VALUES (?, ?, ?)"
  );
  for (const [id, d, m] of perms) {
    insP.run(id, d, m);
  }
}

export function isMember(d, userId, orgId) {
  const row = d
    .prepare(
      "SELECT 1 FROM organization_members WHERE user_id = ? AND organization_id = ?"
    )
    .get(userId, orgId);
  return Boolean(row);
}

export function userHasPermission(d, userId, orgId, perm) {
  if (!isMember(d, userId, orgId)) return false;
  const row = d
    .prepare(
      `SELECT 1 FROM organization_members m
     JOIN role_permissions rp ON rp.role_id = m.role_id
     WHERE m.user_id = ? AND m.organization_id = ? AND rp.permission_id = ?`
    )
    .get(userId, orgId, perm);
  return Boolean(row);
}

export function getUserPermissionsForOrg(d, userId, orgId) {
  const rows = d
    .prepare(
      `SELECT rp.permission_id as id
     FROM organization_members m
     JOIN role_permissions rp ON rp.role_id = m.role_id
     WHERE m.user_id = ? AND m.organization_id = ?`
    )
    .all(userId, orgId);
  return rows.map((r) => r.id);
}

export function getUserOrgId(d, userId) {
  const row = d
    .prepare("SELECT organization_id FROM organization_members WHERE user_id = ?")
    .get(userId);
  return row ? row.organization_id : null;
}
