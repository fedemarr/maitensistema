# Fase 4 — Implementación de la especificación funcional

Fuente: `docs/ESPECIFICACION_SISTEMA_MAITEN.md` v1.0 + mockup
`docs/maiten-proceso-completo_14.html` v14. Este documento traduce la spec a
un plan de implementación sobre el sistema actual.

## Alcance

Rework del núcleo de dominio. Cambia el modelo de stock, insumos, recetas,
producción, movimientos, consignaciones, clientes y reportes. No hay datos
reales en producción (solo seed), así que el esquema se **reemplaza** en vez de
migrarse con cuidado.

### Se mantiene
`perfiles`, `rubros`, `proveedores`, `auditoria`, todo Auth/usuarios (Fase 3 M),
la UI shell + dashboard, y el patrón `features/<x>/{schema,queries,actions}`.

### Se reemplaza / reescribe
`productos`, `variantes`→(desaparece: producto = su presentación),
`recetas`/`receta_items` (pasan a versionadas), `movimientos`/`movimiento_items`
(modelo nuevo con FIFO por lote), `ordenes_produccion` (dos etapas),
`consignaciones` (saldo por cliente+producto+lote), `clientes` (6 tipos),
`medios_pago` (lista fija), reportes.

### Se desacopla
**Contabilidad de partida doble** (Fase 2 módulo I): la spec dice que
Contabilidad no se toca "por ahora" y que el reporte económico es el EERR. El
generador automático de asientos desde movimientos (`generarAsientoMovimiento`)
**se desconecta** — el modelo nuevo de movimiento no lo alimenta. Las tablas
`plan_cuentas` / `asientos` / `asiento_lineas` quedan pero sin alimentación
automática. Se retoma si vuelve a pedirse.

### Principios que no se violan (spec §1)
1. Stock terminado = Σ entradas − Σ salidas. Nada lo mueve fuera de Movimientos.
2. El tipo de movimiento define solo: si descuenta stock y cómo pega en el EERR.
3. La receta es física pura, sin precios, versionada con vigencia.
4. El costo del producto terminado lo calcula Producción al cerrar la orden.
5. Datos maestros (cliente, lote, insumo, producto): se eligen, no se tipean.

---

## Modelo de datos (esquema nuevo)

Nombres definitivos en `src/db/schema.ts`. Convención de siempre: TS camelCase,
Postgres snake_case; `numeric` como string; `requireRole` en toda action.

### Catálogo

- **productos** — id, sku (uniq), nombre, rubro_id, presentacion, stock_minimo,
  online (bool), es_insumo (bool: false=terminado), activo, ppp
  (numeric, mantenido por Producción/compras), timestamps.
  *(Se elimina `variantes`: cada producto es su presentación. Se elimina
  `precio_lista`.)*
- **recetas** — id, producto_id, numero (int: 1,2,…), vigente_desde (date),
  vigente_hasta (date null=vigente), notas, timestamps.
  Restricción: una sola vigente por producto (vigente_hasta null).
- **receta_lineas** — id, receta_id, insumo_id (→productos con es_insumo=true),
  cantidad_por_unidad (numeric 14,4), unidad ('kg'|'u').

### Insumos y compras

- Insumos = `productos` con `es_insumo=true`. Además:
  **insumo_atributos** (o columnas en productos): reutilizable (bool),
  vence (bool), unidad ('kg'|'u'), proveedor_habitual_id. *(Se resuelve como
  columnas nullable en `productos`, solo aplican si es_insumo.)*
- **lotes** — id, nombre (uniq), fecha, producto_id (nullable: un lote puede
  abarcar los dos productos), timestamps. Dato maestro.
- **compras_insumo** — id, fecha, proveedor_id (nullable), lote_id (nullable),
  total (numeric), creado_por, timestamps.
- **compra_insumo_lineas** — id, compra_id, insumo_id, cantidad (numeric 14,4),
  costo_total (numeric), costo_unitario (numeric), vencimiento (date null).
- **bajas_insumo** — id, fecha, insumo_id, cantidad (numeric 14,4), motivo
  (enum: vencido | secado | no_reutilizable | rotura | ajuste_inventario),
  monto (numeric = cantidad × ppp), lote_id (null), orden_id (null si fue
  automática al cerrar un lote), creado_por, timestamps.
- Stock de insumo = Σ compras − Σ consumos de órdenes − Σ bajas. Se calcula;
  conviene materializar en `productos.stock_insumo` o vista.
- PPP insumo tras compra: `(stock·ppp + Σ costo_total) / (stock + Σ cantidad)`.

### Producción

- **precios_fabricacion** — id, monto_por_lote (numeric), vigente_desde (date),
  vigente_hasta (date null). La fábrica cobra un monto por lote, no por unidad.
- **ordenes_produccion** — id, producto_id, lote_id, receta_id (congelada),
  estado (enum: planificada | cerrada | anulada), fecha_prevista,
  fecha_cierre (null), unidades_planificadas (int), unidades_obtenidas (int
  null), fabricacion_cotizada (numeric), fabricacion_cobrada (numeric null),
  costo_mp (numeric null), costo_total (numeric null), costo_unitario (numeric
  null), desvio_mp (numeric), desvio_fabricacion (numeric),
  movimiento_entrada_id (null), creado_por, timestamps.
- **orden_lineas** — id, orden_id, insumo_id, cantidad_estandar (numeric 14,4),
  consumo_teorico (numeric), consumo_real (numeric null), ppp_al_cierre
  (numeric null), desvio_fisico (numeric), desvio_monto (numeric).
