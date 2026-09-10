@AGENTS.md

# Arquitectura — sistema de gestión Maitén

Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui **base-nova**
(sobre `@base-ui/react`, no Radix: usa `render` en vez de `asChild`;
`Select` `onValueChange` devuelve `string | null`; `SelectItem` no admite
`value=""` → se usan centinelas como `__none__`). Datos: Supabase Postgres +
Auth (cookies, `@supabase/ssr`) + Storage + RLS. ORM: Drizzle
(`casing: "snake_case"`, TS camelCase ↔ SQL snake_case; `numeric` viaja como
string). Deploy: Vercel, auto-deploy en push a `main`.

## Rendimiento (leer antes de tocar performance)

- La base está en **`sa-east-1` (São Paulo)**. Las funciones de Vercel deben
  correr en **`gru1`** — `vercel.json` lo fija. Si se saca, cada request cruza
  ~120 ms EE.UU.↔Brasil y la app se siente congelada.
- `DATABASE_URL` usa el **pooler en modo SESIÓN, puerto `5432`**
  (`prepare: false`, `max: 3` en `src/db/index.ts`). **NO usar el `6543`**
  (modo transacción): `postgres.js` pipelinea consultas concurrentes y
  Supavisor transaccional se cuelga con `Promise.all` de 6+ queries.
- Las páginas son todas dinámicas (server-render por request). Cada
  navegación hace: middleware `getUser()` + page `getUser()` + query de
  `perfiles` + queries de datos. No agregar más round-trips en serie —
  `Promise.all` para queries independientes.
- Listas que crecen (`listMovimientos`, `listAsientos`) tienen tope de 500.

## Rutas clave (`src/app/(app)/`)

`/` dashboard · `movimientos` (+`/nuevo`) · `produccion` (+`/fabrica`) ·
`stock` · `consignaciones` · `productos/[id]` · `insumos` (+`/compra`) ·
`precios` · `clientes/[id]` · `proveedores/[id]` · `reportes` ·
`finanzas` (+`/asientos`, `/plan-cuentas`, `/balance-general`, `/resultados`) ·
`costos-fijos` · `seguridad` · `config/{rubros,usuarios}`.

## Convenciones

- **Un feature = `src/features/<x>/{schema,queries,actions}.ts`** (+ `lib/`).
  `schema.ts` = Zod + labels (importable desde cliente). `queries.ts` =
  `"server-only"`, solo lectura. `actions.ts` = `"use server"`, cada acción
  abre con `requireRole([...])` (`src/lib/auth.ts`) y cierra con
  `registrarAuditoria(...)` (`src/lib/audit.ts`) + `revalidatePath`.
- **Autorización SIEMPRE en la Server Action.** Drizzle usa el rol `postgres`
  y saltea RLS; RLS es defensa en profundidad, no la barrera.
- Modelo de stock (spec §1): stock = entradas − salidas, **por lote**
  (`stock_lotes`, CHECK ≥ 0), consumo **FIFO** (`tomarFifo` en
  `src/lib/stock.ts`), **PPP móvil por producto**. Nada mueve stock fuera de
  `movimientos`. Producción cerrada genera un movimiento `produccion`.
- **Todo sin IVA** (spec v1.2 §1.5): compras, precio de fábrica, PPP, precios
  de venta e ingresos son netos. El "con IVA" es display (× 1,21).
- Valores que cambian en el tiempo (precio de fábrica, recetas, costos fijos,
  precios de venta) se guardan **con vigencia** (`vigente_desde` /
  `vigente_hasta`), nunca se pisan.
- Cada venta/compra/producción/cobro/pago genera su **asiento de partida
  doble** (`src/features/finanzas/lib/posting.ts`) dentro de la misma
  transacción del hecho. Plan de cuentas sembrado en `drizzle/0003`.
- Migraciones: `pnpm db:generate` (drizzle-kit) + `pnpm db:migrate`
  (`scripts/db-migrate.ts`, transaccional; `drizzle-kit migrate` aborta en
  silencio con el pooler). `pnpm db:setup` aplica `supabase/setup.sql` (RLS).
- Spec funcional: `docs/ESPECIFICACION_SISTEMA_MAITEN_v1.2.md`. Estado por
  fase: `docs/fase-4-estado.md`.

## No aplica a este repo

"Portal de socios / estado societario / códigos QR / Redis" son de otro
proyecto (`lcsistemagestion`). "Prompt caching / /compact / CLAUDE.md para el
agente" es config de Claude Code, no del runtime de la app.
