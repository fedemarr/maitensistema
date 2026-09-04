# Fase 4 — Estado

**Completa y en producción.** https://maitensistema.vercel.app

Los 7 pasos de `docs/ESPECIFICACION_SISTEMA_MAITEN.md` implementados sobre el
proyecto Supabase `zcowjjrsjiuzrlphvzyx` (esquema reemplazado por completo —
ver `supabase/reset.sql`). Detalle de cada paso en los mensajes de commit
(`Fase 4 · Paso 1` a `Paso 7`) y en `docs/fase-4-plan.md`.

## Verificado

- `pnpm typecheck && pnpm lint && pnpm build` en verde.
- Esquema aplicado (migración `0000`, 23 tablas), RLS + FK a `auth.users`
  (`supabase/setup.sql`), seed cargado (spec §8: 2 terminados + recetas v1,
  ~24 insumos, 2 lotes + stock, precio de fabricación, 6 clientes).
- Smoke test autenticado en producción: `/`, `/productos`, `/insumos`,
  `/produccion`, `/stock`, `/movimientos`, `/consignaciones`, `/clientes`,
  `/reportes`, `/config/usuarios` → 200.

## Probado de punta a punta (04/09/2026)

Flujo completo ejecutado con Playwright contra la base real de producción:
compra de insumos → planificar orden → cerrar orden (con rendimiento 96% y
desvío de MP, no solo el caso trivial 100%) → stock actualizado por lote →
venta (FIFO, IVA) → reflejado en Reportes (EERR). Todos los cálculos
verificados a mano y correctos. Quedaron en la base, a pedido del dueño, como
datos de prueba identificables: una compra de insumos, "Lote N.º 3 (test
e2e)" de Crema y una venta a "Consumidor final (Tienda Nube)".

En el mismo testing se encontró y corrigió un bug real: `fmtDate()`
mostraba las fechas un día antes en el huso de Argentina (UTC-3) por parsear
`"YYYY-MM-DD"` como medianoche UTC. Corregido en `src/lib/format.ts`
(commit `bf84037`), ya desplegado.

## Fase 5 — Costos fijos + lista de precios (04/09/2026)

Cierra dos de los pendientes del §7: costos fijos mensuales (`/costos-fijos`,
versionados con vigencia, restan del resultado antes de costos fijos →
**EBIT** en Reportes) y lista de precios retail/mayorista (`/precios`,
versionada igual, precarga el precio en Movimientos → Venta según el tipo
de cliente, siempre editable). Probado E2E con Playwright contra producción;
datos de prueba de este módulo ya limpiados de la base (a diferencia de los
de Fase 4, que quedaron marcados "test e2e" a pedido del dueño).

## Fase 6 — Cuenta corriente de clientes y proveedores (04/09/2026)

Cierra otro pendiente del §7. Tabla `cc_movimientos` (ledger por tercero,
cliente|proveedor). Venta con medio de pago Crédito → debe automático en
la cta. cte. del cliente (por el total facturado con IVA). Compra de
insumos con medio de pago Crédito (campo nuevo) → haber automático en la
cta. cte. del proveedor. Fichas de cliente/proveedor con saldo, historial
y botón Registrar cobro / Registrar pago; listados con columna de saldo.
Probado E2E con Playwright, saldos correctos en cada paso. Reemplaza al
`cc_movimientos` de Fase 2 (que quedó dormido, sin tocar).

## Fuera de esta fase (spec §7)

Integración Tienda Nube, facturación (AFIP), canal de venta, edición de
fichas, permisos granulares. Sin credenciales de Tiendanube ni de AFIP
todavía — ver `docs/tiendanube-diseno.md` y `docs/afip-diseno.md`.
Contabilidad de partida doble (Fase 2) queda dormida: su tabla sigue ahí
pero nada la alimenta desde Movimientos.

## Cierre pendiente (igual que en fases anteriores)

- 👤 Rotar credenciales de Supabase antes de uso real con las socias.
- 👤 Supabase Pro (backups) antes de cargar datos reales.
- 👤 Revisar con Nati/contador los ítems de la sección 7 de la spec (marca
  reutilizable insumo por insumo, estándares del shampoo, fabricación de la
  crema del lote 2, definiciones de meses de stock / % consumido).
