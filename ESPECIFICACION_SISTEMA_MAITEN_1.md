# Sistema de gestión Maitén — Especificación funcional

**Versión:** 1.2 · **Fecha:** 4 de septiembre de 2026
**Diseño:** Lautaro · **Programación:** Fede
**Acompaña a:** `maiten-proceso-completo.html` (mockup navegable, v16)

---

## Cambios de la versión 1.2 respecto de la 1.1 (leer primero)

Tres definiciones, salidas de revisar las pantallas reales de Producción, Precios y Proveedores (capturas del 4/9):

**1. IVA: todos los costos van sin IVA; los precios de venta se cargan netos.** Maitén es responsable inscripto: el IVA de las compras (insumos y fábrica) es crédito fiscal, no costo. Regla para todo el sistema:

- **Insumos → Compra** y **Producción → precio de fábrica / fabricación cobrada**: importes **sin IVA**. La etiqueta del campo lo dice ("$ sin IVA"). El PPP, el costo del lote y el costo unitario quedan netos.
- **Precios (venta)**: se carga el **neto** (retail y mayorista) y el sistema muestra al lado el precio **con IVA** (neto × 1,21) como referencia; el bruto no se guarda.
- **Movimientos**: el precio del ítem es el **neto** (precargado desde Precios según el tipo de cliente; editable), con una columna calculada **"con IVA / u"** al lado para que las socias vean lo que cobra el cliente. Ingreso = cantidad × precio neto. Desaparece el "÷ 1,21".
- **Reportes**: ingresos netos contra costos netos → el margen es real.
- El tratamiento del IVA (factura del proveedor → crédito fiscal → IVA a pagar del período) es del **módulo contable, más adelante** (pendiente en sección 7). No se diseña ahora.

**2. El precio de la fábrica vive en Producción → pestaña "Fábrica".** No va en "Precios" (que es de venta) ni en "Proveedores" (que es cuenta corriente y compras). Producción pasa a tener dos pestañas: **Órdenes de producción** (lo que ya está) y **Fábrica · tarifario y mínimo**, con:

- Parámetro **mínimo de compra por orden** ($ sin IVA; hoy $450.000) **con vigencias e historial completo en tabla** (desde, hasta, monto, variación, estado, órdenes que lo usaron, quién lo cargó), igual que el precio por unidad: se muestra el vigente ("$450.000 · desde 01/01/2026") y campos "nuevo mínimo / vigente desde" con **"Agregar vigencia"**. No se edita el valor: se agrega una vigencia nueva. La inflación lo va a mover.
- Tabla **precio de fabricación por producto**: precio vigente por unidad, vigente desde, historial (desde → hasta · precio, todas las vigencias), y una fila para cargar un **precio nuevo con fecha desde** ("Agregar vigencia": no pisa el anterior, agrega una vigencia).
- **En la orden, el precio es de solo lectura**: el sistema toma el vigente a la **fecha de la orden** ("tomado del tarifario, vigente desde 01/07/2026"). Si la fábrica aumentó, se carga en la pestaña Fábrica; las órdenes anteriores conservan su precio. Esto reemplaza lo de la v1.1 ("si el usuario lo cambia en la orden, pasa a ser el nuevo vigente"): el precio **no se edita en la orden**.

**3. Módulo Precios (venta), alineado a lo que Fede ya construyó.** Misma pantalla (producto, SKU, retail, mayorista, Guardar), con dos ajustes: cada columna pasa a **neto editable + "con IVA" calculado al lado**, y **mayorista vacío = usa retail** hasta que las socias lo definan. Movimientos precarga mayorista cuando el cliente es de tipo "Distribuidor / mayorista" y tiene precio cargado; si no, retail. Este módulo estaba en "fuera de alcance" en la v1.1; ahora entra con esta definición.

**Qué cambia en las pantallas ya implementadas:**

| Pantalla | Hoy | Pasa a (v1.2) |
|---|---|---|
| Producción → planificar | Campo de precio/costo de fabricación editable, con vigente e historial dentro del formulario | Campo **solo lectura** "Precio de fabricación por unidad ($ sin IVA) · tomado del tarifario, vigente desde dd/mm/aaaa" + historial en texto y link "¿aumentó la fábrica? cargalo en Fábrica". Cambiar la **fecha prevista** recalcula el precio vigente |
| Producción | Una sola vista | Dos pestañas: **Órdenes** / **Fábrica** (tarifario por producto con vigencias + mínimo de compra **con vigencias**; ambos se congelan en cada orden y se muestran en la lista de órdenes) |
| Producción → cerrar | "Fabricación cotizada ($)" / "cobrada ($)" | Ídem, etiquetadas **"$ sin IVA"** |
| Precios | Retail / Mayorista "con IVA", un campo por columna | Retail **neto** + "con IVA" calculado · Mayorista **neto** + "con IVA" calculado · mayorista vacío = usa retail. Subtítulo: "se carga neto; el sistema muestra el precio con IVA" |
| Movimientos → ítems | "Precio + IVA / u", ingreso = precio ÷ 1,21 | **"Precio neto / u"** (editable, precargado desde Precios por tipo de cliente) + columna **"Con IVA / u"** de solo lectura (neto × 1,21); ingreso = cantidad × neto; el resumen muestra el ingreso neto y, al lado, el total con IVA que paga el cliente |
| Insumos → Compra | Costo total de la compra | Ídem, etiquetado **"sin IVA"** |
| Proveedores | Ficha + cuenta corriente + compras | **Sin cambios.** No se le agrega el tarifario de la fábrica |

Las secciones 3.3, 3.5, 3.9, 4, 5, 6 (D-05, D-19, D-20), 7 y 8 quedaron actualizadas. Lo demás sigue vigente.

---

## Cambios de la versión 1.1 respecto de la 1.0

Un solo tema: **la fabricación tercerizada**. La v1.0 la modelaba como "un monto por lote" (D-05 anterior). Con la orden de compra real a la fábrica (OC N°3, 1/7/2026) y la explicación de Gina, el modelo correcto es:

1. La fábrica cobra **por unidad**, con un **precio distinto por producto**: shampoo **$1.092 + IVA**, crema **$1.460,36 + IVA** (OC N°3). Es un precio vigente con historial (lote 1: $960 y $1.200).
2. Hay un **mínimo de compra por orden de $450.000** sobre el total del lote. Las socias siempre lo superaron; por eso en el lote 2 sumaron las 400 cremas. *(Qué pasa si no se llega: a confirmar con Gina, ver sección 7.)*
3. Fabricación cotizada del lote = unidades planificadas × precio unitario del producto. Al cerrar, fabricación cobrada = lo que facturó la fábrica (por defecto, la cotizada). Costo unitario = cobrada ÷ unidades obtenidas.

**Qué cambia en la pantalla de Producción ya implementada:**

| Hoy (v1.0, implementado) | Pasa a (v1.1) |
|---|---|
| Campo "Costo de fabricación del lote ($)" con vigente $436.800 e historial | Campo **"Precio de fabricación por unidad ($ + IVA)"**, **por producto**, con vigente e historial **por producto** (Shampoo: 01/2026 $960 · 07/2026 $1.092; Crema: 01/2026 $1.200 · 07/2026 $1.460,36) |
| — | Campo de solo lectura **"Fabricación cotizada del lote"** = cantidad × precio |
| — | **Parámetro global "Mínimo de compra de la fábrica" = $450.000.** Al planificar, el sistema suma la fabricación de **todas las órdenes del mismo lote** (planificadas y cerradas) más la que se está planificando, y muestra: ✔ "supera el mínimo: total $X" o ⚠ "no llega al mínimo: faltan $X — se paga el mínimo igual; agregá unidades o sumá el otro producto a este lote" |
| Costo estándar estimado = MP + monto del lote | Costo estándar estimado = MP + cantidad × precio unitario |
| Cierre: "Fabricación cotizada" (monto) / "cobrada" | Igual, pero la cotizada muestra "N u × $precio" y la cobrada se corrige solo si la fábrica facturó distinto (o aplicó el mínimo) |

