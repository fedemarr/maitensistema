# Módulo P — Facturación AFIP: diseño

Estado: **propuesta para revisar**. No implementado.

## 1. Qué hay que definir primero (con Nati / el contador)

Sin estos datos no se puede avanzar:

- **Condición fiscal de Maitén:** ¿Monotributo o Responsable Inscripto?
  - Monotributo → emite **Factura C**.
  - Responsable Inscripto → **Factura A** (a otros RI) y **Factura B**
    (a consumidor final / monotributo).
- **CUIT** y **punto de venta** habilitado para factura electrónica
  (se da de alta en AFIP; el "web services" es un punto de venta distinto al
  del talonario manual).
- ¿Facturan **todo** o sólo el canal mayorista / cuando el cliente lo pide?
- ¿Hoy cómo facturan? (talonario, otro sistema, no facturan todavía).

## 2. Dos caminos técnicos

### A. Directo contra AFIP (WSAA + WSFEv1)

- SOAP + certificado X.509 (se genera con la clave fiscal, se renueva).
- WSAA para el token de acceso (dura 12 h), WSFEv1 para pedir el CAE.
- Control total, **costo $0**, pero: mucho plomería (SOAP, XML, manejo de
  certificado en serverless, ambiente homologación vs producción), y hay que
  mantenerlo cuando AFIP cambia algo.
- Librerías: no hay una oficial JS buena; se arma a mano o con wrappers
  parciales.

### B. Servicio intermediario (recomendado para arrancar)

Abstraen WSAA/WSFE detrás de una API REST simple.

| Servicio | Modelo | Notas |
| --- | --- | --- |
| **AfipSDK** (afipsdk.com) | por comprobante / plan | API REST, maneja el cert por vos, tiene SDK JS. Simple. |
| **TusFacturas.app** | mensual + por comprobante | Más completo (PDF, envío por email, notas de crédito, reportes). |
| **Facturante** | mensual | Similar a TusFacturas. |

Recomendación: **AfipSDK** si sólo se necesita el CAE y armar el PDF nosotros;
**TusFacturas** si se quiere que ellos generen y manden el PDF/email y manejen
notas de crédito. Costo típico: **$10-25 USD/mes** o unos centavos por
comprobante.

## 3. Integración en el sistema (independiente del camino)

### 3.1 Datos

- Config (env o tabla `config_fiscal`): CUIT, punto de venta, condición IVA,
  y credenciales del servicio elegido.
- Tabla nueva:

```
comprobantes: id, movimiento_id -> movimientos, tipo text ('A'|'B'|'C'),
  punto_venta int, numero int, cae text, cae_vto date, total numeric,
  neto numeric, iva numeric, estado text ('pendiente'|'emitido'|'error'),
  pdf_path text, datos jsonb, timestamps
```

### 3.2 Flujo

- En la ficha de un movimiento `venta` (y quizá `ingreso` si son proveedores),
  botón **"Facturar"** (rol admin/ventas).
- Arma el payload (tipo según condición del cliente, ítems, IVA discriminado si
  es Factura A), llama al servicio, guarda `cae` + `numero`.
- Si falla, `estado = 'error'` con el detalle; se puede reintentar.
- El PDF: lo genera el servicio (camino B) o se arma con una plantilla
  (camino A) y se sube a Storage.
- **Etapa 0 (manual):** antes de automatizar, un campo simple en `movimientos`
  para anotar el número de comprobante emitido por fuera. Sirve para operar ya.

### 3.3 IVA

- Monotributo (Factura C): sin discriminar IVA, total = neto.
- Factura B: total incluye IVA (21% general), no se discrimina en el
  comprobante pero sí en el payload a AFIP.
- Factura A: se discrimina. Requiere que los productos tengan alícuota (casi
  siempre 21%; algunos de higiene podrían ser 10,5% — confirmar con contador).
- Agregar `alicuota_iva` a `productos` si se va a Factura A.

## 4. Recomendación de fases

1. **Etapa 0** — campo manual de nº de comprobante en el movimiento. Cero
   integración. Permite operar en blanco desde el día 1.
2. **Etapa 1** — integrar **un servicio intermediario** para emitir Factura
   B/C desde la ficha del movimiento, con reintento. Sin notas de crédito.
3. **Etapa 2** — notas de crédito (devoluciones), Factura A si aplica, envío
   por email, reportes de IVA.

No implementar nada hasta tener las respuestas de la sección 1.

## 5. Esfuerzo estimado

- Etapa 0: **trivial** (un campo + UI).
- Etapa 1 con servicio intermediario: **mediano** (1 tabla, 1 cliente de API,
  1 acción, UI en la ficha del movimiento).
- Camino A (directo AFIP): **grande** y con mantenimiento continuo — no
  recomendado para empezar.
