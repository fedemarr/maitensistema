# Sistema Maitén — Handoff Técnico

**Para:** Federico
**De:** Lautaro
**Fecha:** Abril 2026
**Estado del proyecto:** Prototipo Fase 1 completo, listo para retomar desarrollo.

---

## TL;DR

Maitén es un negocio de cosmética e higiene animal (productos naturales para mascotas). Necesitamos un sistema de gestión propio que cubra lo que Tiendanube (donde ya venden online) no cubre: consignaciones, tipos de movimiento diferenciados, contabilidad interna, canal mayorista y producción.

Partimos de un **prototipo funcional que ya usé para un club de rugby** (Los Cedros) y lo adaptamos a Maitén. Está funcionando. Ahora te toca vos: el rol es **desarrollo full-stack**, yo me quedo en producto, diseño y validación con las socias del negocio.

Es un HTML monolítico (~7000 líneas, todo inline) conectado a Supabase. Sí, es un monolito. Sí, hay que refactorizarlo en algún momento. Antes de tocar la arquitectura leé el porqué, más abajo.

---

## 1. CONTEXTO DEL NEGOCIO

### Qué es Maitén

Marca argentina de cosmética natural para mascotas. Fundada en 2024. Vende:

- **Shampoo Aloe Vera y Rosa Mosqueta** (250ml) — código MAI-SH-AR-250.
- **Crema Reparadora de Caléndula** (60g) — código MAI-CR-CAL-060.
- Hay más productos en camino (vi "Aceite de Caléndula" en el packaging que me pasaron, no está cargado todavía).

### Cómo venden hoy

- **Tienda online:** ya tienen Tiendanube andando.
- **Veterinarias en consignación:** dejan producto, la vet cobra cuando vende, después le pagan.
- **Peluquerías caninas:** venta directa.
- **Influencers del rubro pet care:** canjes por posteos.
- **Presentaciones a veterinarias:** muestras gratis.
- **Público final:** venta mostrador ocasional.

### Quién maneja el negocio

- **Nati:** dueña operativa.
- **Otras 3 socias:** roles a definir.
- Yo (Lautaro) los conozco personalmente, actúo como intermediario del proyecto tecnológico.

### Qué NO cubre Tiendanube y por eso necesitan sistema propio

- Consignaciones con seguimiento de vencimiento.
- Tipos de salida diferenciados (canje, presentación, regalo, rotura).
- Canal mayorista B2B con cuentas corrientes.
- Costos, márgenes y rentabilidad real por producto.
- Producción / órdenes de fabricación.
- Reportes económicos internos.

---

## 2. HISTORIA DEL PROYECTO (para que no te caiga de nuevo)

Este sistema **no lo empezamos desde cero**. Es una adaptación de otro sistema mío del **Club Los Cedros** (rugby/hockey). Eso te va a explicar varias cosas raras que vas a encontrar en el código:

- Variables con nombres de rugby que quedaron.
- Módulos ocultos del sidebar pero con código intacto (Plantel, CRM, Relación Club, CC Vendedores, Vendedores).
- Comentarios en el HTML tipo `<!-- <button data-p="plantel" ...> -->`.
- Emojis de placeholder que originalmente eran remeras.

**Decisión consciente:** ocultamos, no borramos. El código queda por si mañana Maitén decide activar alguno de esos módulos. Cuando estemos seguros de que ninguno se reactiva, hacemos limpieza física.

### Cómo trabajé hasta ahora

Con **Claude Code** (agente de coding en la terminal, herramienta de Anthropic). El flujo era:

1. Yo definía qué cambio quería y por qué.
2. Claude Code proponía un diff.
3. Yo aprobaba antes de aplicar.
4. Verificación en el navegador.
5. Siguiente cambio.

Fue muy iterativo, con muchos micro-commits mentales. **No usamos git**, cosa que hay que arreglar como prioridad cero cuando vos entres.

---

