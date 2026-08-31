# Maitén — Sistema de gestión

Sistema de gestión para **Maitén** (cosmética e higiene animal): stock, ventas,
consignaciones, cuentas corrientes y contabilidad interna. Reemplaza al prototipo
HTML monolítico heredado (ver [`docs/legacy/`](docs/legacy/) y
[`docs/revision-inicial.html`](docs/revision-inicial.html)).

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui |
| Base de datos | Supabase (PostgreSQL) |
| ORM / migraciones | Drizzle ORM + drizzle-kit |
| Auth | Supabase Auth (cookies vía `@supabase/ssr`) |
| Datos en cliente | TanStack Query |
| Validación | Zod |
| Hosting | Vercel |

## Puesta en marcha

### 1. Dependencias

```bash
pnpm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

Completá `.env.local` con los datos de tu proyecto Supabase (Project Settings →
API y → Database) y tu `ANTHROPIC_API_KEY`.

### 3. Base de datos

```bash
pnpm db:generate   # genera el SQL de migración a partir de src/db/schema.ts
pnpm db:migrate    # lo aplica sobre Supabase
```

Luego, en el **SQL Editor** de Supabase, corré [`supabase/setup.sql`](supabase/setup.sql)
(vincula `perfiles` con `auth.users`, activa RLS y crea las políticas por rol).

### 4. Usuario admin

En Supabase → Authentication → Users → *Add user*. Después, en el SQL Editor:

```sql
update public.perfiles set rol = 'admin'
where id = (select id from auth.users where email = 'TU_EMAIL');
```

### 5. Desarrollo

```bash
pnpm dev
```

## Scripts

| Script | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` / `pnpm start` | Build de producción y arranque |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:generate` | Genera migración desde el schema |
| `pnpm db:migrate` | Aplica migraciones |
| `pnpm db:push` | Empuja el schema sin archivo de migración (solo dev) |
| `pnpm db:studio` | Drizzle Studio |

## Deploy en Vercel

1. Importá el repo en Vercel (framework detectado: Next.js).
2. Cargá en *Environment Variables* las mismas claves de `.env.local`.
3. Cada push a `main` deploya a producción; cada PR genera un *preview*.

## Estructura

```
src/
  app/
    (auth)/login/     # login público (server action + form)
    (app)/            # área protegida: layout verifica sesión
    providers.tsx     # TanStack Query
  components/
    app-shell.tsx     # topbar + sidebar
    ui/               # shadcn/ui
  db/
    schema.ts         # esquema Drizzle (fuente de verdad del modelo)
    index.ts          # cliente Drizzle (solo servidor)
  lib/
    env.ts            # validación de env públicas con Zod
    supabase/         # clients: browser / server / middleware
  middleware.ts       # refresco de sesión + protección de rutas
supabase/setup.sql    # FK a auth.users, RLS y políticas por rol
docs/                 # revisión inicial + prototipo legacy
```

## Estado

**Fase 1 — esqueleto.** Auth, sesión, protección de rutas y shell listos.
Próximo: módulos Productos, Clientes/Proveedores y Movimientos (ver `Inicio`).
