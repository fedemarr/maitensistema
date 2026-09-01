# Fase 3 — Orden de trabajo para OpenCode

> Encargo completo, modo autónomo. Mismos patrones y reglas que la Fase 2
> (ver `docs/fase-2-opencode.md` §3 — **siguen vigentes al pie de la letra**).
> Federico prueba cada módulo; Claude revisa el código.

---

## 1. Contexto y estado

Fase 2 cerrada y **deployada**: `https://maitensistema.vercel.app`
(repo `github.com/fedemarr/maitensistema`, cada push a `main` deploya solo).
Módulos vivos: Productos, Rubros, Clientes, Proveedores, Movimientos (motor de
stock, 8 tipos + `ajuste`), Panel de stock, Ficha de producto, Cuentas
corrientes, Reportes, Consignaciones, Contabilidad de partida doble.

Estado y decisiones en `docs/fase-2-estado.md`. El invariante rey sigue siendo
**el stock no miente nunca** (transaccional, atómico, sin negativos, reversible;
`CHECK (variantes.stock >= 0)` en la BD).

### Lo que falta y por qué esta fase

1. **El circuito de stock está abierto por arriba.** Hoy el stock solo entra por
   `ingreso` (compra a proveedor) o `ajuste`. Falta **producción**: Maitén
   fabrica sus productos consumiendo materia prima. Sin esto, ni el stock ni el
   costo real cierran. Esto es P0 y es la continuación natural del trabajo de
   stock de la Fase 2 (quedó fuera del encargo anterior por un recorte mío).
2. **Integraciones externas.** Ya venden en Tiendanube; el stock hay que
   sincronizarlo. Facturación AFIP para operar en blanco.
3. **Cierre para producción real.** Cosas bloqueantes antes de que las dueñas
   carguen datos de verdad (§5).

---

## 2. Prioridad

- **P0 — cerrar el circuito de stock:** J (Insumos) → K (Recetas) → L (Órdenes
  de producción). Al terminar, `verificarStock()` tiene que seguir sin
  diferencias y el costo de un producto fabricado debe reflejar los insumos
  consumidos.
- **P1 — usable en serio:** M (Usuarios y reset de contraseña) → N (IA de
  análisis server-side) → O (Tiendanube).
- **P2 — con diseño previo a revisar:** P (AFIP).

No arranques P1 hasta que Federico probó P0 y Claude revisó L.

---

## 3. Modelo de datos: insumos como "productos", sin tabla nueva

Reutilizá el motor de stock existente en vez de duplicarlo.

- Agregá `productos.es_insumo boolean not null default false`.
  Un **insumo** es un `producto` con `es_insumo = true`: tiene sus `variantes`
  (unidad de compra: "1 L", "5 kg", "x100 u"), su `stock`, su `costoPromedio`,
  y se mueve con los mismos `movimientos` (`ingreso` de insumo = compra;
  `ajuste`; `rotura` = merma).
- Productos terminados: `es_insumo = false` (lo actual). Filtralos en todas las
  pantallas que hoy listan productos para que no aparezcan insumos, y viceversa.
- Nuevo valor en el enum `tipo_movimiento`: **`produccion`**. Suma stock del
  producto terminado. La baja de insumos de esa misma orden se registra como
  ítems de salida del **mismo** movimiento o como un movimiento hermano
  `produccion` con signo negativo para los insumos — **elegí uno, documentalo**,
  y que `verificarStock()` y los asientos lo entiendan.
- Contabilidad: `produccion` mueve `Mercadería` (Debe, por el costo de los
  insumos) contra `Materia prima`/`Mercadería insumos` (Haber). No toca
  resultados. Si hace falta una cuenta nueva en el plan, agregala en migración
  + seed y actualizá `contabilidad-diseno.md`.

---

## 4. Módulos

### J. Insumos / Materia prima  ·  medio  ·  P0

- Migración: `productos.es_insumo`. Backfill `false`.
- `features/insumos/` (o extendé `features/productos` con un parámetro
  `esInsumo`): queries + actions reutilizando lo de productos.
- Rutas `/insumos`, `/insumos/nuevo`, `/insumos/[id]`, `/insumos/[id]/editar`
  (clonar Productos, con unidad en vez de "presentación/fragancia").
- El form de **Movimientos** (`movimiento-form.tsx`): en `ingreso` permitir
  elegir insumos además de productos terminados; el resto de los tipos sólo
  productos terminados (excepto `ajuste`/`rotura`, que también aceptan insumos).
