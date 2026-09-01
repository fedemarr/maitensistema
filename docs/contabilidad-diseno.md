# Contabilidad de partida doble — diseño (Módulo I)

> **Estado: IMPLEMENTADO** (rama `fase-2`, commit `850cf6c`). Este
> documento describe el modelo y las reglas tal como quedaron implementadas.
> Las desviaciones respecto del diseño original se listan al final (§8).

---

## 1. Objetivo

Registrar automáticamente la actividad del negocio (ventas, compras, cuentas
corrientes, consignaciones, roturas, presentes…​) en asientos de partida doble y
poder armar un **balance de comprobación**, un **estado de resultados** mensual
y un **balance general** simple.

No reemplaza al módulo Reportes: el reporte económico usa `movimiento_items`;
la contabilidad usa los asientos derivados de esos mismos movimientos.

---

## 2. Tablas propuestas

### `plan_cuentas`

| columna | tipo | notas |
|---|---|---|
| `id` | uuid pk | |
| `codigo` | text | jerárquico, ej. `1.1.1` |
| `nombre` | text | ej. "Caja", "Deudores por ventas" |
| `rubro` | text | "Activo Corriente", "Pasivo Corriente", "Patrimonio Neto", "Resultado Positivo", "Resultado Negativo" |
| `tipo` | enum | `activo \| pasivo \| pn \| rpos \| rneg` |
| `cuentaPadreId` | uuid → plan_cuentas | opcional, agregación |
| `activo` | bool | default `true` |
| timestamps | | |

### `asientos`

| columna | tipo | notas |
|---|---|---|
| `id` | uuid pk | |
| `fecha` | date | |
| `descripcion` | text | ej. "Venta #movimiento" |
| `origen` | enum | `manual \| venta \| ingreso \| cc-pago \| consignacion-entrega \| consignacion-venta \| consignacion-devolucion \| ajuste-stock \| otros` |
| `estado` | enum | `borrador \| confirmado` |
| `movimientoId` | uuid → movimientos | referencia (nullable para asientos manuales) |
| `creadoPor` | uuid → perfiles | |
| `balanceado` | boolean (derivado/generado) | Σ debe = Σ haber |
| timestamps | | |

### `asiento_lineas`

| columna | tipo | notas |
|---|---|---|
| `id` | uuid pk | |
| `asientoId` | uuid → asientos (`cascade`) | |
| `cuentaId` | uuid → plan_cuentas | |
| `debe` | numeric(12,2) | default 0 |
| `haber` | numeric(12,2) | default 0 |
| `concepto` | text | detalle libre |
| timestamps | | |

**Invariantes propuestas:**

1. Todo asiento confirmado está balanceado: Σ debe = Σ haber.
2. Los asientos automáticos nacen confirmados (son derivación de un movimiento).
3. Los asientos confirmados **no se editan ni borran**: se revierten con un
   contra-asiento. (Paralelo a la inmutabilidad de movimientos.)
4. Eliminar un movimiento (módulo D) elimina sus asientos derivados automáticos
   (son re-evaluables); contradictorio con el punto 3 → **decisión abierta**,
   ver §6.

---

## 3. Mapeo movimiento → asiento

Derivación automática al crear cada movimiento. Montos en pesos.

### Venta (medio con cuenta en el plan)

| | Debe | Haber |
|---|---|---|
| estático | **CMV** (por `costoUnit` de cada ítem) | **Mercadería** (ídem) |
| efectivo / transferencia / MP | **Caja** o **Banco** (según medio) por el total del movimiento | **Ventas – Maitén** por el total |

### Venta a crédito

| | Debe | Haber |
|---|---|---|
| | **Deudores por ventas** (CC del cliente se lleva en `cc_movimientos`; el asiento contable usa la cuenta agregada) | **Ventas – Maitén** |
| | **CMV** | **Mercadería** |

> Nota: el asiento de CC existe como registración contable agregada; la
> operación diaria sigue viviendo en `cc_movimientos`.

### Ingreso / compra (materia prima, packaging, mercadería)

| | Debe | Haber |
|---|---|---|
| compra (cualquier medio) | **Materia prima** / **Packaging** / **Mercadería** según el producto | **Caja** / **Banco** si es contado; **Proveedores a pagar** si es a plazo (CC proveedor) |

### Consignación

| | Debe | Haber |
|---|---|---|
| al entregar | **Mercadería en consignación** | **Mercadería** |
| al vender | **Caja/Banco** o **Deudores por ventas** y **CMV** → **Ventas – Maitén** y **Mercadería en consignación** (baja el costo de esa partida) | |
| al devolver | **Mercadería** | **Mercadería en consignación** |

### Regalo / presentación / rotura

| | Debe | Haber |
|---|---|---|
| | **Gastos operativos** (o cuenta "Presentaciones/Regalos" si prefieren distinguir) | **Mercadería** |

### Ajuste de stock

- Ajuste por **carga inicial**: Debe **Mercadería** / Haber **Capital inicial**.
- Ajustes de corrección posteriores: depende del caso (decisión abierta, §6).
- **Ajuste compensatorio por consignación vendida**: NO genera asiento (su
  efecto contable ya está representado por la venta).

### Devolución de consignación

Revierte el asiento de la entrega (equivalente al caso "devolver" de §Consignación).

### Pagos en CC

| | Debe | Haber |
|---|---|---|
| pago de cliente (haber en CC) | **Caja/Banco** | **Deudores por ventas** |
| pago a proveedor (debe en CC) | **Proveedores a pagar** | **Caja/Banco** |

---

## 4. Cómo se arma el balance

- **Estado de resultados del mes:** `Σ rpos − Σ rneg` de los asientos del mes.
  Ya lo da el módulo Reportes; la contabilidad lo replica por cuentas.
