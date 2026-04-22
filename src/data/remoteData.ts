import { apiJson, getToken } from "../lib/api";
import type {
  Client,
  DataState,
  Installment,
  Loan,
  OrganizationSettings,
  Payment,
} from "../domain/types";
import { defaultOrganization } from "../domain/organizationDefaults";
import { applyPaymentToState } from "../domain/paymentApply";

function mapOrg(row: Record<string, unknown>): OrganizationSettings {
  return {
    name: String(row.name ?? defaultOrganization.name),
    logoDataUrl: String(row.logo_data_url ?? row.logoDataUrl ?? ""),
    currency: String(row.currency ?? "EUR"),
    defaultAnnualRate: Number(row.default_annual_rate ?? row.defaultAnnualRate ?? 24),
  };
}

function mapClient(row: Record<string, unknown>): Client {
  return {
    id: String(row.id),
    name: String(row.name),
    document: String(row.document ?? ""),
    phone: row.phone ? String(row.phone) : undefined,
    email: row.email ? String(row.email) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.createdAt ?? row.created_at),
  };
}

function mapLoan(row: Record<string, unknown>): Loan {
  return {
    id: String(row.id),
    clientId: String(row.clientId ?? row.client_id),
    principal: Number(row.principal),
    annualRate: Number(row.annualRate ?? row.annual_rate),
    termCount: Number(row.termCount ?? row.term_count),
    frequency: (row.frequency as Loan["frequency"]) ?? "monthly",
    startDate: String(row.startDate ?? row.start_date).slice(0, 10),
    status: (row.status as Loan["status"]) ?? "active",
    createdAt: String(row.createdAt ?? row.created_at),
  };
}

function mapInstallment(row: Record<string, unknown>): Installment {
  return {
    id: String(row.id),
    loanId: String(row.loanId ?? row.loan_id),
    number: Number(row.number),
    dueDate: String(row.dueDate ?? row.due_date).slice(0, 10),
    principal: Number(row.principal),
    interest: Number(row.interest),
    total: Number(row.total),
    paid: Number(row.paid),
    status: row.status as Installment["status"],
  };
}

function mapPayment(row: Record<string, unknown>): Payment {
  return {
    id: String(row.id),
    loanId: String(row.loanId ?? row.loan_id),
    date: String(row.date).slice(0, 10),
    amount: Number(row.amount),
    method: row.method ? String(row.method) : undefined,
    note: row.note ? String(row.note) : undefined,
    allocations: (row.allocations as Payment["allocations"]) ?? [],
    createdAt: String(row.createdAt ?? row.created_at),
  };
}

function snapshotFromResponse(data: unknown): DataState {
  const d = data as DataState & { organization: OrganizationSettings & Record<string, unknown> };
  if (!d || !d.organization) {
    return {
      organization: { ...defaultOrganization },
      clients: [],
      loans: [],
      installments: [],
      payments: [],
    };
  }
  const o = d.organization;
  if ("logoDataUrl" in o && o.logoDataUrl !== undefined) {
    return {
      organization: {
        name: String(o.name),
        logoDataUrl: String(o.logoDataUrl ?? ""),
        currency: String(o.currency ?? "EUR"),
        defaultAnnualRate: Number(o.defaultAnnualRate ?? 24),
      },
      clients: (d.clients ?? []).map((c) => mapClient(c as unknown as Record<string, unknown>)),
      loans: (d.loans ?? []).map((l) => mapLoan(l as unknown as Record<string, unknown>)),
      installments: (d.installments ?? []).map((i) =>
        mapInstallment(i as unknown as Record<string, unknown>)
      ),
      payments: (d.payments ?? []).map((p) => mapPayment(p as unknown as Record<string, unknown>)),
    };
  }
  return {
    organization: mapOrg(o as unknown as Record<string, unknown>),
    clients: (d.clients ?? []).map((c) => mapClient(c as unknown as Record<string, unknown>)),
    loans: (d.loans ?? []).map((l) => mapLoan(l as unknown as Record<string, unknown>)),
    installments: (d.installments ?? []).map((i) =>
      mapInstallment(i as unknown as Record<string, unknown>)
    ),
    payments: (d.payments ?? []).map((p) => mapPayment(p as unknown as Record<string, unknown>)),
  };
}

export async function loadRemoteState(organizationId: string): Promise<DataState> {
  if (!getToken()) {
    return {
      organization: { ...defaultOrganization },
      clients: [],
      loans: [],
      installments: [],
      payments: [],
    };
  }
  const data = await apiJson<unknown>(`/api/orgs/${organizationId}/state`, { method: "GET" });
  return snapshotFromResponse(data);
}

