# Fase 3 — Estado

Rama `fase-3`. Hecha por Claude (no OpenCode). P0 completo; P1/P2 pendientes.

## Hecho (P0 — cierre del circuito de stock)

### J. Insumos / Materia prima
- `productos.es_insumo` (migración `0005`). Un insumo es un `producto` con
  `es_insumo = true`: reutiliza variantes, stock, costo y el motor de movimientos.
- Rutas `/insumos` y `/insumos/nuevo` (reusan `ProductosList` y `ProductoForm`
  con `esInsumo`). La ficha y la edición usan las de `/productos/[id]`.
- `/productos` ahora filtra `es_insumo = false`; `/insumos` filtra `true`.
- `listVariantesActivas(esInsumo)` en `features/productos/queries` para los
  selectores de recetas y órdenes.
- Ítem "Insumos" en el sidebar (Registros).

### K. Recetas (lista de materiales)
- Tablas `recetas` + `receta_items`. Una receta activa por variante de
  terminado; al re-guardar se desactiva la anterior (histórico).
- `features/recetas/` (schema Zod, queries, `guardarReceta`). Valida que el
  destino sea terminado y los ítems sean insumos, sin repetir.
- UI: `RecetaEditor` en la ficha de cada producto terminado (una card por
  variante activa). `rinde` = unidades por lote base; cada ítem lleva cantidad
  y `% merma`.

### L. Órdenes de producción
- Tabla `ordenes_produccion` + enum `estado_orden_produccion`
  (`borrador | en_proceso | completada | anulada`).
- Nuevo tipo de movimiento `produccion` (enum `tipo_movimiento`). **No** es
  creable desde `/movimientos/nuevo` (`movimientoInput` no lo acepta); se genera
  solo al completar una orden.
- `features/produccion/`:
  - `crearOrden`: exige receta activa. Estado `borrador`, no toca stock.
  - `completarOrden` (transacción, invariantes de stock de la Fase 2):
    consumo por insumo = `ceil(receta.cantidad * orden.cantidad / receta.rinde *
    (1 + merma%))`; valida stock de cada insumo dentro de la transacción; baja
    insumos (atómico), sube terminado (atómico) y recalcula su `costoPromedio`
    ponderado; `costo_unit` snapshot en cada ítem; orden → `completada`.
  - `anularOrden` (solo `admin` para completadas): revierte el movimiento
    exacto (insumos +, terminado −), con chequeo de no dejar el terminado
    negativo (si ya se vendió lo producido, no deja anular). Borradores → anula
    sin efecto de stock.
- Rutas `/produccion`, `/produccion/nueva`, `/produccion/[id]` (requerimientos
  insumo por insumo con requerido / disponible / falta, costo estimado, botones
  Completar / Anular).
- Ítem "Producción" en el sidebar (Operación).

### Integración con módulos existentes
- `verificarStock()` entiende `produccion` (insumo resta, terminado suma, por
  join a `productos.es_insumo`).
- `eliminarMovimiento` rechaza los `produccion` (hay que anular la orden).
- Contabilidad: `produccion` **no genera asiento** — es una transformación
  interna de valor dentro de Mercadería (insumo → terminado), neta cero. Igual
  criterio que `ajuste`. Documentado en `asientos.ts`.
- Ficha de producto: historial entiende el signo de `produccion` según si el
  producto es insumo o terminado.

### Extra (venía de la revisión de Fase 2)
- `db:migrate` ahora es un script propio (`scripts/db-migrate.ts`): corre cada
  `.sql` pendiente en su transacción y lo registra. `drizzle-kit migrate`
  abortaba en silencio en este entorno (NOTICE de "schema drizzle already
  exists" + timestamps de journal fuera de orden). `drizzle-kit generate`
  se sigue usando igual.

## Limitaciones conocidas / deudas

- **Stock de insumos entero.** El consumo fraccionario de la receta se redondea
  **hacia arriba** por insumo. Sirve para envases (1:1) y aproxima líquidos;
  para precisión fina habría que llevar el stock de insumos en unidad base
  (ml/g) como entero, o pasar `variantes.stock` a `numeric`.
- `anularOrden` de una orden completada **no revierte** el `costoPromedio` del
  terminado (misma limitación que `eliminarMovimiento`).
- Una receta es por variante de terminado; si un producto tiene varias
  variantes, se cargan por separado.
- No hay versión editable de órdenes: se anula y se crea otra.

## Cómo probar (puerta de aceptación P0)

1. `pnpm db:migrate && pnpm db:seed` (deja 3 insumos de ejemplo).
2. En `/insumos`, entrá a cada insumo y con un movimiento **ajuste** cargale
   stock (ej: Base 100, Esencia 20, Envases 200).
3. En la ficha del "Shampoo Aloe Vera y Rosa Mosqueta" → **Cargar receta**:
   rinde 40; Base 8, Esencia 0.5, Envase 250 ml 40.
4. `/produccion/nueva` → Shampoo, cantidad 40 → **Completar orden**: bajan los
   insumos, suben 40 u. de shampoo, su `costoPromedio` refleja el costo real.
5. `/stock` → `verificarStock()` no debe encontrar diferencias.
6. `anularOrden` → todo vuelve (salvo el costo promedio, ver limitaciones).
7. Probar falta de stock: subí la cantidad y verificá que la orden **no** se
   completa y dice qué insumo falta.

## P1 / P2

- **M. Usuarios y reset de contraseña** — ✅ hecho. `/config/usuarios` (admin:
  invitar por email, cambiar rol, activar/desactivar) + `/recuperar` y
  `/actualizar-clave` + `/auth/callback`. Requiere configurar en Supabase el
  Site URL y los Redirect URLs (ver README). Email nativo de Supabase está
  rate-limited; para producción conectar SMTP propio (Resend).
- **N. IA de análisis** — pausado por decisión del usuario (no ahora).
- **O. Tiendanube** — diseño en `docs/tiendanube-diseno.md`. Recomendación:
  integrar Tiendanube ahora (webhook de ventas + cron de sync de stock) y, a
  futuro, tienda propia como route group `(tienda)/` en este mismo repo.
- **P. AFIP** — diseño en `docs/afip-diseno.md`. Recomendación: empezar con un
  campo manual de nº de comprobante; luego un servicio intermediario
  (AfipSDK / TusFacturas). Falta definir condición fiscal con el contador.

## Cierre para producción (§5 de fase-3-opencode.md)

- ✅ RLS de las tablas nuevas (`recetas`, `receta_items`, `ordenes_produccion`)
  en `supabase/setup.sql`, aplicado.
- ✅ Todas las Server Actions nuevas usan `requireRole`.
- ✅ Seed con insumos de ejemplo.
- 👤 **Rotar credenciales de Supabase** (la publishable key vieja quedó en el
  historial del repo; service key y password circularon en chat).
- 👤 **Supabase Pro** (~$25/mes) por los backups diarios y para que la base no
  se pause.
- 👤 Configurar Site URL / Redirect URLs de Auth y (para emails reales) SMTP.