- Panel de stock `/stock`: pestaña o filtro "Insumos" / "Terminados".
- Habilitá "Insumos" en el shell (sección Registros).

**Done:** cargo un insumo, registro su compra (sube stock del insumo + CC
proveedor si es a plazo), y lo veo en `/stock` filtrando por insumos.

### K. Recetas (lista de materiales)  ·  medio  ·  P0

- Tabla `recetas`: `id`, `variante_terminado_id -> variantes`,
  `rinde` int (unidades que produce el lote base), `activa boolean`, timestamps.
- Tabla `receta_items`: `id`, `receta_id`, `variante_insumo_id -> variantes`,
  `cantidad numeric(12,4)` (consumo por lote base), `merma_pct numeric` opcional.
- Una receta por variante de terminado (la activa). Editable con versión simple
  (al editar, desactivá la anterior y creá una nueva; no borres histórico).
- UI en la ficha del producto terminado: sección "Receta" con sus insumos y
  cantidades; alta/edición para `admin`/`ventas`.

**Done:** defino que 1 lote de "Shampoo 250 ml" (rinde 40) consume 8 L de base,
0,5 L de esencia y 40 envases; queda guardado y editable.

### L. Órdenes de producción  ·  GRANDE  ·  P0 — el corazón de la fase

- Tabla `ordenes_produccion`: `id`, `variante_terminado_id`, `cantidad` int
  (unidades a producir), `estado` enum `borrador|en_proceso|completada|anulada`,
  `fecha` date, `movimiento_id uuid` (el `produccion` generado al completar,
  nullable), `notas`, `creado_por`, timestamps.
- `crearOrden`: valida que haya receta activa. En `borrador`/`en_proceso` NO
  toca stock.
- `completarOrden` (transaccional, invariantes de stock de la Fase 2):
  1. Calcula consumo de cada insumo = `receta_item.cantidad * cantidad / receta.rinde`
     (redondeo definido y documentado), aplicando `merma_pct`.
  2. **Valida stock de cada insumo**; si falta, `{ ok:false, error }` con el
     detalle de qué insumo y cuánto falta. No escribe nada.
  3. Crea el movimiento `produccion`: baja stock de los insumos (atómico),
     sube stock del terminado por `cantidad`.
  4. **Costo:** costo del lote = Σ(consumo_insumo × costoPromedio_insumo).
     Actualiza `costoPromedio` del terminado con promedio ponderado
     (misma fórmula que `ingreso`). Guarda `costo_unit` snapshot en los ítems.
  5. Genera el asiento contable (ver §3).
  6. Orden → `completada`, linkeá `movimiento_id`.
- `anularOrden` (solo `admin`, solo si `completada`): revierte el movimiento
  `produccion` exactamente (mismo criterio que `eliminarMovimiento`), con el
  chequeo de no dejar stock negativo; orden → `anulada`.
- Rutas `/produccion` (lista con estado y filtros), `/produccion/nueva`,
  `/produccion/[id]` (detalle: insumos requeridos vs. disponibles antes de
  completar; después, lo consumido y el costo resultante).
- Habilitá "Producción" en el shell (sección Operación).
- Ficha de producto y `/reportes`: que el costo fabricado se vea reflejado.

**Done:** con stock de insumos suficiente, completo una orden de 40 u.:
bajan los insumos según receta, suben 40 u. de terminado, el `costoPromedio`
del terminado pasa a reflejar el costo real, `verificarStock()` sigue en cero,
y hay un asiento balanceado. Si falta un insumo, la orden no se completa y me
dice cuál.

### M. Usuarios y contraseñas  ·  chico  ·  P1

- `/config/usuarios` (hoy "pronto" en el shell): lista de `perfiles` con
  nombre, email (de `auth.users`), rol, activo. Solo `admin`.
- Acciones (solo `admin`): cambiar rol, activar/desactivar, invitar usuario
  nuevo (`supabase.auth.admin.inviteUserByEmail` vía route handler server-side
  con la service key — nunca en el cliente).
- **Reset de contraseña:** página `/recuperar` (pide email →
  `supabase.auth.resetPasswordForEmail`) y `/actualizar-clave` (form de nueva
  contraseña tras el link). Agregá el link "Olvidé mi contraseña" en `/login`.