Todo lo demás del MD v1.0 sigue vigente. Las secciones 3.3, 4, 5, 6 (D-05, D-17), 7 y 8 quedaron actualizadas con este modelo. Se eliminó el pendiente sobre la fabricación de crema del lote 2 ($584.144): era 400 × $1.460,36.

**Además, visto en el sistema real (capturas del 4/9):** ya existen los módulos **Precios** y **Costos fijos** en el menú, y la orden tiene acción **Anular** (borrado lógico) — coherente con las políticas. Los pendientes de precios y costos fijos de la sección 7 se revisan cuando se muestren esos módulos.

---

## 0. Cómo leer este documento

Este documento describe **cómo tiene que funcionar** el sistema de gestión de Maitén: qué hace cada módulo, cómo se conectan entre sí, qué reglas de negocio aplican y qué cálculos hay detrás. Va junto con el mockup HTML, que muestra **cómo se ve** y permite probar la lógica de punta a punta (los botones funcionan y los números se recalculan).

Está pensado para que Fede lo use como guía de implementación sobre el sistema que ya tiene andando (`maitensistema.vercel.app`). Por eso, en cada módulo hay una sección **"Respecto del sistema actual"** que dice explícitamente qué se mantiene, qué se modifica, qué se agrega y qué se elimina.

Sobre el mockup:

- Los **números son de muestra** pero salen del Excel real de Maitén (recetas, costos de insumos del lote 2, stock actual, fabricación de los lotes 1 y 2). Sirven para que la lógica se pruebe con datos verosímiles, no son datos a cargar.
- Los **clientes y proveedores son inventados** (nombres genéricos).
- Los seis pasos numerados son el **orden del proceso**, no un menú: en el sistema real son los módulos del menú lateral, como ya están.

El proyecto tiene además un documento de políticas (`POLITICAS_PROYECTO_MAITEN.md`) que fija cómo se trabaja; lo relevante para el sistema web está en su Sección B (persistencia en Supabase, historización con vigencias, borrado lógico y auditoría). Este documento lo asume.

---

## 1. Principios que atraviesan todo el sistema

Estas cinco reglas valen en todos los módulos. Si una implementación las viola, hay que frenar y corregir antes de seguir.

### 1.1 El stock es siempre entradas − salidas

El stock de producto terminado no es un número que se edita: es el resultado de sumar entradas y restar salidas registradas. **Nada mueve el stock por fuera del registro de movimientos** — ni Producción, ni un ajuste escondido, ni una futura sincronización con Tienda Nube. Producción, cuando cierra una orden, *genera un movimiento de entrada*; no toca el stock directamente.

### 1.2 El tipo de movimiento manda

Cada movimiento tiene un tipo (Venta, Consignación, Canje, Regalo, Co-branding…). El tipo define, por sí solo, dos cosas: **si descuenta stock** y **cómo impacta en el reporte económico** (ingreso, costo de salida no-venta, acción comercial, movimiento neutro). El usuario elige el tipo; el sistema hace el resto. No hay checkboxes ni decisiones adicionales.

### 1.3 La receta es físico puro

La receta de un producto (fórmula + estándares) lleva **solo cantidades físicas** por unidad terminada. **Nunca precios.** El precio de cada insumo vive en el módulo Insumos (como costo promedio ponderado, PPP). El costo de un producto se calcula cuando hace falta (al costear una orden) como *receta × PPP del insumo*. Esta separación es el corazón de la metodología de costeo de Maitén (componente físico normalizado, componente monetario resultante) y no se reabre.

### 1.4 El costo del producto terminado lo calcula Producción

No existe una entrada manual de producto terminado con costo tipeado a mano. El producto entra al stock **únicamente** al cerrar una orden de producción, con el costo que el sistema calculó (materia prima consumida a PPP + fabricación). Los ajustes de inventario se valúan solos al PPP vigente.

### 1.5 Todos los costos sin IVA; los precios de venta, netos *(v1.2)*

Maitén es responsable inscripto: el IVA de lo que compra (insumos, fábrica) es crédito fiscal, no costo, y el IVA de lo que vende es débito fiscal, no ingreso. Por eso **ningún importe del proceso de producto lleva IVA**: compras de insumos, precio de fábrica, fabricación cobrada, PPP, costo unitario, precios de venta e ingresos son todos **netos**. El sistema muestra el precio con IVA solo como referencia en la lista de precios. El IVA se trata en el módulo contable, más adelante (factura del proveedor → crédito fiscal → IVA a pagar del período).

### 1.6 Una sola fuente de verdad por dato

Clientes, lotes, insumos y productos son **datos maestros**: se cargan una vez, se eligen de desplegables, nunca se tipean como texto libre. Los importes económicos que cambian en el tiempo (precio de fabricación, recetas) se guardan **con vigencia** (desde / hasta), no como un dato único que se pisa.

---

## 2. Mapa del proceso

```
 PRODUCTOS ──────► INSUMOS ──────► PRODUCCIÓN ──────► STOCK ──────► MOVIMIENTOS ──────► REPORTES
 (receta física)   (precio PPP,     (orden: receta ×    (por lote,     (salidas con tipo;    (ingresos, CMV,
                    stock, compras   cantidad; consumo   FIFO; PPP)     cliente; ítems)       bruto, desvíos,
                    por lote)        real; costo lote)                                        pérdidas…)
        │               │                 │                  ▲              │
        │               │                 └── al cerrar ─────┘              │
        │               │                    genera ENTRADA                 ▼
        │               │                                            CONSIGNACIONES
        │               └── sobrante no reutilizable ──► pérdida     (saldo por cliente;
        │                                                del período  venta / devolución)
        └── versiones con vigencia                                          │
                                                                             ▼
                                                                          CLIENTES
                                                                     (maestro; ficha con
                                                                      lo que el sistema sabe)
```

**Qué dato viaja entre módulos:**

| De | A | Qué | Cuándo |
|---|---|---|---|
| Productos | Producción | Receta vigente (líneas: insumo + cantidad estándar/unidad) | Al planificar y cerrar una orden |
| Insumos | Producción | Stock disponible y PPP de cada insumo | Chequeo de disponibilidad; costeo de la orden |
| Producción | Insumos | Consumo real por insumo; baja de sobrantes no reutilizables | Al cerrar la orden |
| Producción | Stock | Entrada de producto terminado: unidades obtenidas, lote, costo total | Al cerrar la orden |
| Producción | Producción | Total de fabricación del lote (todas sus órdenes) para controlar el mínimo de la fábrica | Al planificar cada orden del lote |
| Movimientos | Stock | Salidas por lote (FIFO), ajustes | Al crear un movimiento |
| Movimientos | Consignaciones | Nueva consignación (tipo Consignación); venta desde consignación; devolución | Al crear un movimiento de esos tipos |
| Movimientos | Clientes | Historial por cliente; alta rápida de cliente | Al crear un movimiento |
| Todos | Reportes | Ingresos, CMV, desvíos, pérdidas, co-branding, salidas no-venta | Siempre (calculado, nunca cargado) |

---

## 3. Módulos

### 3.1 Productos

**Qué hace.** Registro maestro de productos terminados. Guarda la identidad del producto y su **receta**, que es el estándar físico con el que Producción explota las órdenes.

**Pantallas.**

- *Listado*: producto, SKU, rubro, estado. (Como está hoy, **sin la columna Precio** — ver decisión D-04.)
- *Ficha del producto*, con dos solapas:
  - **Receta y estándares**: tabla de líneas (insumo · unidad · cantidad estándar por unidad terminada). Solo cantidades físicas.
  - **Versiones**: historial de versiones de la receta con vigencia desde/hasta, estado (vigente / histórica) y los lotes fabricados con cada versión. Botón "Nueva versión de receta".

**Datos de la ficha.** Nombre, código (SKU), rubro, presentación (250 ml / 60 g), stock mínimo, estado. Nada más. **No van**: precio de venta (decisión D-04), costo, fabricación estándar (decisión D-05).

**Reglas.**

