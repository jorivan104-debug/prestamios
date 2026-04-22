# Supabase — puesta en marcha

## 1. Crear proyecto

1. Crea un proyecto en [Supabase](https://supabase.com).
2. En **SQL Editor**, ejecuta el contenido de [`supabase/migrations/20260422130000_rbac_and_business.sql`](../supabase/migrations/20260422130000_rbac_and_business.sql) (o usa la CLI de Supabase para aplicar migraciones).

## 2. Autenticación

- En **Authentication → Providers**, habilita **Email**.
- Para desarrollo, puedes desactivar temporalmente **“Confirm email”** para probar registro + RPC sin buzón.

## 3. Variables de entorno (Vite)

Crea `.env.local` en la raíz del repo (no se sube a git):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Si estas variables **no** existen, la aplicación usa **solo modo local** (`localStorage`) y las rutas `/login` / `/register` muestran aviso de configuración.

## 4. Flujo de alta

1. **Registro** (`/register`): crea usuario en Supabase Auth y llama a la RPC `bootstrap_my_organization` con el nombre de la organización.
2. Se crean: fila `organizations`, rol **Propietario** (`is_system`), todos los `role_permissions`, y `organization_members`.
3. **Inicio de sesión** (`/login`): tras autenticar, la app carga la organización del miembro y los datos de negocio desde Postgres.

## 5. Seguridad

- La clave **anon** es pública en el front; la seguridad real viene de **RLS** y de no exponer la **service_role**.
- Revisa políticas antes de producción y habilita confirmación por email.