export async function remoteUpdateOrganization(
  organizationId: string,
  patch: Partial<OrganizationSettings>
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.logoDataUrl !== undefined) body.logoDataUrl = patch.logoDataUrl;
  if (patch.currency !== undefined) body.currency = patch.currency;
  if (patch.defaultAnnualRate !== undefined) body.defaultAnnualRate = patch.defaultAnnualRate;
  await apiJson(`/api/orgs/${organizationId}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function remoteInsertClient(
  organizationId: string,
  c: Omit<Client, "id" | "createdAt">
): Promise<Client> {
  const data = await apiJson<Record<string, unknown>>(
    `/api/orgs/${organizationId}/clients`,
    { method: "POST", body: JSON.stringify(c) }
  );
  return mapClient(data);
}

export async function remoteDeleteClient(organizationId: string, clientId: string): Promise<void> {
  await apiJson(`/api/orgs/${organizationId}/clients/${clientId}`, { method: "DELETE" });
}

export async function remoteInsertLoan(
  organizationId: string,
  l: Omit<Loan, "id" | "status" | "createdAt">
): Promise<{ loan: Loan; installments: Installment[] }> {
  const res = await apiJson<{ loan: Record<string, unknown>; installments: unknown[] }>(
    `/api/orgs/${organizationId}/loans`,
    {
      method: "POST",
      body: JSON.stringify({
        clientId: l.clientId,
        principal: l.principal,
        annualRate: l.annualRate,
        termCount: l.termCount,
        frequency: l.frequency,
        startDate: l.startDate,
      }),
    }
  );
  const loan = mapLoan(res.loan);
  const installments = (res.installments ?? []).map((i) =>
    mapInstallment(i as Record<string, unknown>)
  );
  return { loan, installments };
}

export async function remoteApplyPayment(
  organizationId: string,
  state: DataState,
  loanId: string,
  amount: number,
  date: string,
  method?: string,
  note?: string
): Promise<Payment | null> {
  const { next, payment } = applyPaymentToState(state, loanId, amount, date, method, note);
  if (!payment) return null;
  const row = await apiJson<Record<string, unknown>>(
    `/api/orgs/${organizationId}/loans/${loanId}/payments`,
    {
      method: "POST",
      body: JSON.stringify({ amount, date, method, note }),
    }
  );
  return mapPayment(row);
}

export type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
};

export async function listRoles(organizationId: string): Promise<RoleRow[]> {
  return await apiJson<RoleRow[]>(`/api/orgs/${organizationId}/roles`, { method: "GET" });
}

export async function listRolePermissionIds(roleId: string, organizationId: string): Promise<string[]> {
  return await apiJson<string[]>(
    `/api/orgs/${organizationId}/roles/${roleId}/permissions`,
    { method: "GET" }
  );
}

export async function createRole(
  organizationId: string,
  name: string,
  description: string
): Promise<string> {
  const data = await apiJson<{ id: string }>(`/api/orgs/${organizationId}/roles`, {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
  return data.id;
}

export async function updateRoleMeta(
  roleId: string,
  organizationId: string,
  patch: { name?: string; description?: string }
): Promise<void> {
  await apiJson(`/api/orgs/${organizationId}/roles/${roleId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteRole(
  roleId: string,
  organizationId: string
): Promise<void> {
  await apiJson(`/api/orgs/${organizationId}/roles/${roleId}`, { method: "DELETE" });
}

export async function replaceRolePermissions(
  roleId: string,
  organizationId: string,
  permissionIds: string[]
): Promise<void> {
  await apiJson(`/api/orgs/${organizationId}/roles/${roleId}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permissionIds }),
  });
}

export async function listOrganizationMembersRpc(organizationId: string) {
  return await apiJson<
    { user_id: string; email: string; role_id: string; role_name: string }[]
  >(`/api/orgs/${organizationId}/members`, { method: "GET" });
}

export async function assignMemberRole(
  organizationId: string,
  userId: string,
  roleId: string
): Promise<void> {
  await apiJson(`/api/orgs/${organizationId}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ roleId }),
  });
}

export async function inviteOrganizationMember(
  organizationId: string,
  body: { email: string; password: string; roleId?: string }
): Promise<{ user: { id: string; email: string } }> {
  return await apiJson(`/api/orgs/${organizationId}/members`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