- Una receta tiene N líneas; cada línea referencia un insumo del maestro y una cantidad por unidad terminada (kg para materia prima, unidades para envase/caja/etiqueta).
- La receta es **versionada**: crear una versión nueva cierra la vigencia de la anterior. Los lotes ya fabricados quedan atados a la versión con la que se fabricaron; una versión nueva **no toca lotes viejos**.
- Al planificar una orden, el sistema toma la versión vigente a la fecha de la orden y la congela en la orden.
- El stock mínimo se edita también desde el módulo Stock (mismo dato).

**Respecto del sistema actual.**

| | |
|---|---|
| Se mantiene | Listado, alta y ficha de producto; SKU, rubro, estado; el campo "Online". |
| Se modifica | La ficha deja de mostrar precio. El stock mínimo pasa a ser editable desde Stock también. |
| Se agrega | Solapa **Receta y estándares** (líneas con insumo y cantidad). Solapa **Versiones** con vigencia. |
| Se elimina | Columna/campo **Precio** en Productos (queda pendiente definirlo en una lista de precios, D-04). |

---

### 3.2 Insumos

**Qué hace.** Registro maestro de materia prima y envases, con su **precio (PPP)**, su **stock**, sus compras y sus bajas. Es donde vive el componente monetario del costeo.

**Pantallas.**

- *Listado de insumos*: insumo, unidad, **reutilizable (sí/no + "vence")**, stock actual, costo PPP, valor del stock, qué producto lo usa. Filtro por reutilizable. Botones **Registrar compra** y **Dar de baja**.
- *Compra de insumos (en tanda)*: un solo formulario con **todos los insumos en filas** (stock actual visible; cantidad, costo total **sin IVA**, vencimiento por fila). Cabecera: fecha, **lote destino** (opcional; puede crearse uno nuevo ahí mismo), y **"Precargar desde la receta de [producto] × [cantidad]"** con botón *Sugerir*, que llena las cantidades que pide la receta **descontando lo que ya hay en stock**. El usuario ajusta a los packs reales del proveedor. Pie: líneas con compra y total.
- *Baja de insumo*: insumo, cantidad, motivo (vencido / secado-inutilizable / no reutilizable sanitario / rotura-derrame / ajuste de inventario). Genera pérdida en el reporte.
- *Conciliación por lote*: selector de lote; por insumo: comprado para el lote, consumido por la orden, sobrante, reutilizable, destino del sobrante (queda en stock / baja → pérdida / usó stock de lotes anteriores), pérdida en $.
- *Bajas registradas*: fecha, insumo, cantidad, motivo, lote, pérdida $.
- Indicadores: insumos activos (reutilizables / no), valor del stock de insumos, **aprovechamiento del lote elegido** ($ consumido ÷ $ comprado en materia prima), **pérdida por sobrantes del lote elegido**.

**Datos del insumo.** Nombre, unidad (kg / u), **reutilizable entre lotes** (sí/no), **vence** (sí/no), stock actual, PPP, proveedor habitual, estado.

**Reglas.**

- **Reutilizable es un atributo por insumo**, no por categoría. Los naturales (gel de aloe, manteca de karité, aceites) vencen o se secan → no reutilizables. Glicerina, tensioactivos, conservantes, envases, cajas, etiquetas → reutilizables. **Las socias validan la marca insumo por insumo.**
- Stock de insumo = compras − consumos de órdenes − bajas. Solo tiene sentido para reutilizables; para los no reutilizables queda en cero al cerrar cada lote (su sobrante se dio de baja).
- PPP: cada compra recalcula el promedio ponderado: `PPP_nuevo = (stock × PPP + cantidad × costo_total_compra/cantidad) ÷ (stock + cantidad)`.
- Una compra puede quedar **atada a un lote** (se refleja en la conciliación de ese lote) o ir al stock general.
- **Sobrante de insumo no reutilizable comprado para un lote = pérdida del período** (decisión D-06): al cerrar la orden del lote, el sistema calcula `comprado − consumido` por insumo no reutilizable y, si es positivo, genera la baja automáticamente con motivo "No reutilizable (sanitario)", valuada al PPP, en la fecha de cierre. Va al reporte como "Pérdida por insumos".
- Los insumos compartidos entre productos (aloe, glicerina, conservante, cajas, etiquetas) son **un solo insumo**; una compra se cuenta una sola vez.

**Respecto del sistema actual.**

| | |
|---|---|
| Se mantiene | Listado con nombre, SKU, rubro, estado. Stock por insumo. |
| Se modifica | El "precio" del insumo pasa a ser **PPP calculado** por las compras, no un dato cargado. El stock se alimenta de compras, consumos de órdenes y bajas. |
| Se agrega | Atributos **reutilizable** y **vence**. **Compra en tanda** con precarga desde receta y lote destino. **Bajas** con motivo. **Conciliación por lote** e indicadores de aprovechamiento y pérdida. |
| Se elimina | Nada del maestro. Las compras de insumos **no** se cargan por Movimientos (ver 3.5). |

---

### 3.3 Producción

**Qué hace.** Órdenes de fabricación. Consumen la receta, registran lo que realmente pasó, calculan el costo del lote y **generan la entrada al stock** del producto terminado. Es el único camino por el que entra producto terminado.

**La orden tiene dos momentos.**

1. **Planificar** (antes de fabricar). Producto, lote (desplegable; puede crearse), cantidad a fabricar, fecha prevista. El **precio de fabricación por unidad** aparece de solo lectura, tomado del tarifario (pestaña "Fábrica") vigente a la fecha de la orden, junto con la **fabricación cotizada** (cantidad × precio) y el control del mínimo de compra (ver reglas). El sistema explota la receta (estándar × cantidad = consumo teórico) y **chequea contra el stock de insumos**, insumo por insumo: "Alcanza" / "Faltan X kg". Muestra: insumos cubiertos, faltantes, costo estándar estimado del lote y por unidad. Botón **"Comprar lo que falta"** → abre la compra en tanda precargada con ese producto, cantidad y lote. Botón **"Crear orden planificada"**. Una orden planificada es una intención: **no mueve stock**.
2. **Cerrar** (después de fabricar). Desde la lista de órdenes, "Completar y cerrar". Se carga: **consumo real** por insumo (viene precargado con el teórico; se corrige solo lo que difirió), **unidades obtenidas** (planificadas vs. reales), y **fabricación cobrada** (precargada con la cotizada). El sistema calcula en vivo desvíos, costo total, **costo unitario sobre unidades obtenidas**, rendimiento. Al confirmar hace, en una sola transacción:
   - descuenta el consumo real del stock de insumos y lo anota en la conciliación del lote;
   - da de baja los sobrantes no reutilizables comprados para ese lote (pérdida);
   - genera el **movimiento de entrada** del producto terminado (unidades obtenidas, lote, costo total) y actualiza el PPP del producto;
   - marca la orden como **Cerrada** con sus resultados.

**Lista de órdenes.** Fecha, producto, lote, estado (Planificada / Cerrada / Anulada), planificadas, obtenidas, rendimiento, **precio de fábrica y mínimo congelados** en la orden, costo unitario, desvío MP, desvío fabricación, acción.

**Pestaña "Fábrica · tarifario y mínimo"** *(v1.2)*. Segunda pestaña del módulo, donde vive el precio de la fábrica:

