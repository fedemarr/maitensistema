# Fase 2 — Orden de trabajo para OpenCode

> Este documento es un encargo completo. Construí lo que está acá siguiendo
> **exactamente** los patrones ya establecidos en el módulo **Productos**.
> Federico revisa cada módulo (corre la app) y Claude revisa el código.

---

## 1. Contexto

**Maitén** es un sistema de gestión para un negocio de cosmética e higiene
animal. Reemplaza a un prototipo HTML monolítico (archivado en `docs/legacy/`;
la revisión que motivó la reescritura está en `docs/revision-inicial.html`).

**Ya está hecho (no lo rehagas):**

- Fase 1: Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui
  (variante `base-nova`, sobre `@base-ui/react`), Supabase Auth por cookies,
  protección de rutas (`src/proxy.ts` + `src/app/(app)/layout.tsx`),
  TanStack Query, Drizzle ORM.
- Módulo **Productos** completo: es tu plantilla de referencia para todo.

**El negocio en una frase:** entra mercadería (compra a proveedor o
producción), sale por 8 vías distintas (venta, consignación, canje,
presentación, regalo, rotura, devolución de consignación), y hay que seguir
stock, cuentas corrientes y resultado económico.

Leé `docs/legacy/HANDOFF_TECNICO.md` secciones 4, 5 y 6 para el detalle de
dominio. Es la fuente de verdad funcional.

---

## 2. Convenciones (obligatorias)

Copiá la estructura de Productos. Para cada módulo `X`:

```
src/features/<x>/
  schema.ts     # Zod. Input de formularios. Nada de tipos de Drizzle acá.
  queries.ts    # import "server-only". Lecturas con Drizzle (db.query / db.select).
  actions.ts    # "use server". Mutaciones. SIEMPRE empiezan con requireRole([...]).
  storage.ts    # solo si maneja archivos (ver productos/storage.ts)
src/app/(app)/<x>/
  page.tsx              # Server Component. Llama requireUser() + queries.
  _components/*.tsx     # Client Components ("use client"): formularios, tablas con estado.
  nuevo/page.tsx
  [id]/page.tsx         # ficha / detalle
  [id]/editar/page.tsx
```

**Reglas duras:**

1. **Autorización en las actions.** La conexión de Drizzle usa el rol
   `postgres` y **no pasa por RLS**. Toda `action` que escribe empieza con
   `const user = await requireRole(["admin", "ventas"])` (o `["admin"]` para
   borrados). Ver `src/lib/auth.ts`.
2. **Auditoría.** Después de cada escritura relevante:
   `await registrarAuditoria({ actorId: user.id, accion, entidad, entidadId, datos })`.
3. **Validación con Zod** en la action (`schema.safeParse(input)`), no confíes
   en el cliente. Devolvé `{ ok: false, error }` legible, no tires excepción
   salvo en el guard de rol.
4. **`revalidatePath`** de las rutas afectadas al final de cada mutación.
5. **Columnas `numeric`** de Postgres → Drizzle las devuelve/recibe como
   **string**. Convertí con `Number(...)` al leer y `String(...)` al escribir.
   Usá `fmtMoney` / `fmtNumber` / `fmtDate` de `src/lib/format.ts` para pantalla.
6. **Params de ruta son async** en Next 16: `{ params }: { params: Promise<{ id: string }> }`.
7. **Montos siempre en pesos, enteros para stock.** No decimales de stock.
8. **Español** en todo lo visible y en nombres de columnas/variables de dominio
   (así viene el proyecto). Código y libs en inglés.
9. **Sin `any`.** `pnpm typecheck`, `pnpm lint` y `pnpm build` tienen que pasar
   limpios antes de cada commit.
10. **Un commit por módulo** (o por sub-parte grande), mensaje en español
    explicando el qué y el porqué. No toques `main` sin que esté verde.

**Gotchas de shadcn `base-nova` (NO es Radix):**

- `Button` no tiene `asChild`. Para un link con estilo de botón:
  `<Button render={<Link href="..." />}>Texto</Button>`.