- **Balance de comprobación:** por cuenta, sumas y saldos (debe, haber, saldo).
  Se arma con `group by cuentaId` sobre `asiento_lineas`.
- **Balance general:** saldos acumulados por tipo (`activo`, `pasivo`, `pn`).

El balance general se cierra cuando `Σ activos = Σ pasivos + Σ pn` (con los
resultados del ejercicio abiertos como cuenta de PN hasta la distribución).

---

## 5. Seed del plan de cuentas

Reutiliza el plan del prototipo (`docs/legacy/maiten.html`, array `planCuentas`)
más las cuentas que el motor actual necesita.

| código | rubro | nombre | tipo |
|---|---|---|---|
| 1.1.1 | Activo Corriente | Caja | activo |
| 1.1.2 | Activo Corriente | Banco | activo |
| 1.1.3 | Activo Corriente | Mercadería | activo |
| 1.1.4 | Activo Corriente | Deudores por ventas | activo |
| 1.1.5 | Activo Corriente | Mercadería en consignación | activo |
| 1.2.1 | Activo Fijo | Mobiliario y equipos | activo |
| 2.1.1 | Pasivo Corriente | Proveedores a pagar | pasivo |
| 2.1.2 | Pasivo Corriente | Deuda con consignatarios | pasivo |
| 3.1.1 | Patrimonio Neto | Capital inicial | pn |
| 3.1.2 | Patrimonio Neto | Resultados acumulados | pn |
| 4.1.1 | Resultado Positivo | Ventas – Maitén | rpos |
| 5.1.1 | Resultado Negativo | CMV | rneg |
| 5.1.2 | Resultado Negativo | Gastos operativos | rneg |
| 5.1.3 | Resultado Negativo | Materia prima | rneg |
| 5.1.4 | Resultado Negativo | Packaging | rneg |

**Mapeo de medios de pago** (en la tabla `medios_pago` se agrega `cuentaId`):

| medio | cuenta |
|---|---|
| Efectivo | Caja |
| Transferencia | Banco |
| Mercado Pago | Banco |
| Crédito | Deudores por ventas |

(Sigue el mismo criterio que el prototipo: `mp*` → `cuentaNombre`.)

---

## 6. Decisiones abiertas (para la revisión)

1. **¿Una sola cuenta "Ventas – Maitén" o desglosar** por tipo (ventas,
   consignaciones vendidas, canjes…​)? Propongo una sola y ver su composición
   desde Reportes.
2. **Eliminar un movimiento** (módulo D): ¿revertir con contra-asiento o
   eliminar los asientos derivados? Proponer contra-asiento (auditable) pero es
   más caro de implementar; la alternativa de borrar es más simple.
3. **Consignaciones:** ¿nos conviene una cuenta "Mercadería en consignación"
   separada o mantenerla en "Mercadería" con otra cuenta de control? El
   seguimiento por cliente ya vive en `consignaciones`.
4. **Ajustes de stock posteriores:** ¿asiento o no? Los ajustes se usan para
   cargas iniciales (sí asiento) y correcciones (probablemente también, contra
   "Resultados acumulados" o una cuenta "Diferencias de inventario").
5. **¿Contador externo?** Si existe, el plan de cuentas debería validarse con
   él; los códigos y rubros propuestos son de referencia.
6. **Asientos borrador vs automáticos:** ¿hace falta un flujo de aprobación o
   todo es automático? Propongo todo automático + excepción "asiento manual".

---

## 7. Límites del módulo (qué NO hace en esta fase)

- No hay libro diario ni mayor impresos; solo pantallas de consulta.
- No se hace contabilidad de bienes de uso (amortizaciones).
- No hay IVA (el negocio es monotributo; confirmar).
- La cuota del club y otros gastos fijos se cargan como "Gastos operativos".

---

## 8. Notas de implementación (decisiones cerradas y desvíos)

Decisiones que el diseño dejaba abiertas (§6) y cómo quedaron al codear:

1. **Una sola cuenta "Ventas – Maitén"** (4.1.1). Las ventas de consignación
   usan la misma cuenta; la diferencia se ve en los libros a través del débito
   a "Mercadería en consignación".
2. **Eliminar un movimiento borra sus asientos derivados** (FK
   `asientos.movimiento_id → movimientos(id) ON DELETE CASCADE`). Simple y
   consistente. No se implementa contra-asiento reversor.
3. **Sí, cuenta separada "Mercadería en consignación"** (1.1.5) para entregas,
   ventas y devoluciones de consignación.
4. **Los ajustes (`ajuste`) NO generan asiento**: son de conciliación de stock
   (altas iniciales, correcciones) y no tocan los libros.
5. **Plan de cuentas validado internamente** (no hay contador externo): códigos
   jerárquicos únicos, tipado `activo|pasivo|pn|rpos|rneg`. El seed vive en la
   migración `0003` (15 cuentas).
6. **Todo asiento es automático y nace `confirmado`**. `origen` distingue
   `movimiento` / `cc-pago` / `manual` (el manual queda para una fase futura;
   hoy no hay pantalla para crear asientos a mano).

Desvíos técnicos del esquema:

- `movimientos.consignacion_id` es una columna **uuid sin FK** (solo vínculo de
  procedencia): evita la circularidad TS `movimientos ↔ consignaciones`. La
  relación se declara en Drizzle (`consignacionOrigen`).
- `medios_pago.cuenta_id → plan_cuentas(id) ON DELETE SET NULL` (opcional). Si
  no está mapeado (o el medio es crédito), el asiento usa **Caja** por defecto.
- Las cuentas no tienen `cuenta_padre_id` (sin jerarquía padre/hijo); el rubro
  es un texto libre y se agrupa solo por `tipo`.