- **Parámetros de la fábrica**: mínimo de compra por orden ($ sin IVA; hoy $450.000) con vigencias ("Agregar vigencia", nunca editar el valor) y una **tabla de historial completo** debajo: vigente desde, vigente hasta (el día previo a la siguiente vigencia; "en curso" si es la última), monto, variación % contra la anterior, estado (Vigente / Cerrada / Futura), cantidad de órdenes controladas con ese valor, y quién lo cargó y cuándo. Ninguna fila se edita ni se borra: un error se corrige con una vigencia correctiva. Texto de ayuda: se controla sobre el total del lote (todas las órdenes del mismo lote, planificadas + cerradas) contra el mínimo **vigente a la fecha de la orden**; cada orden **congela** el mínimo con el que se controló. Cambiar el parámetro impacta de ahora en más, nunca hacia atrás.
- **Precio de fabricación por producto**: por cada producto, precio vigente por unidad (sin IVA), vigente desde, historial completo (una línea por vigencia: desde → hasta · precio), y campos "nuevo precio / desde" con botón **"Agregar vigencia"**. Cargar un precio nuevo no pisa el anterior: cierra la vigencia previa y abre una nueva desde la fecha indicada. Las órdenes con fecha anterior conservan su precio.
- Por qué acá y no en otro lado: es un dato del proceso de producir y quien planifica lo necesita a un clic; "Precios" es de venta y "Proveedores" es cuenta corriente. Hay una sola fábrica; si algún día hubiera más, el tarifario pasa a tener proveedor_id.

**Reglas de fabricación (tercerizada).** *(v1.1 — según OC N°3 y Gina)*

- La fábrica cobra **por unidad**, con un **precio por producto** acordado en la orden de compra (OC N°3: shampoo $1.092, crema $1.460,36; en la OC figuran + IVA, el sistema los guarda **sin IVA**). El precio es un **dato vigente con historial por producto** que se administra en la pestaña "Fábrica"; la orden toma el vigente a su fecha, **de solo lectura** *(v1.2)*.
- La fábrica tiene un **mínimo de compra por orden de $450.000** (parámetro de la fábrica con vigencias; la orden usa y congela el vigente a su fecha, *v1.2*). El mínimo se evalúa sobre el **total del lote** (todas las órdenes del mismo lote, de los dos productos). Si no se llega, se paga el mínimo igual y el costo unitario sube; por eso el sistema **avisa al planificar** cuánto falta. Las socias siempre lo superaron: en la práctica el costo es unidades × precio.
- **El lote es la orden de compra a la fábrica** y puede contener los dos productos (el lote 2 tuvo 400 shampoo + 400 crema en una sola OC). La OC pide además grabado láser del número de lote en las etiquetas: la trazabilidad por lote es física.
- Fabricación cotizada = unidades planificadas × precio unitario vigente a la fecha de la orden. Fabricación cobrada = lo facturado por la fábrica, **sin IVA** (por defecto la cotizada; se corrige si cobró distinto o aplicó el mínimo). Costo de fabricación por unidad = cobrada ÷ unidades obtenidas.
- **Todos los importes de este módulo van sin IVA** (crédito fiscal; ver principio 1.6).
- **No hay estándar de fabricación por unidad distinto del precio, ni tandas, ni capacidad, ni "efecto tamaño de lote"**: las socias fabrican por necesidad (stock y demanda).
- El único desvío de fabricación es **cotizado vs. cobrado** (normalmente cero; distinto de cero si la fábrica aplicó el mínimo o cambió el precio sin actualizar el parámetro).

**Reglas de costeo de la orden.**

- Consumo teórico = cantidad estándar (receta vigente) × unidades planificadas.
- Desvío físico = consumo real − teórico; desvío $ = desvío físico × PPP del insumo. Negativo = ahorro; positivo = sobrecosto.
- Costo MP + envases = Σ consumo real × PPP.
- Costo total del lote = costo MP + fabricación cobrada.
- Costo unitario = costo total ÷ **unidades obtenidas**.
- Rendimiento = obtenidas ÷ planificadas (alerta visual bajo 97 %).
- La orden congela la versión de receta y los PPP con los que se costeó.

**Respecto del sistema actual.**

| | |
|---|---|
| Se mantiene | El concepto: "órdenes de fabricación que consumen insumos según la receta y dan de alta el producto terminado". La lista de órdenes. |
| Se modifica | La orden pasa a tener **dos momentos** (planificada / cerrada) y **unidades obtenidas** distintas de las planificadas. El costo lo calcula el sistema; el usuario carga consumo real y fabricación cobrada. |
| Se agrega | Chequeo de disponibilidad de insumos al planificar, con "Comprar lo que falta". **Pestaña "Fábrica"** con el tarifario por producto (precio por unidad, vigencias, historial) y el **mínimo de compra por orden** ($450.000) controlado sobre el total del lote. Precio de solo lectura en la orden. Desvíos. Baja automática de sobrantes no reutilizables. Rendimiento. |
| Se elimina | Nada. |

---

### 3.4 Stock

**Qué hace.** Foto en vivo del stock de producto terminado, **por producto y por lote**, con la mercadería en consignación aparte. Es una vista: no se carga nada acá salvo el mínimo.

**Pantalla.**

- Indicadores: en depósito (unidades disponibles), en consignación, productos bajo mínimo / sin stock, valor del inventario (stock total propio × PPP).
- Tabla por producto: nombre (debajo, **desglose por lote** de lo que hay en depósito), código, **en depósito**, **en consignación**, **total propio**, **mínimo (editable)**, estado (OK / Reponer / Sin stock), PPP, valor a costo.
- Botón "Nuevo movimiento" (abre el formulario de Movimientos).

**Reglas.**

- Total propio = en depósito + en consignación. Lo que está en consignación **sigue siendo stock propio** (todavía no se vendió).
- Estado y mínimo se evalúan sobre **lo disponible en depósito**, que es lo que realmente se puede vender.
- El stock se lleva por lote: cada entrada por producción suma al lote de la orden; cada salida se atribuye **automáticamente al lote más viejo con existencia (FIFO)**. El usuario no elige lote.
- Valuación: **PPP móvil por producto** (no por lote). El lote es trazabilidad física; el costo es promedio. Esto replica el Excel (FIFO físico, PPP monetario).
- El stock mínimo se parametriza por producto, en esta pantalla.
- **No hay entrada manual de producto terminado** (decisión D-02). El "Ajuste de stock" (desde Movimientos) suma o resta valuado al PPP vigente, sin costo a mano. La carga inicial al migrar es una acción única de administrador (ver pendientes).

**Respecto del sistema actual.**

| | |
|---|---|
| Se mantiene | Los indicadores (variantes activas, bajo mínimo, sin stock, valor del inventario). La tabla por producto. "Verificar stock". |
| Se modifica | El stock se muestra en tres columnas (depósito / consignación / total). Estado sobre lo disponible en depósito. |
| Se agrega | Desglose por lote. Mínimo editable en la tabla. |
| Se elimina | Los insumos **no** aparecen en esta pantalla (tienen su stock en Insumos). |

---

### 3.5 Movimientos

**Qué hace.** Registro de todas las salidas de producto terminado (y los ajustes). Cada movimiento tiene un tipo, un tercero, un medio de pago y **uno o más ítems**. De acá salen los indicadores.

**Pantalla — historial.** Fecha, producto, tipo, cliente / destino (con medio de pago), lote, unidades (+/−), ingreso, costo. Filtros por tipo y producto. Botón "Nuevo movimiento".

**Pantalla — Nuevo movimiento** (misma estructura que la actual):

- **Tipo** (obligatorio), **Fecha**, **Tercero** (Cliente; obligatorio en consignación y devolución), **Medio de pago** (solo ventas), impacto en el reporte (informativo, lo muestra el sistema).
- **Ítems**: variante (producto), cantidad, **precio neto por unidad** (solo en ventas; precargado desde Precios según el tipo de cliente, editable), **precio con IVA por unidad** (solo lectura, calculado = neto × 1,21; para que las socias vean lo que cobra el cliente), lote (lo asigna el sistema, FIFO), ingreso neto, costo PPP. Botón "Agregar ítem".
- Resumen del movimiento: ingreso neto total, y al lado **"con IVA (lo que paga el cliente)"** calculado; costo total.
- Resumen: ingreso neto total, costo total.
- **Cliente**: desplegable del maestro (muestra "nombre · tipo") con opción **"＋ Nuevo cliente…"** que despliega un alta rápida (nombre y tipo) sin salir del movimiento. **Nunca texto libre.**

**Tipos de movimiento y su comportamiento.**

