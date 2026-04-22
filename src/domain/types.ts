export type InstallmentStatus = "pending" | "partial" | "paid" | "overdue";
export type LoanStatus = "active" | "closed";
export type Frequency = "monthly" | "biweekly" | "weekly";

export interface Client {
  id: string;
  name: string;
  document: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
}

export interface Installment {
  id: string;
  loanId: string;
  number: number;
  dueDate: string;
  principal: number;
  interest: number;
  total: number;
  paid: number;
  status: InstallmentStatus;
}

export interface PaymentAllocation {
  installmentId: string;
  toInterest: number;
  toPrincipal: number;
}

export interface Payment {
  id: string;
  loanId: string;
  date: string;
  amount: number;
  method?: string;
  note?: string;
  allocations: PaymentAllocation[];
  createdAt: string;
}

export interface Loan {
  id: string;
  clientId: string;
  principal: number;
  annualRate: number;
  termCount: number;
  frequency: Frequency;
  startDate: string;
  status: LoanStatus;
  createdAt: string;
}

export interface OrganizationSettings {
  name: string;
  /** Data URL (base64) o cadena vacía si no hay logo. */
  logoDataUrl: string;
  /** Código ISO 4217 (EUR, USD, COP, …). */
  currency: string;
  /** Tasa anual nominal por defecto al crear préstamos (%). */
  defaultAnnualRate: number;
}

export interface DataState {
  organization: OrganizationSettings;
  clients: Client[];
  loans: Loan[];
  installments: Installment[];
  payments: Payment[];
}
