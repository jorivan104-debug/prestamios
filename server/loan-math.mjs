import { randomUUID } from "node:crypto";

/**
 * Misma lógica que `src/domain/amortization.ts` y `src/domain/paymentApply.ts`.
 */
const round2 = (n) => Math.round(n * 100) / 100;

const periodsPerYear = (freq) => {
  switch (freq) {
    case "monthly":
      return 12;
    case "biweekly":
      return 26;
    case "weekly":
      return 52;
  }
};

const addPeriod = (date, freq, n) => {
  const d = new Date(date);
  switch (freq) {
    case "monthly":
      d.setMonth(d.getMonth() + n);
      return d;
    case "biweekly":
      d.setDate(d.getDate() + n * 14);
      return d;
    case "weekly":
      d.setDate(d.getDate() + n * 7);
      return d;
  }
};

export function buildAmortization(loan) {
  const n = loan.termCount;
  const principal = loan.principal;
  const periodRate = loan.annualRate / 100 / periodsPerYear(loan.frequency);
  const start = new Date(loan.startDate);
  let fixedPayment;
  if (periodRate === 0) {
    fixedPayment = principal / n;
  } else {
    fixedPayment = (principal * periodRate) / (1 - Math.pow(1 + periodRate, -n));
  }
  const rows = [];
  let balance = principal;
  for (let i = 1; i <= n; i++) {
    const interest = round2(balance * periodRate);
    let principalPart = round2(fixedPayment - interest);
    let total = round2(fixedPayment);
    if (i === n) {
      principalPart = round2(balance);
      total = round2(principalPart + interest);
    }
    balance = round2(balance - principalPart);
    if (i === n) balance = 0;
    rows.push({
      id: randomUUID(),
      loanId: loan.id,
      number: i,
      dueDate: addPeriod(start, loan.frequency, i).toISOString().slice(0, 10),
      principal: principalPart,
      interest,
      total,
      paid: 0,
      status: "pending",
    });
  }
  return rows;
}

export function applyPaymentToState(state, loanId, amount, date, method, note) {
  const loanInstallments = state.installments
    .filter((i) => i.loanId === loanId)
    .sort((a, b) => a.number - b.number);
  if (loanInstallments.length === 0) {
    return { next: state, payment: null };
  }
  let remaining = amount;
  const allocations = [];
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
  const payment = {
    id: randomUUID(),
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
    if (i.paid >= i.total - 0.005) return { ...i, status: "paid" };
    if (i.paid > 0) return { ...i, status: i.dueDate < today ? "overdue" : "partial" };
    return { ...i, status: i.dueDate < today ? "overdue" : "pending" };
  });
  const loanClosed = withStatus
    .filter((i) => i.loanId === loanId)
    .every((i) => i.status === "paid");
  const loans = state.loans.map((l) =>
    l.id === loanId ? { ...l, status: loanClosed ? "closed" : l.status } : l
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
