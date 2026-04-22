# Gestor de Préstamos — MVP

Aplicación web (React + TypeScript + Vite) para gestionar préstamos con clientes.
Genera plan de cuotas (sistema francés), registra pagos, imputa a cuotas y estados
(pendiente / parcial / vencida / pagada / cerrado). Incluye **autenticación, roles y
organización** vía **API local** (Node + SQLite + JWT). Modo **demo** sin API: datos solo en el navegador.

Ver `docs/DOCUMENTO-CONSTITUTIVO.md` y `docs/PERMISSIONS.md`.

## Requisitos

- Node.js 18+ y npm.

## Arranque local

**Solo interfaz (demo, `localStorage`):**

```bash
npm install
npm run dev
```

Abre `http://127.0.0.1:5173` (o el puerto que muestre Vite).

**API + front (usuarios, roles, datos en SQLite):**

1. Copia `.env.example` a `.env` y deja `VITE_USE_API=true`.
2. Ejecuta en la raíz del proyecto:

```bash
npm run dev:all
```

- Front: `http://localhost:5173` (proxy `/api` al servidor).
- API: `http://127.0.0.1:3847` (base de datos en `server/data/prestamos.sqlite`).

Solo el servidor: `npm run server`.

## Estructura

- `src/domain/` — tipos, amortización, store (local o remoto vía `remoteData.ts`).
- `src/pages/` — Panel, clientes, préstamos, pagos, login, landing, equipo/roles.
- `server/` — API Express, SQLite, JWT, permisos por rol.
- `supabase/migrations/` — SQL de referencia (esquema similar a Postgres/RLS; el runtime por defecto es el API + SQLite).

## Clonar desde GitHub

```bash
git clone https://github.com/jorivan104-debug/prestamios.git
cd prestamios
npm install
# Opcional: cp .env.example .env  y  VITE_USE_API=true
```
