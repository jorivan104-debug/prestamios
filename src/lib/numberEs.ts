/**
 * Formato numérico español: miles con punto (.) y decimales con coma (,).
 */

export function formatEsDecimal(n: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

/** Parsea cadenas tipo "1.234,56" o "1234,5" o "1234". */
export function parseSpanishNumber(input: string): number {
  const s = input.replace(/\s/g, "").trim();
  if (!s) return NaN;
  const commaIdx = s.lastIndexOf(",");
  let intRaw: string;
  let decRaw: string;
  if (commaIdx === -1) {
    intRaw = s.replace(/\./g, "");
    decRaw = "";
  } else {
    intRaw = s.slice(0, commaIdx).replace(/\./g, "");
    decRaw = s.slice(commaIdx + 1).replace(/\./g, "").replace(/,/g, "");
  }
  const normalized = decRaw.length ? `${intRaw}.${decRaw}` : intRaw;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export function createMoneyFormatter(currencyCode: string) {
  return (n: number) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
}