- Planificar: no mueve stock. Cerrar: transacción que (a) descuenta consumo
  real del stock de insumos, (b) da de baja sobrantes no reutilizables del lote
  (baja automática → pérdida), (c) genera el movimiento `produccion` de entrada
  con `costo_total`, (d) recalcula `productos.ppp` del terminado (PPP móvil),
  (e) marca la orden cerrada.

### Stock por lote

- **stock_lotes** — producto_id, lote_id, unidades_en_deposito (int).
  Materializada; se deriva de los movimientos (entradas suman al lote de la
  orden; salidas restan por FIFO; consignación mueve a saldo del cliente).
- Valuación: **PPP móvil por producto** (no por lote). El lote es trazabilidad.

### Movimientos

- **movimientos** — id, fecha, tipo (enum, ver abajo), cliente_id (null),
  medio_pago (enum null: efectivo|transferencia|mercado_pago|tienda_nube|credito),
  observaciones, creado_por, timestamps.
- **movimiento_items** — id, movimiento_id, producto_id, cantidad (numeric:
  permite ± en ajuste), precio_con_iva (numeric null: solo ventas),
  ingreso_neto (numeric = cantidad·precio/1.21), costo (numeric = cantidad·ppp),
  consignacion_id (null: en venta/devolución desde consignación).
- **movimiento_item_lotes** — id, item_id, lote_id, cantidad. Detalle FIFO: un
  ítem puede tocar varios lotes.
- **Enum `tipo_movimiento`**: `venta`, `venta_consignacion`, `consignacion`,
  `devolucion_consignacion`, `canje`, `presentacion`, `regalo`, `rotura`,
  `sorteo`, `tester`, `co_branding`, `influencer`, `prueba`, `ajuste`,
  `produccion`. (Se elimina `ingreso`, `devolucion_consignacion` viejo se
  renombra, se agregan sorteo/tester/co_branding/influencer/prueba/venta_consignacion.)
- Tabla de reglas por tipo (en `features/movimientos/schema.ts`), campos:
  `descuentaStock`, `direccion` (out|entra|neutro|ajuste),
  `impactoEERR` (ingreso | salida_no_venta | co_branding | neutro | ajuste),
  `pidePrecio`, `pideMedioPago`, `terceroObligatorio`, `consig` (entregar |
  vender | devolver | null).

### Consignaciones

- **consignaciones** — id, fecha, vence (date, default fecha+60d), cliente_id,
  producto_id, lote_id, entregadas (int), vendidas (int), devueltas (int),
  movimiento_origen_id, timestamps. Pendientes y estado se calculan.
- Estado: sin pendientes→Cerrada; vencida con pendientes→Vencida; con
  vendidas/devueltas→Parcial; si no→Abierta.

### Clientes

- **clientes** — id, nombre, tipo (enum: particular | veterinaria | pet_shop |
  distribuidor | marca_aliada | prensa_influencer), email, telefono, cuit,
  notas, activo, timestamps.
- Cliente semilla "Consumidor final (Tienda Nube)".

---

## Orden de trabajo (los 6 pasos de la spec)

Cada bloque deja `typecheck`+`lint`+`build` en verde y se puede deployar.

1. **Esquema + migración + seed** (este primer commit). Reemplazo completo,
   `db:migrate` con el script propio, `setup.sql` (RLS de todas las tablas
   nuevas), seed con los datos de referencia de la spec §8 (2 productos, 2
   recetas v1, ~26 insumos con PPP del lote 2, 2 lotes, stock por lote, 2
   órdenes cerradas de muestra, clientes). Desconectar `generarAsientoMovimiento`.
2. **Paso 1 — Productos y recetas.** Ficha sin precio, solapa Receta (líneas
   físicas), solapa Versiones con vigencia. "Nueva versión de receta".
3. **Paso 2 — Insumos.** Listado con reutilizable/vence, PPP, valor stock;
   Compra en tanda (con "Sugerir desde receta"); Baja con motivo; Conciliación
   por lote; indicadores (aprovechamiento, pérdida por sobrantes).
4. **Paso 3 — Producción.** Planificar (chequeo de insumos, "comprar lo que
   falta", precio de fabricación vigente); Cerrar (consumo real, unidades
   obtenidas, desvíos, baja de sobrantes, entrada al stock, PPP).
5. **Paso 4 — Stock.** Tres columnas (depósito/consignación/total), desglose
   por lote, mínimo editable, estado sobre depósito, `verificarStock`.
6. **Paso 5 — Movimientos.** Modal con tipos nuevos, FIFO automático, ingreso
   neto y costo por ítem, impacto EERR visible, alta rápida de cliente,
   sin proveedor, sin ítems de insumo.
7. **Consignaciones.** Saldo por cliente+producto+lote, estados calculados,
   acciones que abren Movimientos precargado, vencimiento 60d.
8. **Clientes.** 6 tipos, columnas calculadas, ficha con indicadores +
   consignaciones + movimientos.
9. **Paso 6 — Reportes / EERR.** 4 indicadores, por producto (meses stock, %
   consumido), desglose por tipo, cascada a "resultado antes de costos fijos",
   evolución mensual.

## Pendientes de la spec (§7) que quedan fuera

Lista de precios, costos fijos, cuenta corriente, integración Tienda Nube,
facturación, canal de venta, edición de fichas, permisos granulares. Ver
`docs/ESPECIFICACION_SISTEMA_MAITEN.md` §7.

## Preguntas abiertas de la spec (§7) — no bloquean el esquema

Se implementan con valores del mockup y se ajustan luego: marca reutilizable
por insumo (mockup marca aloe, karité, aceites como no reutilizables),
estándares del shampoo, fabricación de crema del lote 2, definiciones de
"meses de stock" / "% consumido".