- Configurar en Supabase → Auth → URL Configuration el Site URL y redirect a la
  URL de Vercel (documentalo en el README, no hace falta código).

**Done:** un admin cambia el rol de otro usuario y lo invita por email; un
usuario que olvidó la clave la resetea desde el mail.

### N. IA de análisis (server-side)  ·  chico  ·  P1

Reemplazo sano de la función rota del prototipo viejo.

- Route handler `POST /api/analisis` (server): recibe un rango de fechas / mes,
  arma el contexto con las **queries de `features/reportes`** (no confíes en
  datos del cliente), llama a la API de Anthropic con
  `model: "claude-sonnet-5"`, `ANTHROPIC_API_KEY` desde env (ya está el campo en
  `.env.example`; cargala en Vercel). La key **nunca** sale del server.
- UI: en `/reportes`, un panel "Análisis" con un textarea de pregunta y la
  respuesta. Streaming opcional; si no, spinner.
- Manejá el caso "sin API key" con un mensaje claro y sin romper la página.

**Done:** en `/reportes` pregunto "¿qué producto conviene reponer?" y responde
usando los números del mes.

### O. Tiendanube  ·  GRANDE  ·  P1 — diseño primero

**Escribí `docs/tiendanube-diseno.md` y esperá revisión antes de codear.**
Cubrí: alta de la app en Tiendanube, OAuth (store_id + access_token, dónde se
guardan — tabla `integraciones` cifrada o env), webhook `order/created`
(verificación de firma), mapeo SKU Maitén ↔ producto Tiendanube, qué pasa si el
SKU no matchea, sincronización de stock saliente (¿en cada movimiento? ¿job?),
idempotencia (no procesar dos veces la misma orden), y qué NO sincronizamos.

Implementación (tras el OK): route handler del webhook que registra una `venta`
(descuenta stock, invariantes de siempre) marcada con `origen = "tiendanube"` y
el id de orden externo; endpoint/tarea para empujar stock a Tiendanube.

**Done:** una venta en Tiendanube aparece como movimiento y descuenta stock sin
doble conteo; al fabricar o ajustar acá, el stock en Tiendanube se actualiza.

### P. Facturación AFIP  ·  GRANDE  ·  P2 — solo diseño

`docs/afip-diseno.md`: evaluar hacerlo directo (WSAA/WSFEv1, certificados) vs.
un tercero (TusFacturas / Facturante / AfipSDK). Recomendación y estimación.
**No implementar** hasta revisión.

---

## 5. Cierre para producción (bloqueante antes de entregar a las dueñas)

Parte es de Federico, no de OpenCode — marcado con 👤.

- 👤 **Rotar credenciales de Supabase** (la publishable key vieja está en el
  historial del repo y la service key / password de la DB circularon en chat).
  Ideal: proyecto Supabase nuevo y limpio. Actualizar `.env.local` y las env de
  Vercel.
- 👤 Verificar plan de Supabase y que los **backups** automáticos estén activos.
- Revisar que **RLS** cubra las tablas nuevas de esta fase (`recetas`,
  `receta_items`, `ordenes_produccion`, `integraciones` si se crea): sumalas al
  loop de `supabase/setup.sql` y corré `pnpm db:setup`.
- `verificarStock()` como chequeo de salud: agregá un link visible en `/stock`
  para admins y documentá que conviene correrlo tras cada sesión de carga.
- Revисá que ningún Server Action nuevo quede sin `requireRole`.
- Semilla de datos de prueba (`pnpm db:seed`) actualizada con un insumo y una
  receta de ejemplo.

---

## 6. Entregable y revisión

- Rama `fase-3`, un commit por módulo, `pnpm typecheck && pnpm lint && pnpm build`
  en verde antes de cada commit. Migraciones commiteadas; si tocás RLS,
  `supabase/setup.sql` en el mismo commit.
- Actualizá `README.md` (estado) y `docs/fase-3-estado.md` (qué se hizo,
  decisiones, deudas, dudas) a medida que avanzás.
- Los diseños de O y P van como `.md` en `docs/` y quedan a la espera.
- **Puerta de aceptación de P0:** completar y anular órdenes de producción con
  stock de insumos variado; `verificarStock()` siempre en cero; el costo del
  terminado refleja los insumos; asientos balanceados. Recién ahí, P1.

**Revisión:** Federico prueba contra los "Done"; Claude revisa el módulo L con
lupa (transacciones, reversión, costo, asientos) igual que hizo con Movimientos.