| Tipo | Descuenta stock | Impacto en el reporte | Tercero | Precio |
|---|---|---|---|---|
| Venta | Sí (FIFO) | Ingreso + CMV | Cliente | Sí |
| Venta desde consignación | Sí (del saldo consignado) | Ingreso + CMV | Cliente (obligatorio) | Sí |
| Consignación | **No** — pasa al saldo del cliente | Neutro | Cliente (obligatorio) | — |
| Devolución de consignación | No — vuelve del saldo al depósito | Neutro | Cliente (obligatorio) | — |
| Canje, Presentación, Regalo, Sorteo, Tester, Influencer, Prueba | Sí | Costo de salida no-venta | Cliente (opcional) | — |
| Rotura / Defectuoso | Sí | Costo de salida no-venta | — | — |
| Co-branding | Sí | Acción comercial a costo (línea propia) | Cliente | — |
| Ajuste de stock | Según signo (+ suma / − resta) | Si resta: pérdida (salida no-venta). Si suma: entra al PPP vigente | — | — |

**Reglas.**

- Ingreso neto = cantidad × precio neto (el precio ya se carga sin IVA; *v1.2*).
- Precio precargado: mayorista si el cliente es "Distribuidor / mayorista" y el producto tiene precio mayorista cargado; si no, retail.
- Costo de la salida = cantidad × PPP del producto al momento del movimiento.
- El lote sale por FIFO; si la cantidad cruza lotes, el movimiento lo registra ("L1 ×300 · L2 ×10").
- Validaciones: stock suficiente en depósito (o saldo consignado suficiente); cliente obligatorio donde corresponde; cantidad válida.
- Un movimiento con varios ítems es **una cabecera con N líneas**; cada línea impacta en su producto.
- **No existe el tipo "Ingreso"** para producto terminado (decisión D-02). Las compras de insumos tampoco van por acá: van por Insumos → Compra.
- **Canal (online / físico / distribuidor)**: por ahora **no se pide** (decisión D-11). Los costos variables de canal del reporte quedan sin fuente hasta que las socias definan el criterio; la vía probable es derivarlo del tipo de cliente.

**Respecto del sistema actual.**

| | |
|---|---|
| Se mantiene | La estructura completa del formulario: tipo, fecha, tercero, medio de pago, ítems múltiples con "Agregar ítem". El historial con fecha, tipo, tercero, ítems, total. |
| Se modifica | La lista de tipos (se agregan los de Maitén). El tercero "Cliente" pasa a ser desplegable del maestro con alta rápida. El precio se pide solo en ventas; el costo nunca (lo pone el sistema). |
| Se agrega | Tipos: Venta desde consignación, Sorteo, Tester, Co-branding, Influencer, Prueba. Lote automático por FIFO. Ingreso neto y costo calculados por ítem. Impacto en el reporte visible. Alta rápida de cliente. Precio neto precargado desde Precios por tipo de cliente. |
| Se elimina | El tipo **Ingreso** (para producto terminado entra por Producción; para insumos, por Insumos → Compra). Las variantes de **insumos** en el selector de ítems (acá solo producto terminado). El campo "Proveedor" (no aplica sin ingresos). |

---

### 3.6 Consignaciones

**Qué hace.** Gestiona la mercadería entregada a clientes que se cobra cuando venden. Las consignaciones **se crean desde Movimientos** (tipo Consignación) y se administran acá.

**Pantalla.**

- Indicadores: consignaciones abiertas, unidades afuera, valor a costo afuera (pendientes × PPP), vencidas.
- Tabla: cliente, producto, **lote**, entregadas, vendidas, devueltas, **pendientes**, fecha, **vence**, estado, acciones. Filtro por estado. Botón "Nueva consignación" (abre Movimientos con el tipo preseleccionado).
- Acciones por fila (mientras haya pendientes): **Registrar venta** → abre Movimientos con tipo "Venta desde consignación", cliente, producto y cantidad pendiente precargados; **Devolución** → ídem con "Devolución de consignación".

**Reglas.**

- Una consignación es un saldo **por cliente, producto y lote**. Si una entrega cruza lotes, se generan tantas consignaciones como lotes.
- Al consignar, las unidades salen del depósito (FIFO) y pasan al saldo del cliente. **El stock total propio no cambia.**
- **Venta desde consignación**: baja el saldo pendiente del cliente (FIFO entre sus consignaciones de ese producto), **recién ahí descuenta el stock total** y genera ingreso y CMV.
- **Devolución**: baja el pendiente y las unidades vuelven al depósito, al lote del que salieron. Sin ingreso ni costo.
- **Vencimiento**: fecha para rendir cuentas; se propone a 60 días de la entrega y se puede cambiar.
- **Estados**: Abierta (nada vendido ni devuelto), Parcial (vendió o devolvió parte), Vencida (pasó la fecha y quedan pendientes), Cerrada (sin pendientes).
- Pendientes = entregadas − vendidas − devueltas.

**Respecto del sistema actual.**

| | |
|---|---|
| Se mantiene | El módulo con su definición ("mercadería entregada a clientes que se cobra cuando venden; las nuevas se crean desde Movimientos"). Columnas cliente, productos, unidades, fecha, vence, estado, acciones. |
| Se modifica | El estado pasa a calcularse (Abierta / Parcial / Vencida / Cerrada). |
| Se agrega | Lote por consignación. Vendidas / devueltas / pendientes. Acciones "Registrar venta" y "Devolución" que abren Movimientos precargado. Indicadores. Vencimiento propuesto a 60 días. |
| Se elimina | Nada. |

---

### 3.7 Clientes

**Qué hace.** Registro maestro de clientes. Alimenta Movimientos (desplegable con alta rápida), Consignaciones (saldo por cliente) y, a futuro, cuenta corriente y lista de precios por tipo.

**Pantallas.**

- *Listado*: nombre, tipo, email, teléfono, estado, y tres columnas **calculadas** (no se cargan): compró (unidades), ingresos, en consignación. Buscador y filtro por tipo. Botón "Nuevo cliente".
- *Alta / edición*: nombre (obligatorio), tipo (obligatorio), email, teléfono, CUIT, notas, estado. Igual a la actual.
- *Ficha del cliente*: datos a la izquierda; a la derecha indicadores (unidades compradas, ingresos netos, en consignación, último movimiento), su mercadería en consignación (con vencimiento y estado) y todos sus movimientos (fecha, tipo, producto, lote, unidades, ingreso, medio de pago). Lugar reservado para el saldo de cuenta corriente.

**Tipos de cliente.** Particular · Veterinaria · Pet shop · Distribuidor / mayorista · Marca aliada · Prensa / influencer. A futuro el tipo puede definir la lista de precios (retail vs. mayorista) y el canal.

**Reglas.**

- El cliente **siempre es un registro del maestro**; nunca texto libre en un movimiento.
- Alta rápida desde Movimientos crea el registro con nombre y tipo; el resto se completa después en la ficha.
- Para ventas online sin identificar existe un cliente genérico "Consumidor final (Tienda Nube)".
- Un cliente con movimientos no se borra: se inactiva (borrado lógico, según políticas).

**Respecto del sistema actual.**

| | |
|---|---|
| Se mantiene | Listado y alta con nombre, tipo, email, teléfono, CUIT, notas, estado. |
| Se modifica | La lista de tipos (hoy "Particular") pasa a los seis tipos de Maitén. |
| Se agrega | Columnas calculadas en el listado. Ficha con indicadores, consignaciones y movimientos del cliente. Alta rápida desde Movimientos. Cliente genérico de Tienda Nube. |
| Se elimina | Nada. |

---

### 3.8 Reportes — Reporte económico

**Qué hace.** Indicadores del período. **Nada se carga a mano**: todo sale de Movimientos, Producción e Insumos. Los costos fijos **no están** (no existe todavía un módulo para asignarlos), por lo que el resultado que se muestra es **antes de costos fijos**.

**Pantalla.**