- `Select` (`@base-ui/react`): `onValueChange` recibe `string | null`.
  `SelectItem` no acepta `value=""`. Para "ninguno" usá un centinela
  (ver `SIN_RUBRO = "__none__"` en `productos/_components/producto-form.tsx`).
- Todos los primitivos base-ui usan la prop `render` en lugar de `asChild`.
- Componentes disponibles: button, input, label, card, table, select, switch,
  badge, separator, textarea, sonner. Si necesitás otro:
  `pnpm dlx shadcn@latest add <nombre>` y lo justificás en el commit.

**No hagas:**

- No cambies el esquema de auth ni `src/lib/supabase/*` ni `src/proxy.ts`.
- No toques RLS/policies sin actualizar `supabase/setup.sql` en el mismo commit.
- No agregues dependencias sin necesidad real (y lo aclarás en el commit).
- No metas lógica de negocio en Client Components: van en `actions.ts` / `queries.ts`.
- No borres datos en cascada sin chequear referencias (mirá cómo
  `eliminarProducto` valida movimientos antes de borrar).

---

## 3. Setup que se asume

Antes de arrancar, estas cosas ya están hechas por Federico:

- `.env.local` completo (Supabase + `DATABASE_URL` del pooler + `ANTHROPIC_API_KEY`).
- `pnpm install`, `pnpm db:migrate`, `supabase/setup.sql` corrido, `pnpm db:seed`.
- Usuario admin creado en Supabase Auth con `perfiles.rol = 'admin'`.

Cada vez que agregás tablas: `pnpm db:generate` (crea la migración) y avisás
en el commit que hay que correr `pnpm db:migrate`. Si tocás RLS, actualizás
`supabase/setup.sql` y lo aclarás.

Comandos de verificación: `pnpm typecheck && pnpm lint && pnpm build`.

---

## 4. Módulos a construir (en este orden)

### A. Rubros — página de configuración  ·  chico

`src/features/rubros/` ya tiene `queries.ts` y `actions.ts` (`crearRubro`,
`toggleRubroActivo`). Falta la UI.

- Ruta `/config/rubros`: lista (nombre, activo, acciones) + alta inline.
- Habilitá el ítem "Rubros" en `src/components/app-shell.tsx` (`ready: true`).
- Solo `admin` y `ventas` pueden crear / activar / desactivar.

**Done:** puedo crear un rubro, desactivarlo, y aparece/desaparece del select
de Productos.

---

### B. Clientes  ·  medio

Tabla `clientes` ya existe (`src/db/schema.ts`): nombre, `tipo`
(veterinaria | peluqueria | influencer | mayorista | particular), email,
telefono, cuit, notas, activo.

- `features/clientes/`: schema + queries (`listClientes`, `getCliente`,
  búsqueda por nombre) + actions (`guardarCliente`, `toggleClienteActivo`,
  `eliminarCliente` — bloqueá el borrado si tiene movimientos, igual que productos).
- Rutas `/clientes`, `/clientes/nuevo`, `/clientes/[id]`, `/clientes/[id]/editar`.
- Lista con búsqueda (patrón `productos-list.tsx`) y filtro por `tipo`.
- Ficha: datos + saldo de cuenta corriente (0 por ahora, se completa en F) +
  últimos movimientos (vacío hasta el módulo D).
- Habilitá "Clientes" en el shell.

**Done:** alta/edición/baja de clientes con validación; búsqueda y filtro por tipo andan.

---

### C. Proveedores  ·  medio

Igual que Clientes pero con la tabla `proveedores` (sin `tipo`).
Rutas `/proveedores/*`. Habilitá "Proveedores" en el shell.

**Done:** CRUD completo con las mismas garantías que Clientes.

---

### D. Movimientos — los 8 tipos  ·  GRANDE, es el corazón

Tablas `movimientos` y `movimiento_items` ya existen. **Agregá** la tabla
`medios_pago`:

```
medios_pago: id uuid pk, nombre text unique, es_credito boolean default false,
             activo boolean default true, timestamps
```

