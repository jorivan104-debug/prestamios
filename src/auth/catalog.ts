/** Debe coincidir con `permissions` en la migración SQL y con `docs/PERMISSIONS.md`. */
export const PERMISSION_IDS = [
  "app.dashboard.view",
  "clients.read",
  "clients.create",
  "clients.update",
  "clients.delete",
  "loans.read",
  "loans.create",
  "loans.update",
  "payments.read",
  "payments.create",
  "org.settings.manage",
  "users.invite",
  "users.remove",
  "users.assign_role",
  "roles.read",
  "roles.create",
  "roles.update",
  "roles.delete",
] as const;

export type PermissionId = (typeof PERMISSION_IDS)[number];
