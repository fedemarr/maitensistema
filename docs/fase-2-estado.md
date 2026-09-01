# Fase 2 — Estado del encargo

Actualizado al cierre de la ejecución (rama `fase-2`).

## Qué se hizo (módulo por módulo)

- **A. Rubros** — `/config/rubros`: alta inline y activar/desactivar.
  - Commit `1f2cd38`.
- **B. Clientes** — `/clientes` (+ `/nuevo`, `/[id]`, `/[id]/editar`): CRUD,
  búsqueda, filtro por tipo, unicidad de nombre case-insensitive, no se puede
  borrar un cliente con movimientos (se desactiva).
  - Commit `6c3f5d3`.
- **C. Proveedores** — `/proveedores/*`: igual que Clientes, sin `tipo`.
  - Commit `2f6b4ab`.
- **D. Movimientos (motor de stock)** — `/movimientos`, `/movimientos/nuevo`,
  `/movimientos/[id]`: los 8 tipos del dominio **+ `ajuste`**, tabla de reglas
  (`REGLAS_MOVIMIENTO`), validación Zod, escritura transaccional, stock atómico
  (`stock + delta`), nunca stock negativo, borrado exacto (solo admin), efecto
  extra de CC (venta a crédito / ingreso a plazo) y consignaciones pendientes.
  - Además: alta de Producto con variante nueva toma el stock inicial como
    movimiento `ajuste`; stock y costo de variantes existentes pasaron a
    **solo lectura** en el formulario de Productos.
  - Migraciones `0001_thick_doomsday` (enum `ajuste`, `medios_pago`,
    `movimientos.medio_pago_id`) y `0002_careful_betty_ross`
    (`cc_movimientos`, `consignaciones` + enums). Seed y `setup.sql` (RLS)
    actualizados.
  - Commit `0c8c306`.
- **D2. Panel de stock** — `/stock`: variantes activas con estado
  (OK / Bajo mínimo / Sin stock), totales a costo, búsqueda y filtro por rubro;
  `verificarStock()` (admin) compara `variantes.stock` contra la suma de los
  deltas de `movimiento_items` (solo reporta, no corrige). Bloque "Stock
  crítico" en el dashboard `/`.
  - Commit `bd10895`.
- **E. Ficha de producto** — `/productos/[id]`: historial de movimientos de
  todas sus variantes, filtrable por tipo/fecha, resumen por tipo con % sobre
  el total de salidas.
  - Commit `6f73e37`.
- **F. Cuentas corrientes** — `/cc-clientes`, `/cc-proveedores` y `/[id]`:
  lista de terceros con saldo (`Σ debe − Σ haber`), detalle de asientos con
  saldo corrido, `registrarPago()`. Saldo visible en las fichas de B/C.
  - Commit `235a5ee`.
- **G. Reporte económico** — `/reportes`: selector de mes, por producto
  (unidades, ingresos, CMV, resultado bruto, margen %, meses de stock,
  % consumido), totales del período y desglose por tipo valorizado a costo.
  - Para que el CMV sea real, `crearMovimiento` ahora guarda el **costo
    promedio como snapshot** (`costo_unit`) en cada ítem de salida.
  - Commit `9708577`.
- **H. Consignaciones** — `/consignaciones`: lista con estado y alerta de
  vencidas; `marcarVendida()` (opcionalmente registra la venta + ajuste
  compensatorio para no descontar dos veces) y `registrarDevolucion()` (suma
  stock y cierra).
  - Commit `8332284`.
- **I. Contabilidad** — **solo diseño** en `docs/contabilidad-diseno.md`
  (tablas `plan_cuentas` / `asientos` / `asiento_lineas`, mapeo de cada tipo de
  movimiento a asientos, armado de balance, seed del plan de cuentas).
  **Pendiente de revisión** antes de codear.
  - Commit `d8b3edc`.

## Decisiones técnicas (invariantes del motor de stock)

1. `variantes.stock` es la **única fuente de verdad**; solo cambia por
   movimientos (o por el alta de variante nueva, que crea el `ajuste`).
2. Escrituras transaccionales (Drizzle `db.transaction`).
3. Nunca stock negativo: se valida con el stock actual antes de aplicar.
4. Borrado exacto: `eliminarMovimiento` revierte `stock − delta` y limpia sus
   asientos de CC/consignaciones. **No revierte el costo promedio** (limitación
   conocida; requeriría guardar el estado previo).
5. Reglas por tipo centralizadas en `src/features/movimientos/schema.ts`
   (`REGLAS_MOVIMIENTO`), no `if` sueltos.
6. El `ajuste` persiste en `cantidad` el **delta con signo** (la UI pide el
   objetivo y se guarda `objetivo − stock`). `verificarStock()` lo interpreta
   así.
7. Seguridad: `requireRole` en todas las acciones con escritura; Zod para
   inputs; `registrarAuditoria` en cambios; montos como string (`numeric`).

## Limitaciones y deudas técnicas

- Eliminar un movimiento no restaura `costoPromedio` (decisión consciente).
- Reportes usa `costo_unit` guardado al momento del movimiento: los datos
  anteriores a este cambio tienen `costo_unit = 0` en salidas y van a mostrar
  CMV 0.
- `marcarVendida` con "registrar venta" crea **dos** movimientos (venta +
  ajuste compensatorio). Es intencional, pero puede sorprender en el historial:
  se avisa en las notas de ambos.
- La consignación se cierra completa (no soporta venta parcial por variante en
  este módulo).
- Los formularios de fecha del historial (E) y de movimientos usan strings
  `YYYY-MM-DD` con normalización de zona horaria simple.
- No se usó ninguna librería de charts (por spec); todo tablas y números.

## Dudas abiertas para la revisión con las dueñas

- Validar con un contador el **plan de cuentas** propuesto (módulo I).
- ¿Una sola cuenta de ventas o desglose por tipo?
- Eliminar un movimiento: ¿contra-asiento o borrar asientos derivados?
- ¿Cuenta separada "Mercadería en consignación" o control dentro de
  "Mercadería"?

## Cómo validar

1. `pnpm typecheck && pnpm lint && pnpm build` (todo verde).
2. `pnpm dev` → ir a `/stock`: `verificarStock()` no debe encontrar diferencias
   después de cargar varios movimientos.
3. Flujo de prueba: crear Producto con variante y stock inicial (crea un
   `ajuste`) → crear `venta` (CC si es a crédito) → `consignacion` (queda
   pendiente en `/consignaciones`) → devolución (vuelve el stock) →
   `/movimientos` y `/productos/[id]` muestran el historial → `/reportes` del
   mes muestra el resumen.

## Pendiente

- Revisar `docs/contabilidad-diseno.md` (módulo I) y, cuando se apruebe,
  implementar.
- `Contabilidad` (nav) queda deshabilitada hasta implementarla.