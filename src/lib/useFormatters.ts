import { useMemo } from "react";
import { useStore } from "../domain/store";
import { createMoneyFormatter, formatEsDecimal } from "./numberEs";

export function useFormatters() {
  const { state } = useStore();
  const code = state.organization.currency;
  return useMemo(
    () => ({
      money: createMoneyFormatter(code),
      /** Número con miles `.` y decimales `,` (sin símbolo de moneda). */
      decimal: formatEsDecimal,
      /** Enteros con separador de miles (sin decimales). */
      integer: (n: number) => formatEsDecimal(n, 0),
    }),
    [code]
  );
}
