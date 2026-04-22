import type {
  DataState,
  Installment,
  Loan,
  Payment,
  PaymentAllocation,
} from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Aplica un pago sobre el estado en memoria (misma lógica que el store local). */
export function applyPaymentToState(
  state: DataState,
  loanId: string,
  amount: number,
  date: string,
  method?: string,
  note?: string
): { next: DataState; payment: Payment | null } {
  const loanInstallments = state.installments
    .filter((i) => i.loanId === loanId)
    .sort((a, b) => a.number - b.number);

  if (loanInstallments.length === 0) {
    return { next: state, payment: null };
  }

  let remaining = amount;
  const allocations: PaymentAllocation[] = [];
  const updatedInstallments = [...state.installments];

  for (const inst of loanInstallments) {
    if (remaining <= 0.005) break;
    const pending = round2(inst.total - inst.paid);
    if (pending <= 0.005) continue;
    const apply = Math.min(remaining, pending);

    const interestAlreadyPaid = Math.min(inst.paid, inst.interest);
    const interestPending = round2(inst.interest - interestAlreadyPaid);
    const toInterest = Math.min(apply, interestPending);
    const toPrincipal = round2(apply - toInterest);

    const idx = updatedInstallments.findIndex((x) => x.id === inst.id);
    const newPaid = round2(inst.paid + apply);
    updatedInstallments[idx] = {
      ...inst,
      paid: newPaid,
      status: newPaid >= inst.total - 0.005 ? "paid" : "partial",
    };

    allocations.push({
      installmentId: inst.id,
      toInterest: round2(toInterest),
      toPrincipal: round2(toPrincipal),
    });
    remaining = round2(remaining - apply);
  }

  const payment: Payment = {
    id: crypto.randomUUID(),
    loanId,
    date,
    amount: round2(amount),
    method,
    note,
    allocations,
    createdAt: new Date().toISOString(),
  };

  const today = new Date().toISOString().slice(0, 10);
  const withStatus = updatedInstallments.map((i) => {
    if (i.loanId !== loanId) return i;
    if (i.paid >= i.total - 0.005) return { ...i, status: "paid" as const };
    if (i.paid > 0)
      return {
        ...i,
        status: i.dueDate < today ? ("overdue" as const) : ("partial" as const),
      };
    return {
      ...i,
      status: i.dueDate < today ? ("overdue" as const) : ("pending" as const),
    };
  });

  const loanClosed = withStatus
    .filter((i) => i.loanId === loanId)
    .every((i) => i.status === "paid");
  const loans: Loan[] = state.loans.map((l) =>
    l.id === loanId ? { ...l, status: loanClosed ? ("closed" as const) : l.status } : l
  );

  return {
    next: {
      ...state,
      installments: withStatus,
      payments: [payment, ...state.payments],
      loans,
    },
    payment,
  };
}
