import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  Client,
  DataState,
  Installment,
  Loan,
  OrganizationSettings,
  Payment,
} from "./types";
import { buildAmortization } from "./amortization";
import { defaultOrganization } from "./organizationDefaults";
import { applyPaymentToState } from "./paymentApply";
import {
  loadRemoteState,
  remoteApplyPayment,
  remoteDeleteClient,
  remoteInsertClient,
  remoteInsertLoan,
  remoteUpdateOrganization,
} from "../data/remoteData";

const STORAGE_KEY = "prestamos-app:v1";

const seed = (): DataState => ({
  organization: { ...defaultOrganization },
  clients: [],
  loans: [],
  installments: [],
  payments: [],
});

const newId = () => crypto.randomUUID();

export type StoreMode = "local" | "remote";

function load(): DataState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as Partial<DataState>;
    const base = seed();
    return {
      ...base,
      ...parsed,
      organization: {
        ...defaultOrganization,
        ...(parsed.organization ?? {}),
      },
    };
  } catch {
    return seed();
  }
}

function save(state: DataState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

interface StoreApi {
  state: DataState;
  mode: StoreMode;
  updateOrganization: (patch: Partial<OrganizationSettings>) => Promise<void>;
  addClient: (c: Omit<Client, "id" | "createdAt">) => Promise<Client>;
  deleteClient: (id: string) => Promise<void>;
  addLoan: (l: Omit<Loan, "id" | "status" | "createdAt">) => Promise<Loan>;
  addPayment: (
    loanId: string,
    amount: number,
    date: string,
    method?: string,
    note?: string
  ) => Promise<Payment | null>;
  recomputeStatuses: () => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export const StoreProvider: React.FC<{
  children: React.ReactNode;
  mode?: StoreMode;
  organizationId?: string | null;
}> = ({ children, mode = "local", organizationId = null }) => {
  const remote = mode === "remote" && !!organizationId;
  const [state, setState] = useState<DataState>(() => (remote ? seed() : load()));

  useEffect(() => {
    if (!remote || !organizationId) return;
    let cancelled = false;
    void loadRemoteState(organizationId).then((data) => {
      if (!cancelled) setState(data);
    });
    return () => {
      cancelled = true;
    };
  }, [remote, organizationId]);

  useEffect(() => {
    if (remote) return;
    save(state);
  }, [state, remote]);

  const recomputeStatuses = useCallback(() => {
    setState((prev) => {
      const today = new Date().toISOString().slice(0, 10);
      const installments = prev.installments.map((i) => {
        if (i.paid >= i.total - 0.005) {
          return { ...i, status: "paid" as const };
        }
        if (i.paid > 0 && i.paid < i.total) {
          return { ...i, status: i.dueDate < today ? ("overdue" as const) : ("partial" as const) };
        }
        return {
          ...i,
          status: i.dueDate < today ? ("overdue" as const) : ("pending" as const),
        };
      });
      const loans = prev.loans.map((l) => {
        const mine = installments.filter((i) => i.loanId === l.id);
        const closed = mine.length > 0 && mine.every((i) => i.status === "paid");
        return { ...l, status: closed ? ("closed" as const) : ("active" as const) };
      });
      return { ...prev, installments, loans };
    });
  }, []);

  useEffect(() => {
    if (remote) return;
    recomputeStatuses();
  }, [recomputeStatuses, remote]);

  const updateOrganization: StoreApi["updateOrganization"] = useCallback(
    async (patch) => {
      if (remote && organizationId) {
        await remoteUpdateOrganization(organizationId, patch);
        setState((s) => ({
          ...s,
          organization: { ...s.organization, ...patch },
        }));
        return;
      }
      setState((s) => ({
        ...s,
        organization: { ...s.organization, ...patch },
      }));
    },
    [remote, organizationId]
  );

  const addClient: StoreApi["addClient"] = useCallback(
    async (c) => {
      if (remote && organizationId) {
        const client = await remoteInsertClient(organizationId, c);
        setState((s) => ({ ...s, clients: [client, ...s.clients] }));
        return client;
      }
      const client: Client = {
        ...c,
        id: newId(),
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, clients: [client, ...s.clients] }));
      return client;
    },
    [remote, organizationId]
  );

  const deleteClient: StoreApi["deleteClient"] = useCallback(
    async (id) => {
      if (remote && organizationId) {
        await remoteDeleteClient(organizationId, id);
        setState((s) => ({ ...s, clients: s.clients.filter((c) => c.id !== id) }));
        return;
      }
      setState((s) => {
        const hasLoans = s.loans.some((l) => l.clientId === id);
        if (hasLoans) return s;
        return { ...s, clients: s.clients.filter((c) => c.id !== id) };
      });
    },
    [remote, organizationId]
  );

  const addLoan: StoreApi["addLoan"] = useCallback(
    async (l) => {
      if (remote && organizationId) {
        const { loan, installments } = await remoteInsertLoan(organizationId, l);
        setState((s) => ({
          ...s,
          loans: [loan, ...s.loans],
          installments: [...s.installments, ...installments],
        }));
        return loan;
      }
      const loan: Loan = {
        ...l,
        id: newId(),
        status: "active",
        createdAt: new Date().toISOString(),
      };
      const schedule = buildAmortization(loan);
      setState((s) => ({
        ...s,
        loans: [loan, ...s.loans],
        installments: [...s.installments, ...schedule],
      }));
      return loan;
    },
    [remote, organizationId]
  );

  const addPayment: StoreApi["addPayment"] = useCallback(
    async (loanId, amount, date, method, note) => {
      if (remote && organizationId) {
        const snapshot = await loadRemoteState(organizationId);
        const createdPay = await remoteApplyPayment(
          organizationId,
          snapshot,
          loanId,
          amount,
          date,
          method,
          note
        );
        const next = await loadRemoteState(organizationId);
        setState(next);
        return createdPay;
      }
      let created: Payment | null = null;
      setState((s) => {
        const { next, payment } = applyPaymentToState(
          s,
          loanId,
          amount,
          date,
          method,
          note
        );
        if (!payment) return s;
        created = payment;
        return next;
      });
      return created;
    },
    [remote, organizationId]
  );

  const resetAll = useCallback(() => {
    if (remote) return;
    setState(seed());
  }, [remote]);

  const api = useMemo<StoreApi>(
    () => ({
      state,
      mode: remote ? "remote" : "local",
      updateOrganization,
      addClient,
      deleteClient,
      addLoan,
      addPayment,
      recomputeStatuses,
      resetAll,
    }),
    [
      state,
      remote,
      updateOrganization,
      addClient,
      deleteClient,
      addLoan,
      addPayment,
      recomputeStatuses,
      resetAll,
    ]
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
};

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function useInstallmentsForLoan(loanId: string): Installment[] {
  const { state } = useStore();
  return useMemo(
    () =>
      state.installments
        .filter((i) => i.loanId === loanId)
        .sort((a, b) => a.number - b.number),
    [state.installments, loanId]
  );
}