## 3. STACK Y ARQUITECTURA ACTUAL

### Tecnologías

- **Frontend:** HTML5 + CSS + JavaScript vanilla, todo en un solo archivo (`maiten.html`, ~386KB, ~7000 líneas). Todo inline: HTML + `<style>` + `<script>`.
- **Backend:** [Supabase](https://supabase.com) (PostgreSQL + REST API auto-generada + Auth + Realtime).
- **Charts:** Chart.js v4.4.0 vía CDN.
- **Sin build tools, sin bundler, sin framework.** Se abre el HTML en el navegador y funciona.
- **Sin autenticación real** por ahora: usuarios hardcodeados en el JS del HTML (esto hay que cambiar antes de producción).

### Por qué monolítico

**No es por vagancia.** Es por velocidad de iteración con Claude Code y por evitar toolchain para las socias, que no son técnicas. Pros y contras:

**Pros:**
- Un solo archivo, se puede hostear en cualquier lado.
- No hay build, no hay dependencias que instalar.
- Fácil de darle a alguien y que lo abra: doble clic y adentro.

**Contras (los conozco):**
- Difícil de mantener a partir de cierto tamaño.
- Difícil hacer diff limpio en git.
- Difícil trabajar en paralelo (dos personas tocando el mismo archivo = conflictos).
- Todos los módulos comparten el mismo scope de JS.

**Cuándo modularizar:** cuando sumemos más de un dev al proyecto, o cuando el HTML supere las 10000 líneas. Por ahora está en el límite tolerable.

### Estructura del código dentro del HTML

Es un solo archivo pero tiene "regiones" claras:

1. **`<head>` con `<style>`:** ~800 líneas de CSS. Usa CSS variables para toda la paleta (`--az`, `--bg`, `--vd`, etc.).
2. **`<body>` con la estructura de páginas:** cada módulo es un `<div id="pag-XXX">` que se muestra/oculta según el módulo activo.
3. **`<script>` al final:** ~6000 líneas de JavaScript. Incluye:
   - Constantes de conexión a Supabase.
   - Función `dD()` que devuelve el estado inicial de datos.
   - Función `gD()` que carga estado desde localStorage o Supabase.
   - Función `sD()` que guarda estado en localStorage y Supabase.
   - Handlers de cada módulo (`rProds`, `rClis`, `rVtas`, etc.).
   - Un componente propio de "smart table" con sort, filtro, agrupación.
   - Sistema de sincronización con cola offline (`processSyncQueue`).

### Persistencia: cómo funciona

Es un modelo **híbrido offline-first**:

1. Todo el estado del negocio vive en un objeto JS grande (llamémoslo `DB`).
2. Ese objeto se serializa a JSON y se guarda en:
   - `localStorage` (key `lc6`) — para uso offline.
   - Supabase (tabla `app_state`, fila con id `main`) — para persistencia real.
3. Al abrir la app, `gD()` intenta cargar de Supabase; si falla o no hay, cae a localStorage; si tampoco, corre `dD()` (datos iniciales de fábrica).
4. Al modificar algo, `sD()` guarda en ambos lados.

**Consecuencia importante:** la "base de datos" en Supabase es en realidad **un solo blob JSON** en una tabla de una fila. No hay tablas normalizadas por entidad (productos, clientes, etc.). Es una decisión heredada del prototipo del club, pero funciona para el volumen esperado.

**Esto es tema para discutir con vos:** ¿migrar a un modelo normalizado con tablas por entidad? Pros: queries reales, integridad referencial, reporting SQL. Contras: reescribir toda la capa de persistencia.

---

## 4. ESTRUCTURA DE MÓDULOS

### Módulos activos (visibles en sidebar)

**Ventas:**
- Inicio (dashboard con KPIs).
- Nueva venta.
- Tienda virtual (mini-catálogo interno para armar pedidos por WhatsApp o mostrador).

**Registros:**
- Productos (con variantes: hoy tenemos "variante dummy" por producto, ver punto 5 de decisiones).
- Clientes (con tipos: veterinaria, influencer, peluquería, particular, etc.).
- Proveedores.

**Finanzas:**
- Historial ventas.
- Historial compras.
- CC Clientes (cuenta corriente).
- CC Proveedores.
- Módulo contable (asientos con partida doble).
- Estadísticas + IA (usa la API de Anthropic para análisis, ver punto de "modelo desactualizado" en Fase 1.5).

**Compras:**
- Stock seguridad.
- Demanda insatisfecha.
- Cotizaciones.
- Órdenes de compra.

**Configuración:**
- Métodos de pago.
- Planes de cuotas.
- Plan de cuentas contables.
- Gastos.
- Rubros de producto.
- Lista de precios.
- Seguridad (usuarios y roles).

### Módulos ocultos (código intacto)

- Plantel (jugadores del club).
- CRM Potenciales.
- Relación Club.
- CC Vendedores.
- Vendedores.

---

## 5. DECISIONES CLAVE (con su porqué)

Federico, esto es lo más importante que puedes leer. Si algo te da ganas de refactorizar, primero vení con la pregunta.

### Decisión 1 — Monolito HTML

Ya explicado en sección 3. Resumen: por velocidad y para evitar toolchain. Refactorizar cuando pase de 10k líneas o cuando entren más devs al proyecto.

### Decisión 2 — Blob JSON en Supabase, no tablas normalizadas

También explicado. Es lo que heredamos. Es decisión abierta a repensar con vos.

### Decisión 3 — Variantes dummy en productos

El sistema del club manejaba productos con variantes (talles: XS, S, M, L / colores: azul, blanco, negro). Maitén hoy tiene productos únicos sin variantes reales. Como el sistema requiere al menos una variante por producto, cada producto Maitén tiene **una variante dummy única** que representa el producto en sí.

**Deuda pendiente:** rediseñar el modelo de variantes para que represente "presentación" (250ml, 500ml, 1L) y/o "fragancia" (neutra, lavanda, etc.). Es Fase 2.

### Decisión 4 — Rubros mínimos y coherentes con Maitén

Definimos dos rubros: **Capilar** y **Corporal**. Son los que aplican a Maitén (shampoo = capilar, crema = corporal). Escala bien si mañana suman jabón, óleo, colonia.

Todas las referencias hardcodeadas a "Rugby / Hockey / Extras" (los rubros del club) fueron reemplazadas, con algunas excepciones que quedaron como PENDIENTES (form de proveedores, edición de rubros).

### Decisión 5 — CC Clientes y CC Proveedores mantenidas, CC Vendedores eliminada

Nati y las socias no son vendedoras a comisión, entonces CC Vendedores no aplica. Pero **sí necesitan CC Clientes** (cuando una veterinaria vende de su consignación, le debe a Maitén hasta que paga) **y CC Proveedores** (compran materia prima a 30 días a proveedores).

### Decisión 6 — Plan de cuentas adaptado

Renombramos "Ventas" a "Ventas - Maitén" y agregamos como resultados negativos "Materia prima" y "Packaging" (los dos rubros principales de costos en cosmética natural). Sacamos "Deuda con el Club" y "Comisiones vendedores".

El resto del plan de cuentas es genérico y aplica a cualquier negocio.

### Decisión 7 — Login sin autenticación real

Los usuarios están **hardcodeados en el JS** del HTML. Hoy hay uno: `admin / maiten2026`. Antes de producción hay que migrar a **Supabase Auth** con email + password real. Es prioridad alta.

### Decisión 8 — RLS de Supabase permisivo por ahora

La tabla `app_state` tiene RLS activo pero con una policy que permite todo con la publishable key. Es aceptable para prototipo pero **inseguro para producción**. Cuando migremos a Supabase Auth, hay que definir policies por usuario.

### Decisión 9 — Consignaciones como tipo de movimiento, no como módulo aparte

En Fase 1 la consignación se maneja como un tipo más en el selector de "Nueva venta" (resta stock, no cobra). En Fase 2 vamos a construir un módulo aparte de "Consignaciones" con vencimiento, alerta de devolución, estado (pendiente/vendido/devuelto).

### Decisión 10 — Marca y paleta oficiales aplicadas

La socia me pasó el brand book completo. Colores:

- `#7A8B5C` — verde oliva (primario)
- `#5D6E47` — verde oliva oscuro (destacados)
- `#E8A87C` — naranja coral (secundario)
- `#F5F0E8` — crema (fondo suave)

Los logos están en la carpeta del proyecto: `logo-maiten-login.png`, `logo-maiten-topbar.png`, más otras variantes.

---

## 6. LO QUE FALTA

El backlog vivo está en `PENDIENTES.md`. Resumo acá los grandes items para que tengas la foto rápida.

### Fase 1.5 — Ajustes menores (2-3 días de laburo)

Cosas cosméticas o pequeños bugs. No bloquean uso pero conviene resolver antes de mostrar a clientes.

- Error "Cannot read properties of undefined (reading 'filter')" en columna Origen de Rubros.
- Placeholder "Rugby/Hockey/Extras" en form de proveedores (línea 1632).
- Al editar un rubro, el select de "deporte" muestra Rugby/Hockey/Ambos/Ninguno (línea 6533).
- Fondo celeste `#E8EEF8` del `.timg` (CSS línea 112) desentona con la paleta Maitén.
- Inconsistencia login: Enter en password no dispara sync con Supabase, botón "Ingresar" sí (línea 1406).
- Modelo de IA del agente en línea 2589 está usando `claude-sonnet-4-20250514` que fue discontinuado. Migrar a `claude-sonnet-4-6` o `claude-haiku-4-5-20251001`.
- Revisar hardcodes azulados sueltos (`#F0F4FC`, `#EEF2FA`, `#F5F8FF`, `#F8FAFD`) que quedaron del club.
- Talles/colores del club (XS, S, M... / Azul, Blanco, Negro) siguen en `abrirVars()`. Bloqueado el modal por ahora.
- Fotos de producto: el sistema ya lee `p.foto` pero no hay UI para subirla. Agregar input en form de `abrirProd()`.
- Pedirle a Nati fotos cuadradas 400x400 de los productos para cuando la UI esté lista.

### Fase 2 — Funcionalidad Maitén (esto es el corazón)

Lo que diferencia el sistema del club de un sistema Maitén.

- **8 tipos de movimiento en Nueva venta:** Ingreso, Venta, Consignación, Canje, Presentación, Regalo, Rotura/Defectuoso, Devolución consignación. Con lógica condicional (algunos usan medio de pago, otros no; algunos van a CC, otros no).
- **Ficha de producto con KPI de stock grande** (inspirado en una planilla Excel que armamos): stock en gigante, cambia a rojo bajo mínimo, historial filtrado, resumen por tipo con %.
- **Reporte económico mensual** por producto con desglose por tipo de movimiento, meses de stock, % consumido.
- **Módulo de consignaciones con vencimiento y estado** (pendiente / vendido / devuelto). Al devolver genera automáticamente el movimiento de "Devolución consignación".
- **Rediseño del modelo de variantes** (presentación / fragancia en vez de talle / color).
- **Módulo de producción / órdenes de fabricación** (registro de lotes con insumos consumidos, alta automática de stock al completar).
- **Refactorización opcional:** rubros dinámicos leídos desde tabla en vez de hardcodeados en HTML.

### Fase 3 — Integraciones externas

- **Tiendanube API:** webhooks de nueva venta para sincronizar stock. Decidir si es unidireccional o bidireccional. Ellos ya tienen la tienda funcionando.
- **Facturación electrónica (AFIP):** integración con API de facturación.
- **Módulo de materia prima extendido:** insumos con códigos, stock y costos propios; al comprar suma stock y genera CC Proveedores; al producir descuenta proporcionalmente.
- **Marketplaces** (Mercado Libre): sólo si suman canales.

### Seguridad y producción (BLOQUEANTE antes de darle a Nati)

- Row Level Security con policies reales por usuario.
- Autenticación con Supabase Auth (eliminar usuarios hardcodeados en JS).
- Backup automático (Supabase lo hace, verificar plan y frecuencia).
- Logs de auditoría (quién cambió qué y cuándo).
- Roles con permisos granulares (Admin, Ventas, Solo lectura).

---

## 7. CÓMO ARRANCAR VOS

### Primero: prioridad cero

**Poné el proyecto en git.** No está versionado. Es lo primero. Recomiendo:

1. Crear repo privado en GitHub.
2. Commit inicial con el estado actual.
3. A partir de ahí, un branch por feature.

### Segundo: setear tu ambiente

1. Clonar el repo.
2. Abrir `maiten.html` en Chrome. Ya funciona.
3. Para desarrollo: usar Live Server de VS Code o similar, para que refresque automáticamente al guardar.

### Tercero: acceso a Supabase

Te doy acceso al proyecto de Supabase (`maiten-sistema`) como colaborador. Necesito tu email de Supabase.

Datos del proyecto:
- URL: `https://zcowjjrsjiuzrlphvzyx.supabase.co`
- Publishable key: `sb_publishable_fLVAMbB46yhNieTqsv8rvg_OHsBFCoQ`
- (La DB password la tengo yo, no la comparto acá; te la paso por canal seguro).

### Cuarto: elegí por dónde empezar

Mi sugerencia para primera semana:

1. Poner en git.
2. Barrido de Fase 1.5 (limpieza cosmética).
3. Empezar con el módulo de tipos de movimiento (es el más impactante para Nati).

---

## 8. CÓMO TRABAJAMOS JUNTOS

Propongo esta división:

- **Vos (Federico):** desarrollo. Código, arquitectura, decisiones técnicas.
- **Yo (Lautaro):** producto y validación. Diseño de flujos, decisiones UX, interacción con las socias, definición de qué construir.

**Ritmo sugerido:**

- Sync semanal (30-45 min) para revisar avance y prioridades.
- Yo te paso specs por escrito de lo que hay que construir; vos venís con dudas o alternativas.
- Cambios de arquitectura los charlamos antes de que los ejecutes.
- Vos tenés autonomía sobre calidad de código, tests, patrones. No me meto ahí.

**Herramientas de comunicación:**

- WhatsApp para cosas urgentes o cortas.
- Git como fuente de verdad del código.
- `PENDIENTES.md` como backlog compartido (que actualicemos entre los dos).

---

## 9. ARCHIVOS DEL PROYECTO

En la carpeta `maiten-sistema/`:

- `maiten.html` — el sistema.
- `maiten-BACKUP.html` — copia del original del club, por las dudas.
- `supabase_setup.sql` — script para recrear la tabla `app_state`.
- `logo-maiten-login.png` + variantes — assets de marca.
- `PENDIENTES.md` — backlog vivo (leelo).
- `ESTADO_22-04-2026.md` — documento de cierre de la última sesión de trabajo (opcional).
- Este mismo `HANDOFF_TECNICO.md` (o como lo llame Federico).

---

## 10. CUALQUIER DUDA

Preguntame lo que sea. No te trabes intentando entender por qué algo está hecho así, si no está en este documento probablemente sea una decisión sin fundamento o algo que quedó del club y no revisamos.

Y una vez que estés adentro del código, si ves algo que te parece mal, decímelo. Yo no soy programador (mi última experiencia técnica seria fue con Clipper en los 90s, así que estoy oxidado). Confío en tu criterio para lo técnico.

Bienvenido al proyecto.

— Lautaro
