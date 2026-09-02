# Módulo O — Tiendanube / tienda online: diseño

Estado: **propuesta para revisar**. No implementado.

## 1. Decisión de fondo

Maitén ya vende en **Tiendanube**. Hay dos caminos y no son excluyentes:

1. **Ahora:** mantener Tiendanube como vidriera e **integrarlo** con este
   sistema, que pasa a ser la **fuente de verdad del stock**.
2. **Futuro:** construir una **tienda propia** dentro de este mismo repo
   (`(tienda)/` route group) para dejar de pagar la cuota de Tiendanube.

Ambos usan la misma base y el mismo catálogo (`productos` con `online = true`).
El paso 2 se puede hacer gradualmente sin cortar el 1.

**No** se hace un repo/deploy separado: eso obliga a sincronizar dos bases o
mantener una API entre medio, que es justo lo que queremos evitar.

## 2. Integración con Tiendanube (paso 1)

### 2.1 Vinculación (una vez)

- Crear una app en el Partner Portal de Tiendanube → `client_id` / `client_secret`.
- Flujo OAuth: `/config/integraciones/tiendanube` → redirige a Tiendanube →
  callback `/api/tiendanube/oauth` → guarda `store_id` + `access_token`.
- Tabla nueva:

```
integraciones: id, proveedor text ('tiendanube'), store_id text,
  access_token text (cifrado con pgcrypto o guardado como Secret en Vercel si
  es una sola tienda), estado text, datos jsonb, timestamps
```

Para una sola tienda alcanza con env vars (`TIENDANUBE_STORE_ID`,
`TIENDANUBE_TOKEN`); la tabla se justifica si mañana hay más de una.

### 2.2 Tiendanube → sistema (ventas entrantes)

- Registrar webhook `order/created` (y `order/paid`) apuntando a
  `/api/tiendanube/webhook`.
- El handler:
  1. Verifica el header `x-linkedstore-hmac-sha256` con el `client_secret`.
  2. Idempotencia: si ya existe un movimiento con
     `origen_externo = 'tiendanube:<order_id>'`, responde 200 y corta.
  3. Trae la orden por API (`GET /orders/:id`), mapea cada línea por **SKU**
     a una `variante`. SKU sin match → registra el movimiento igual, marca la
     línea como "sin mapear" y avisa (no descuenta stock de esa línea).
  4. Crea un movimiento `venta` (misma transacción y validaciones que
     `crearMovimiento`), con:
     - `medio_pago` = "Tiendanube" (medio nuevo, no crédito) o el real si viene.
     - `cliente` = busca/crea por email o CUIT; si no, queda sin cliente.
     - `notas` = "Tiendanube #<number>".
  5. Campos nuevos en `movimientos`: `origen text default 'manual'` y
     `origen_externo text` (único parcial).

**Qué NO hace:** no toca precios ni catálogo desde Tiendanube; no importa
histórico; no maneja devoluciones automáticas (se cargan a mano como ya se hace).

### 2.3 Sistema → Tiendanube (stock saliente)

El problema: que la tienda no venda lo que ya no hay.

- Al confirmarse cualquier movimiento que cambia stock de una variante con
  producto `online = true` (venta, producción, ajuste, rotura…), encolar un
  "push de stock" de esa variante.
- Implementación simple sin infra de colas: una tabla `sync_pendiente`
  (variante_id, intento, ultima_vez) + un endpoint `/api/tiendanube/sync`
  que procesa lo pendiente, llamado por un **Vercel Cron** cada 5-10 min.
  `PUT /products/:id/variants/:vid` con `{ stock }`.
- Alternativa más simple todavía para el volumen de Maitén: un cron que cada
  15 min empuja el stock de **todas** las variantes `online`. Menos código,
  suficiente.
- Mapear `producto`/`variante` ↔ ids de Tiendanube: guardar
  `tiendanube_product_id` y `tiendanube_variant_id` en `variantes` (nullable),
  poblados al vincular o en el primer match por SKU.

### 2.4 Errores y visibilidad

- Página `/config/integraciones` (admin): estado de la conexión, último sync,
  líneas sin mapear, botón "reintentar".
- Todo error de sync se registra en `auditoria` con entidad `sync-tiendanube`.

## 3. Tienda propia (paso 2, futuro)

Cuando se quiera bajar la cuota de Tiendanube:

```
src/app/(tienda)/            # público, SIN auth (agregar a PUBLIC_PATHS del proxy)
  page.tsx                   # home / catálogo
  producto/[slug]/page.tsx   # ficha pública
  carrito/                   # estado en cookie
  checkout/                  # datos + método de entrega
  gracias/[pedido]/page.tsx
src/app/api/pago/webhook     # confirmación de Mercado Pago
```

- Catálogo = `productos` con `online = true` + campos extra a agregar:
  `descripcion_larga`, `slug`, `orden`, `galeria` (varias fotos).
- Nada de admin nuevo: se gestiona desde `/productos`.
- **Etapa A (mínima):** catálogo + "pedir por WhatsApp" (arma el mensaje con
  el carrito). Sin pagos. Cubre mucho.
- **Etapa B:** carrito real + `pedidos` (tabla) + **Mercado Pago Checkout Pro**
  (redirect + webhook). Al confirmarse el pago, el pedido genera un movimiento
  `venta` (reusa el motor de stock).
- **Etapa C:** envíos (tarifas planas por zona, o API de Andreani/Correo).
- Dominio: `maiten.com.ar` → tienda, `sistema.maiten.com.ar` → back-office
  (Vercel: dos dominios, un proyecto; el `(tienda)` responde en el primero).

## 4. Preguntas abiertas

- ¿Qué plan de Tiendanube tienen hoy y qué API access da? (algunos planes
  limitan webhooks / rate).
- ¿Los pedidos de Tiendanube ya vienen con SKU cargado en cada variante?
  Sin SKU consistente, el mapeo es frágil.
- ¿Se quiere el cliente de Tiendanube dado de alta en el sistema (para CC,
  historial) o alcanza con el movimiento suelto?
- Para la tienda propia: ¿Mercado Pago es el único medio o también
  transferencia / efectivo contra entrega?
- ¿Hace falta multi-sucursal / retiro en local?

## 5. Esfuerzo estimado

- Integración paso 1 (webhook entrante + cron de stock saliente + página de
  estado): **mediano** — 3 tablas/campos, 3 endpoints, 1 página.
- Tienda propia etapa A (catálogo + WhatsApp): **chico-mediano**.
- Etapa B (carrito + Mercado Pago): **mediano-grande**.
