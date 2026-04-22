import type { Frequency, Installment, Loan } from "./types";

export const periodsPerYear = (freq: Frequency): number => {
  switch (freq) {
    case "monthly":
      return 12;
    case "biweekly":
      return 26;
    case "weekly":
      return 52;
  }
};

export const addPeriod = (date: Date, freq: Frequency, n: number): Date => {
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

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Sistema francés (cuota fija). Tasa periódica = anual / períodos_por_año.
 */
export function buildAmortization(loan: Loan): Installment[] {
  const n = loan.termCount;
  const principal = loan.principal;
  const periodRate = loan.annualRate / 100 / periodsPerYear(loan.frequency);
  const start = new Date(loan.startDate);

  let fixedPayment: number;
  if (periodRate === 0) {
    fixedPayment = principal / n;
  } else {
    fixedPayment =
      (principal * periodRate) / (1 - Math.pow(1 + periodRate, -n));
  }

  const rows: Installment[] = [];
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
      id: crypto.randomUUID(),
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