- Selector de **período (mes)**.
- Cuatro indicadores: **unidades vendidas**, **ingresos** (netos de IVA), **CMV** (al PPP), **resultado bruto** (con % de margen).
- **Por producto**: producto, unidades, ingresos, CMV, bruto, margen, stock, meses de stock, % consumido.
- **Desglose por tipo de movimiento**: tipo, unidades, valorizado a costo (todos los tipos del período, incluida Producción).
- **Del resultado bruto al resultado antes de costos fijos** (cascada): resultado bruto − costos de canal (pendiente) ± desvíos de producción − co-branding − salidas no-venta − pérdida por insumos = **resultado antes de costos fijos**. Con la aclaración de que cuando existan los costos fijos, se restan acá y ese resultado pasa a ser el EBIT.
- **Evolución mensual**: la misma estructura, mes a mes desde el primer mes con datos, con columna total. Sin costos fijos.

**Definiciones.**

- Unidades vendidas = Σ unidades de tipo Venta y Venta desde consignación en el período.
- Ingresos = Σ ingreso neto de esas ventas. CMV = Σ costo (PPP) de esas ventas. Resultado bruto = ingresos − CMV. Margen = bruto ÷ ingresos.
- Stock = en depósito hoy. **Meses de stock** = stock ÷ unidades vendidas en el período (con el período = un mes). **% consumido** = vendidas ÷ (vendidas + stock). *(Definiciones propuestas; a validar.)*
- Desvíos de producción = de las órdenes **cerradas** en el período (ahorro positivo, sobrecosto negativo).
- Co-branding = costo de las salidas de ese tipo. Salidas no-venta = costo de canje, presentación, regalo, rotura, sorteo, tester, influencer, prueba y ajustes negativos. Pérdida por insumos = bajas del período.
- Costos de canal = pendiente (sin canal en los movimientos, es cero para los nuevos).

**Respecto del sistema actual.**

| | |
|---|---|
| Se mantiene | Toda la estructura: selector de mes, cuatro indicadores, tabla por producto con sus columnas, desglose por tipo de movimiento. |
| Se modifica | Se explicitan las definiciones de "meses stock" y "% consumido". |
| Se agrega | La cascada hasta el resultado antes de costos fijos (desvíos, co-branding, salidas no-venta, pérdida por insumos). La evolución mensual. |
| Se elimina | Nada. |

---

### 3.9 Precios (venta) *(v1.2)*

**Qué hace.** Lista de precios de venta sugeridos por producto, retail y mayorista. Se precarga en Movimientos al elegir producto y cliente; siempre editable en la venta. Es el módulo que Fede ya construyó, con dos ajustes.

**Pantalla.** Producto, SKU, **Retail neto** (editable) · **Retail con IVA** (calculado, neto × 1,21) · **Mayorista neto** (editable; vacío = "usa retail") · **Mayorista con IVA** (calculado) · Guardar. Subtítulo: "se carga neto; el sistema muestra el precio con IVA para las socias".

**Reglas.**

- Se guarda solo el neto; el bruto es informativo (IVA 21 %).
- Mayorista vacío → Movimientos usa retail para todos los clientes.
- Valores de referencia iniciales: shampoo retail neto $21.818 (≈ $26.400 con IVA), crema $24.215 (≈ $29.300). Mayorista: sin definir.
- Vigencia/historial de precios de venta: no en esta etapa (queda en pendientes).
- El precio de la **fábrica** no va acá: vive en Producción → Fábrica.

**Respecto del sistema actual.**

| | |
|---|---|
| Se mantiene | La pantalla completa: tabla producto / SKU / retail / mayorista con Guardar por fila; la precarga en Movimientos. |
| Se modifica | Cada columna pasa a **neto editable + con IVA calculado**. El subtítulo (hoy dice "con IVA"). |
| Se agrega | Regla "mayorista vacío = usa retail". Selección del precio según tipo de cliente. |
| Se elimina | Nada. |

---

### 3.10 Módulos que no se tocan (por ahora)

Inicio, Proveedores, CC Clientes, CC Proveedores, Contabilidad, Rubros, Costos fijos, Usuarios: **sin cambios** en esta etapa. Proveedores queda como está (ficha, cuenta corriente, compras al proveedor): **no** se le agrega el tarifario de la fábrica. Ver pendientes (sección 7) para cuenta corriente, costos fijos y módulo contable.

---

## 4. Modelo de datos

Entidades y campos mínimos. Los nombres son orientativos; las relaciones sí importan.

**Producto** — id, sku, nombre, rubro, presentación, stock_minimo, online (bool), estado, ppp (calculado), stock_total (calculado).

**RecetaVersion** — id, producto_id, numero (v1, v2…), vigente_desde, vigente_hasta (null = vigente).
**RecetaLinea** — id, receta_version_id, insumo_id, cantidad_por_unidad, unidad.

**Insumo** — id, nombre, unidad (kg | u), reutilizable (bool), vence (bool), ppp (calculado), stock (calculado), proveedor_id, estado.
**CompraInsumo** (cabecera) — id, fecha, proveedor_id, lote_id (nullable), total.
**CompraInsumoLinea** — id, compra_id, insumo_id, cantidad, costo_total, costo_unitario, vencimiento (nullable).
**BajaInsumo** — id, fecha, insumo_id, cantidad, motivo, monto (cantidad × ppp), lote_id (nullable), orden_id (nullable si fue automática).

**Lote** — id, nombre, fecha_creacion, producto_id (nullable; un lote puede abarcar los dos productos si así lo usan).

**PrecioFabricacion** — id, producto_id, precio_unitario (sin IVA), vigente_desde, vigente_hasta. *(v1.1: por producto y por unidad, no por lote. v1.2: se administra en Producción → Fábrica; la orden lo lee, no lo escribe.)*
**MinimoCompraFabrica** — id, monto (sin IVA; hoy $450.000), vigente_desde, vigente_hasta, creado_por, creado_en. *(v1.2: una fila por vigencia, nunca se edita ni se borra; antes "ParametroFabrica". La pantalla lista todas las filas como historial.)*
**PrecioVenta** *(v1.2)* — id, producto_id, retail_neto, mayorista_neto (nullable). Sin vigencia por ahora.

**OrdenProduccion** — id, producto_id, lote_id, receta_version_id, estado (Planificada | Cerrada | Anulada), fecha_prevista, fecha_cierre, unidades_planificadas, unidades_obtenidas, precio_fabricacion_unitario (copiado del vigente a fecha_prevista, sin IVA), minimo_compra_aplicado (copiado del vigente a fecha_prevista), minimo_compra_id (la vigencia usada, para contar órdenes por vigencia), fabricacion_cotizada (= planificadas × precio), fabricacion_cobrada (sin IVA), costo_mp, costo_total, costo_unitario, desvio_mp, desvio_fabricacion, movimiento_entrada_id.
**OrdenLinea** — id, orden_id, insumo_id, cantidad_estandar, consumo_teorico, consumo_real, ppp_al_cierre, desvio_fisico, desvio_monto.

**Movimiento** (cabecera) — id, fecha, tipo, cliente_id (nullable), medio_pago (nullable), observaciones, usuario_id.
**MovimientoItem** — id, movimiento_id, producto_id, cantidad, precio_con_iva (nullable), ingreso_neto, costo (cantidad × ppp), consignacion_id (nullable; en venta desde consignación / devolución).
**MovimientoItemLote** — id, item_id, lote_id, cantidad (detalle FIFO: un ítem puede tocar varios lotes).

**StockLote** — producto_id, lote_id, cantidad_en_deposito (derivable de movimientos; conviene materializarla).

**Consignacion** — id, fecha, vence, cliente_id, producto_id, lote_id, entregadas, vendidas, devueltas, movimiento_origen_id. Pendientes y estado se calculan.

**Cliente** — id, nombre, tipo, email, telefono, cuit, notas, estado.
**Proveedor** — id, nombre, cuit, email, telefono, estado.

**Relaciones clave.** Producto 1—N RecetaVersion 1—N RecetaLinea N—1 Insumo. OrdenProduccion N—1 Lote, N—1 RecetaVersion, 1—N OrdenLinea, 1—1 Movimiento (entrada). Movimiento 1—N MovimientoItem 1—N MovimientoItemLote. Consignacion N—1 Cliente, N—1 Lote. CompraInsumo N—1 Lote (opcional).

