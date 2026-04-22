/** Prefijo de la SPA autenticada (relativo al dominio). */
export const APP_BASE = "/app";

export function appPath(sub: string): string {
  if (!sub || sub === "/") return APP_BASE;
  const s = sub.startsWith("/") ? sub : `/${sub}`;
  return `${APP_BASE}${s}`;
}