Seed (`src/db/seed.ts`): Efectivo, Transferencia, Mercado Pago,
Crédito (`es_credito = true`). Agregá `medio_pago_id uuid` (nullable) a
`movimientos` referenciando `medios_pago`.

**Comportamiento por tipo** (implementalo como una tabla de reglas, no con
`if` sueltos):

| tipo | stock por ítem | pide medio de pago | `total` | tercero | efecto extra |
| --- | --- | --- | --- | --- | --- |
| `ingreso` | **+** suma | opcional | costo real | proveedor (req.) | actualiza `costoPromedio` de la variante (promedio ponderado) |
| `venta` | **−** resta | sí | precio × cant | cliente (opcional) | si el medio es `es_credito` → asiento en CC cliente (débito) |
| `consignacion` | **−** resta | no | 0 | cliente (req., típicamente veterinaria) | crea `consignaciones` en estado `pendiente` (ver H) |
| `canje` | **−** resta | no | 0 (informativo a costo) | cliente (opcional) | — |
| `presentacion` | **−** resta | no | 0 | cliente (opcional) | — |
| `regalo` | **−** resta | no | 0 | cliente (opcional) | — |
| `rotura` | **−** resta | no | 0 | — | — |
| `devolucion_consignacion` | **+** suma | no | 0 | cliente (req.) | cierra una consignación (ver H) |

Reglas:

- Toda la creación de un movimiento va en **una transacción**: inserta
  `movimientos` + `movimiento_items` + aplica el delta de stock a cada
  `variantes.stock` + efectos extra. Si algo falla, rollback.
- **Validá stock** antes de restar en salidas: no permitas dejar stock negativo
  (devolvé `{ ok: false, error }`).
- Movimientos **inmutables** tras crearse. "Editar" = eliminar + recrear.
  `eliminarMovimiento` (solo `admin`) revierte stock y efectos (CC,
  consignación) dentro de una transacción.
- `fecha` la elige el usuario (default hoy).

**UI:**

- `/movimientos`: lista con filtros por tipo, rango de fechas y tercero.
  Columnas: fecha, tipo (badge con color por familia: entrada/salida/venta),
  tercero, ítems (resumen), total.
- `/movimientos/nuevo`: selector de tipo primero; el formulario se adapta
  (muestra/oculta medio de pago y tercero según la tabla de reglas). Agregar
  ítems: elegir producto → variante → cantidad → precio unit (autocompleta de
  `precioLista` en venta, de un input en ingreso). Mostrá stock actual de la
  variante elegida.
- `/movimientos/[id]`: detalle read-only + botón Eliminar (admin).
- Habilitá "Movimientos" en el shell.

**Done:** puedo cargar un ingreso (sube stock), una venta con crédito (baja
stock + deja saldo en CC cliente), una consignación (baja stock + crea
consignación pendiente), y un regalo/rotura (baja stock, total 0). Eliminar
cualquiera revierte todo. Nunca queda stock negativo.

---

### E. Ficha de producto — historial y resumen  ·  chico

Extendé `/productos/[id]` (ya tiene el KPI de stock):

- Historial de movimientos de ese producto (todas sus variantes), filtrable por
  tipo y fecha.
- Resumen por tipo de movimiento en el período: unidades y % sobre el total de
  salidas. (Inspirado en la planilla Excel del handoff, sección 6 Fase 2.)

**Done:** entro a un producto y veo cuánto se vendió / regaló / rompió, con %.

---

### F. Cuentas corrientes (clientes y proveedores)  ·  medio

Agregá tabla:

```
cc_movimientos: id uuid pk, entidad_tipo text ('cliente'|'proveedor'),
  entidad_id uuid, fecha date, debe numeric(12,2) default 0,
  haber numeric(12,2) default 0, concepto text,
  movimiento_id uuid nullable -> movimientos, timestamps
```

- Las ventas a crédito y los ingresos a plazo generan un asiento en CC
  (desde el módulo D, dentro de la misma transacción).
- Acción `registrarPago(entidadTipo, entidadId, monto, fecha, medioPagoId?, concepto?)`:
  inserta el contra-asiento (haber para cliente, debe para proveedor).