**Sobre vigencias y auditoría.** Según la Sección B de las políticas: los valores económicos que cambian (precio de fabricación, versiones de receta, y a futuro precios de venta) se guardan con `vigente_desde` / `vigente_hasta`; nada se borra físicamente (estado / anulado + auditoría de quién, cuándo, valor anterior y nuevo).

---

## 5. Cálculos

```
Consumo teórico (insumo, orden)   = cantidad_estandar_por_unidad × unidades_planificadas
Desvío físico                     = consumo_real − consumo_teórico
Desvío $                          = desvío físico × PPP del insumo          (− ahorro, + sobrecosto)
Costo MP + envases del lote       = Σ consumo_real × PPP
Fabricación cotizada (orden)      = unidades_planificadas × precio_unitario_del_producto vigente a la fecha de la orden (sin IVA)
Fabricación cobrada (orden)       = lo facturado por la fábrica (por defecto, la cotizada)
Fabricación del lote (control)    = Σ fabricación de todas las órdenes del lote  → si < mínimo vigente a la fecha de la orden, avisar cuánto falta
Mínimo aplicado (orden)           = mínimo vigente a fecha_prevista, congelado en la orden (no cambia si después cambia el parámetro)
Fabricación del lote (costo)      = fabricación cobrada de la orden
Costo total del lote              = costo MP + fabricación
Costo unitario                    = costo total ÷ unidades_obtenidas
Rendimiento                       = unidades_obtenidas ÷ unidades_planificadas
Desvío de fabricación             = fabricación cobrada − fabricación cotizada

PPP insumo (tras una compra)      = (stock × PPP + costo_total_compra) ÷ (stock + cantidad)
PPP producto (tras una entrada)   = (stock × PPP + costo_total_lote) ÷ (stock + unidades_obtenidas)

Sobrante no reutilizable (lote)   = comprado_para_el_lote − consumido        (si > 0 → baja automática)
Pérdida por sobrante              = sobrante × PPP
Aprovechamiento del lote (MP)     = Σ consumido × PPP ÷ Σ comprado × PPP     (solo insumos en kg)

FIFO de salida                    : se descuenta del lote con existencia más antiguo; si no alcanza, sigue con el siguiente
Precio neto precargado            = mayorista_neto si cliente es mayorista y existe; si no, retail_neto
Ingreso neto de un ítem           = cantidad × precio_neto            (todo el sistema trabaja sin IVA)
Precio con IVA (informativo)      = precio_neto × 1,21
CMV de un ítem                    = cantidad × PPP del producto

Consignación pendientes           = entregadas − vendidas − devueltas
Estado consignación               = sin pendientes → Cerrada; vencida y con pendientes → Vencida;
                                    con vendidas o devueltas → Parcial; si no → Abierta

Reporte del período:
  Resultado bruto                 = ingresos − CMV
  Resultado antes de costos fijos = bruto − costos de canal ± desvíos − co-branding − salidas no-venta − pérdida insumos
  Meses de stock (producto)       = stock en depósito ÷ unidades vendidas en el período
  % consumido (producto)          = vendidas ÷ (vendidas + stock en depósito)
```

---

## 6. Registro de decisiones

Cada decisión con su motivo, para que nadie la reabra sin conocer el contexto. Tomadas entre Lautaro y Claude, con validación de las socias donde se indica.

| # | Decisión | Motivo |
|---|---|---|
| D-01 | **Stock = entradas − salidas; una sola fuente de verdad.** Nada mueve stock por fuera de Movimientos. | Integridad: el stock siempre cuadra y siempre se puede explicar. |
| D-02 | **Producción y Stock desacoplados; el producto terminado entra solo por Producción.** Sin tipo "Ingreso" manual con costo. | El sistema ya calcula el costo del lote; un ingreso manual con costo a mano rompería el PPP. |
| D-03 | **La receta vive en la ficha del producto, es físico puro y versionada con vigencia.** | Separación físico normalizado / monetario resultante (metodología de costeo de Maitén). Los lotes viejos siguen atados a su versión. |
| D-04 | **El precio de venta queda fuera de la ficha del producto.** Se define cuando se diseñe Ventas (lista de precios con vigencia y por tipo: retail / mayorista). | Precio no es dato de la receta; hay dos precios en la práctica (mayorista al 40 %) e inflación. |
| D-05 | **Fabricación = unidades × precio unitario por producto (vigente, con historial) + control del mínimo de compra por orden ($450.000) sobre el total del lote.** Costo unitario = cobrada ÷ obtenidas. Sin estándar aparte, sin tandas, sin efecto tamaño de lote. *(v1.1; reemplaza al "monto por lote" de la v1.0.)* | Es lo que dice la OC N°3 (precio por unidad y por producto) y lo que explicó Gina (mínimo de $450.000 que siempre superan). |
| D-06 | **Sobrante de insumo no reutilizable = pérdida del período** (baja automática al cerrar el lote, línea propia en el reporte). No se carga al costo del lote. | Por normativa sanitaria no se reutilizan; mantener el costo unitario limpio y la pérdida visible y medible (escenario B). |
| D-07 | **Reutilizable es un atributo por insumo**, no por categoría; con marca de vencimiento. | Gina: algunos insumos se reusaron entre lotes; los naturales vencen o se secan. |
| D-08 | **El lote es dato maestro** (desplegable, alta desde la orden o la compra). | Para sacar indicadores por lote; no texto libre. |
| D-09 | **La orden tiene dos momentos** (planificada / cerrada) con chequeo de insumos al planificar y unidades obtenidas al cerrar. Costo unitario sobre obtenidas. | Refleja los tiempos reales (comprar → fabricar → cerrar) y mide rendimiento. |
| D-10 | **Stock por lote con FIFO automático; valuación PPP por producto.** | Trazabilidad sanitaria sin trabajo extra para el usuario; replica el Excel. |
| D-11 | **Canal (online / físico) no se pide por ahora.** Los costos de canal del reporte quedan pendientes. | Lautaro debe ajustar el criterio con las socias. Vía probable: derivarlo del tipo de cliente. |
| D-12 | **Consignación con saldo por cliente**, en su módulo propio: no descuenta al entregar; venta desde consignación descuenta y genera ingreso; devolución repone; vencimiento a 60 días; estados calculados. | Es lo que describe el módulo Consignaciones existente; da control de qué hay afuera y en manos de quién. |
| D-13 | **Movimientos con la estructura actual** (tipo, fecha, tercero, medio de pago, ítems múltiples), agregando tipos de Maitén, lote automático y alta rápida de cliente. Sin mostrar stock ni "descuenta" en el formulario. | No inventar otro formulario; lo que ya hay es correcto. |
| D-14 | **Cliente siempre del maestro, con alta rápida** (nombre + tipo) desde el movimiento. Nunca texto libre. | Trazabilidad, saldo de consignación y cuenta corriente dependen de que el cliente sea único. |
| D-15 | **Reporte económico con la estructura actual** + cascada hasta resultado antes de costos fijos + evolución mensual. **Costos fijos fuera de alcance** hasta que exista el módulo. | Lo que el proceso ya calcula se muestra; lo que no existe no se simula. |
| D-16 | **Co-branding se registra como salida a costo, con línea propia** en el reporte (acción comercial). No se registran los snacks recibidos. | Es una permuta con valor recibido incierto e inmaterial; lo entregado es el costo real de la acción. |
| D-17 | **El desvío de fabricación del Excel (por unidad) deja de existir**; queda solo cotizado vs. cobrado. | El precio por unidad lo fija la fábrica; la única diferencia posible es que facture distinto (aplicó el mínimo, aumentó sin actualizar el tarifario). |
| D-18 | **El snack (co-branding) no se modela** como producto. | Fue una acción única. |
| D-19 | **Todos los costos sin IVA; precios de venta cargados netos, con el bruto calculado como referencia.** El IVA va al módulo contable, más adelante. *(v1.2)* | Maitén es responsable inscripto: el IVA es crédito/débito fiscal, no costo ni ingreso. Si se mezclara, el margen del reporte saldría inflado un 21 %. Las socias piensan en precio de góndola, por eso se muestra el bruto. |
| D-20 | **El tarifario de la fábrica vive en Producción → pestaña "Fábrica"** (precio por producto con vigencias + mínimo de compra, también con vigencias). En la orden son de solo lectura y quedan **congelados** (precio y mínimo vigentes a la fecha de la orden): un cambio impacta de ahora en más, nunca hacia atrás. *(v1.2)* | "Precios" es de venta; "Proveedores" es cuenta corriente y compras; la ficha de producto no lleva precios (D-04). Es un dato del proceso de producir y quien planifica lo necesita a un clic. Descartado Configuración: separa el dato de donde se usa. |

