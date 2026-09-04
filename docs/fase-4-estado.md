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

## Fuera de esta fase (spec §7)

Lista de precios, costos fijos, cuenta corriente real, integración Tienda
Nube, facturación, canal de venta, edición de fichas, permisos granulares.
Contabilidad de partida doble (Fase 2) y CC (Fase 2) quedan dormidas: sus
tablas siguen ahí pero nada las alimenta desde Movimientos.

## Cierre pendiente (igual que en fases anteriores)

- 👤 Rotar credenciales de Supabase antes de uso real con las socias.
- 👤 Supabase Pro (backups) antes de cargar datos reales.
- 👤 Revisar con Nati/contador los ítems de la sección 7 de la spec (marca
  reutilizable insumo por insumo, estándares del shampoo, fabricación de la
  crema del lote 2, definiciones de meses de stock / % consumido).
