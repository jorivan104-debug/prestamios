import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiJson, getToken, isApiEnabled, setToken } from "../lib/api";

type SimpleUser = { id: string; email: string };

type MeResponse = {
  user: SimpleUser;
  organizationId: string | null;
  permissions: string[];
};

type AuthContextValue = {
  ready: boolean;
  configured: boolean;
  user: SimpleUser | null;
  organizationId: string | null;
  permissions: Set<string>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  bootstrapOrganization: (name: string) => Promise<{ error?: string }>;
  refreshPermissions: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<MeResponse> {
  return await apiJson<MeResponse>("/api/auth/me", { method: "GET" });
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const configured = isApiEnabled();
  const [ready, setReady] = useState(!configured);
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());

  const applyMe = useCallback((me: MeResponse) => {
    setUser(me.user);
    setOrganizationId(me.organizationId);
    setPermissions(new Set(me.permissions ?? []));
  }, []);

  const refreshPermissions = useCallback(async () => {
    if (!configured) {
      setUser(null);
      setOrganizationId(null);
      setPermissions(new Set());
      return;
    }
    if (!getToken()) {
      setUser(null);
      setOrganizationId(null);
      setPermissions(new Set());
      return;
    }
    try {
      const me = await fetchMe();
      applyMe(me);
    } catch {
      setToken(null);
      setUser(null);
      setOrganizationId(null);
      setPermissions(new Set());
    }
  }, [applyMe, configured]);

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      if (!getToken()) {
        if (!cancelled) {
          setUser(null);
          setOrganizationId(null);
          setPermissions(new Set());
          setReady(true);
        }
        return;
      }
      try {
        const me = await fetchMe();
        if (!cancelled) applyMe(me);
      } catch {
        if (!cancelled) {
          setToken(null);
          setUser(null);
          setOrganizationId(null);
          setPermissions(new Set());
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyMe, configured]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!configured) return { error: "API no activada" };
      try {
        const data = await apiJson<{ accessToken: string; user: SimpleUser }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setToken(data.accessToken);
        const me = await fetchMe();
        applyMe(me);
        return {};
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Error de inicio de sesión" };
      }
    },
    [applyMe, configured]
  );

  const signOut = useCallback(async () => {
    if (!configured) return;
    setToken(null);
    setUser(null);
    setOrganizationId(null);
    setPermissions(new Set());
  }, [configured]);

  const bootstrapOrganization = useCallback(
    async (name: string) => {
      if (!configured) return { error: "API no activada" };
      try {
        const data = await apiJson<{ organizationId: string; permissions: string[] }>(
          "/api/auth/bootstrap",
          { method: "POST", body: JSON.stringify({ name }) }
        );
        setOrganizationId(data.organizationId);
        setPermissions(new Set(data.permissions));
        return {};
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Error" };
      }
    },
    [configured]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      configured,
      user,
      organizationId,
      permissions,
      signIn,
      signOut,
      bootstrapOrganization,
      refreshPermissions,
    }),
    [
      ready,
      configured,
      user,
      organizationId,
      permissions,
      signIn,
      signOut,
      bootstrapOrganization,
      refreshPermissions,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

export function usePermission(code: string): boolean {
  const { permissions, configured } = useAuth();
  if (!configured) return true;
  return permissions.has(code);
}