---

## 7. Pendientes y fuera de alcance

**A definir con las socias (bloquean partes del diseño):**

- **Canal de venta** (online / físico / distribuidor) y su costo: criterio y si se deriva del tipo de cliente (D-11).
- **Marca "reutilizable"** insumo por insumo (D-07). En el mockup están marcados como no reutilizables: gel de aloe, manteca de karité, aceites de coco, caléndula y almendras.
- **Estándares del shampoo**: en el Excel, la columna "cant/kg" suma 1,76 kg por kg (el agua figura como 1,00) y multiplicada por el peso del envase (0,254 kg) da 447 g de mezcla por frasco de 250 ml. Puede que "cant/kg" esté expresado por kg de agua base. Revisar con Nati antes de cargar las recetas.
- **Definiciones de "meses de stock" y "% consumido"** del reporte (propuestas en 3.8).
- **Qué pasa si un lote no llega al mínimo de la fábrica**: ¿la fábrica no toma la orden (alcanza con el aviso) o cobra el mínimo igual (habría que prorratear la diferencia entre las unidades del lote)? Confirmar con Gina. El mockup solo avisa.
- **Precio mayorista** por producto (hoy vacío = usa retail).

**Fuera de alcance de esta etapa (próximos diseños):**

- **Vigencia / historial de la lista de precios de venta** (el módulo Precios ya está definido en 3.9, sin vigencias por ahora).
- **Módulo contable / IVA**: carga de la factura del proveedor con su crédito fiscal, débito fiscal de las ventas, IVA a pagar del período. Hasta entonces, el sistema trabaja todo neto (D-19).
- **Costos fijos**: módulo para cargarlos por mes y su línea en el reporte (EBIT). *(Fede ya creó un módulo "Costos fijos": ídem.)*
- **Cuenta corriente de clientes y proveedores**: las ventas con medio de pago "Crédito (cta. cte.)" y las compras a proveedores deberían formar saldos.
- **Integración con Tienda Nube** (sincronizar ventas como movimientos tipo Venta con cliente genérico y canal online).
- **Facturación**.
- **Migración / carga inicial desde el Excel**: recetas (v1 vigente desde 01/01/2026), PPP de insumos y su stock, stock de producto por lote (shampoo L1 306 · L2 400; crema L1 2.208 · L2 400 + 10 en consignación), órdenes cerradas de los lotes 1 y 2, clientes. Es una acción única de administrador, valuada al costo conocido.
- **"Editar ficha"** de producto, insumo y cliente (flujos de edición, no solo alta).
- **Permisos por usuario** (qué puede cerrar una orden, dar de baja, etc.).

---

## 8. Datos de referencia (del Excel GESTION)

**Productos.** MAI-SH-AR-250 · Shampoo Aloe Vera y Rosa Mosqueta · Capilar · 250 ml · mínimo 50. MAI-CR-CAL-060 · Crema Reparadora de Caléndula · Corporal · 60 g · mínimo 50.

**Receta shampoo (kg por unidad terminada, receta v1).** Lauril éter sulfato de sodio 25 % 0,1422 · Gel de aloe vera 0,0051 · Cocoamido propil betaína 0,0254 · Glicerina 0,0076 · Pantenol 0,0025 · Fragancia rosa mosqueta 0,0013 · Rojo punzó 4R 0,0000 · Cloruro de sodio 0,0046 · Carbopol 940 0,0020 · Euxyl PE 9010 0,0013 · Dietanolamina c.s.p. 0,0010 · Agua purificada 0,2540 · + envase 250 ml 1 u · caja 1 u · etiqueta 1 u.

**Receta crema (kg por unidad terminada, receta v1).** Manteca de karité 0,0048 · Aceite de coco 0,0030 · Aceite de caléndula 0,0030 · Cera de abejas 0,0012 · Aceite de almendras 0,0030 · Glicerina 0,0030 · Fragancia almendras dulces 0,0001 · Alcohol cetearílico 0,0018 · Vitamina E 0,0003 · Gel de aloe vera 0,0030 · Euxyl PE 9010 0,0003 · Goma xántica 0,0003 · Agua purificada 0,0600 · + envase 60 g 1 u · caja 1 u.

**PPP de insumos (lote 2, $ por kg salvo indicación).** Lauril 2.921 · Aloe 38.609 · Cocoamido 9.191 · Glicerina 4.275 · Pantenol 56.929 · Fragancia rosa 37.980 · Rojo punzó 61.060 · Cloruro de sodio 3.561 · Carbopol 41.207 · Euxyl 63.955 · Dietanolamina 7.105 · Karité 29.171 · Coco 19.309 · Caléndula 24.841 · Cera 32.871 · Almendras 25.038 · Fragancia almendras 28.937 · Alcohol cetearílico 8.547 · Vitamina E 81.492 · Goma xántica 21.128 · Envase shampoo 599,56/u · Envase crema 1.494,43/u · Cajas 511,41/u · Etiquetas 179,75/u.

**Lotes.** Lote 1 (cierre 01/01/2026): shampoo 460 u, crema 2.383 u. Lote 2 (OC N°3 del 1/7/2026, cierre 08/08/2026): 400 u y 400 u. PPP producto: shampoo $3.718, crema $4.308.

**Fabricación (OC N°3, 1/7/2026).** Shampoo: 100 kg → 400 u × $1.092 + IVA = $436.800. Crema: 24 kg → 400 u × $1.460,36 + IVA = $584.144. Total OC $1.020.944 + IVA. Precios lote 1: shampoo $960/u, crema $1.200/u. **Mínimo de compra de la fábrica: $450.000 por orden.** La OC pide grabado láser del número de lote en las etiquetas. Todos los importes de la OC son + IVA: el sistema los guarda **sin IVA** (D-19).

**Precios de venta usados en el mockup (v1.2, netos).** Shampoo retail neto $21.818 (≈ $26.400 con IVA) · Crema $24.215 (≈ $29.300 con IVA). Mayorista: sin definir (en el Excel se observó −40 % sobre lista; no se carga hasta que lo confirmen las socias).

**Costos de canal (pendientes, del Excel).** E-commerce: shampoo $2.930/u, crema $2.810/u. Físico: $248,78/u.

---

## 9. Glosario

- **PPP** — precio promedio ponderado móvil: costo promedio que se recalcula con cada entrada.
- **FIFO** — primero entrado, primero salido: las salidas se atribuyen al lote más viejo.
- **Consumo teórico / real** — lo que la receta dice que lleva la orden / lo que efectivamente se usó.
- **Desvío** — diferencia entre real y teórico, valuada a PPP. Ahorro si negativo, sobrecosto si positivo.
- **Unidades obtenidas** — las que realmente salieron de la orden (vs. planificadas).
- **Reutilizable** — insumo que puede guardarse y usarse en un lote posterior.
- **Sobrante** — lo comprado para un lote que no se consumió.
- **En depósito / en consignación / total propio** — disponible para vender / en manos de clientes pero todavía tuyo / la suma.
- **Salida no-venta** — canje, presentación, regalo, rotura, sorteo, tester, influencer, prueba, ajuste negativo: descuenta stock y va a costo.
- **Resultado antes de costos fijos** — bruto menos todo lo variable y las pérdidas del período; pasa a ser EBIT cuando se resten los fijos.