- `/cc-clientes` y `/cc-proveedores`: lista de terceros con saldo
  (`sum(debe) - sum(haber)`), y `/cc-clientes/[id]` con el detalle de asientos
  y botón "Registrar pago".
- Saldo del tercero también se muestra en su ficha (módulos B/C).
- Habilitá los dos ítems en el shell.

**Done:** una venta a crédito aparece en la CC del cliente; registro un pago y
el saldo baja; el total cuadra.

---

### G. Reporte económico mensual  ·  medio

- `/reportes`: selector de mes. Por producto: unidades vendidas, ingresos, CMV
  (costo × unidades), resultado bruto y margen %. Totales del período.
  Desglose de salidas por tipo de movimiento (unidades y valorizado a costo).
- Meses de stock (stock actual / promedio de venta mensual) y % consumido, por
  producto, como en la sección 6 del handoff.
- Todo server-side (queries agregadas con Drizzle/SQL). Sin librería de charts
  por ahora: tablas y números. Si más adelante se quiere un gráfico, Recharts.

**Done:** elijo un mes y veo el resultado del negocio con desglose por producto
y por tipo de movimiento.

---

### H. Consignaciones  ·  medio

Agregá:

```
estado_consignacion enum: 'pendiente' | 'vendido' | 'devuelto'
consignaciones: id uuid pk, movimiento_id uuid -> movimientos (la consignación),
  cliente_id uuid -> clientes, fecha date, vence_el date,
  estado estado_consignacion default 'pendiente',
  cierre_movimiento_id uuid nullable -> movimientos, timestamps
```

- Al crear un movimiento `consignacion` (módulo D) se crea la fila
  `consignaciones` con `vence_el` (default: fecha + 30 días, editable).
- `/consignaciones`: lista con estado, vencimiento y alerta visual si está
  vencida y `pendiente`.
- Acciones:
  - `marcarVendida(id)`: estado → `vendido`. Opcionalmente dispara el alta de
    una `venta` por esas unidades (preguntar en UI).
  - `registrarDevolucion(id)`: crea un movimiento `devolucion_consignacion`
    (suma stock), setea estado → `devuelto` y `cierre_movimiento_id`.
- Habilitá "Consignaciones" en el shell.

**Done:** creo una consignación, la veo pendiente con su vencimiento; registro
la devolución y el stock vuelve; marco otra como vendida.

---

### I. Contabilidad de partida doble  ·  GRANDE — diseño primero

**No la implementes de una.** Primero escribí `docs/contabilidad-diseno.md`
con el modelo propuesto (tablas `plan_cuentas`, `asientos`, `asiento_lineas`;
cómo cada tipo de movimiento genera su asiento; cómo se arma el balance) y
**esperá revisión** antes de codear.

Datos de partida: el plan de cuentas del prototipo viejo está en
`docs/legacy/maiten.html` (función `dD()`, array `planCuentas`). Reusalo como
seed.

---

## 5. Entregable

- Rama `fase-2` (o una rama por módulo si preferís PRs chicos).
- Un commit por módulo, verde (`typecheck` + `lint` + `build`).
- Si agregaste tablas: la migración de Drizzle commiteada y una línea en el
  mensaje diciendo "correr `pnpm db:migrate`". Si tocaste RLS:
  `supabase/setup.sql` actualizado.
- Actualizá el bloque "Estado" del `README.md` y la lista "Próximos pasos" de
  `src/app/(app)/page.tsx` a medida que cerrás módulos.
- Al terminar (o al trabarte), dejá un `docs/fase-2-estado.md` breve: qué
  quedó hecho, qué falta, decisiones que tomaste y dudas abiertas.

## 6. Revisión

- **Federico** levanta la app (`pnpm dev`) y prueba cada módulo contra su
  sección "Done".
- **Claude** revisa el código: que siga los patrones, que las transacciones y
  la reversión de stock estén bien, que no haya `any` ni RLS sin cubrir, que
  los `numeric` se manejen como corresponde.
- Los módulos D (Movimientos) e I (Contabilidad) son los críticos: ahí va el
  grueso de la revisión.
