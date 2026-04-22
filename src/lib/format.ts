export { formatEsDecimal, parseSpanishNumber, createMoneyFormatter } from "./numberEs";

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

export const fmtDate = (d: string) => {
  try {
    return dateFmt.format(new Date(d));
  } catch {
    return d;
  }
};

export const today = () => new Date().toISOString().slice(0, 10);
