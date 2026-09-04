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

## Pendiente de probar de punta a punta (con datos reales)

El flujo completo del proceso (receta → compra de insumos → planificar orden
→ cerrar orden → stock actualizado → movimiento de venta/consignación → EERR)
no se ejecutó todavía contra la base real, solo se verificó que cada pantalla
carga. Conviene correrlo una vez con datos de prueba antes de darle el sistema
a Nati.

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
