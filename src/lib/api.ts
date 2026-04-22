const TOKEN_KEY = "prestamos_api_token";

/** Con `VITE_USE_API=true` el front usa el backend propio (REST + JWT). */
export function isApiEnabled(): boolean {
  return import.meta.env.VITE_USE_API === "true";
}

/** Base URL vacía = rutas relativas `/api/...` (proxy de Vite en desarrollo). */
export function getApiBase(): string {
  return (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string | null): void {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

/** `true` solo si el servidor permite el primer registro público (aún no hay usuarios). */
export async function fetchRegistrationOpen(): Promise<boolean> {
  if (!isApiEnabled()) return false;
  try {
    const data = await apiJson<{ open: boolean }>("/api/auth/registration-open", { method: "GET" });
    return Boolean(data.open);
  } catch {
    return false;
  }
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getApiBase();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      // ignore
    }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
