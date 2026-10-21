# ACERO.press

Café de especialidad en Bogotá, hecho alrededor de la AeroPress. Una sola base de código con tres cosas:

1. **El sitio público** (`/`): tienda de café y equipo AeroPress, carrusel de bebidas de la barra, archivo de recetas campeonas del World AeroPress Championship con barista IA, y la presentación de la app Micra.
2. **El panel de admin** (`/admin`, y flotando sobre el sitio para el owner): pedidos, mesas, inventario, catálogo, secciones del sitio, Instagram, publicaciones, agente de crecimiento, algoritmo/BI y tinteros.
3. **Micra**: la herramienta de barra dentro del panel. Cámara y editor táctil que convierte una preparación en una tarjeta para redes, registra la venta y la publica. También es el nombre de la app futura que anuncia el sitio (lista de espera).

Datos reales hoy (oct. 2026): 13 productos, 31 presentaciones, 8 pedidos, 4 clientes, 1 admin. Es un negocio arrancando: cada decisión de diseño debe sobrevivir a un cajero con prisa y a un celular con mala red.

## Stack
- React 18 + Vite, CSS plano (sin frameworks). Un solo bundle hoy; `main.jsx` monta `AdminApp` en `/admin` y `App` en el resto.
- Supabase: Postgres con RLS, auth con Google, storage (`marketing`), Edge Functions (`supabase/functions/`: Instagram y publicación).
- Vercel: funciones JS en `api/*.js` (pagos Stripe/Wompi, webhooks, barista y agente con Claude) y la API de Acero en FastAPI (`api/v1.py`, `api/_acero/`: pulso de mercado y BI).
- Idiomas: es/en/ja en `src/features/i18n/translations.js`. Español es el idioma fuente.

## Mapa
- `src/App.jsx`: orden de las secciones del inicio. `src/features/<área>/` por funcionalidad; `src/shared/lib/` clientes y lógica compartida; `src/shared/layout/` navbar, drawer, footer.
- `src/features/esspresale/`: la portada de la app Micra (el nombre viejo quedó en carpetas, enum `order_source='esspresale'` y ruta de storage `esspresale/`; no lo cambies sin migrar datos).
- `src/features/admin/`: `AdminShell.jsx` + `adminTools.js` (lista de herramientas), `pages/*`, y `micra/` (`MicraStudio.jsx` orquesta; `useSale.js` venta; `useCardOutput.js` salida; `cardModel.js`/`cardLayout.js`/`captions.js` lógica pura con tests; `espresaleCard.js` dibuja la tarjeta).
- `src/shared/lib/instagram.js`: escritura de ventas de Micra (RPC) y publicación.
- Mapas: la portada usa el mapa ilustrado (`esspresale/bogotaMap.js`, canvas, sin servicio externo). La página Piloto usa MapLibre con teselas de OpenFreeMap (sin clave; cae a OpenStreetMap si no responde), cargado con import dinámico (`shared/lib/maplibre.js`): no lo importes desde el sitio público. `shared/lib/bogotaGeo.js` convierte (carrera, calle) en GPS con una o dos cuadras de margen en Chapinero y el norte; `shared/lib/mapTheme.js` viste las capas del estilo base con la paleta de la app (Plano, Noche) sin cambiar de teselas.
- `supabase/migrations/`: SOLO lo creado desde que el repo tiene migraciones (Instagram, pairings, waitlist, tinteros, venta atómica). Las tablas base (`orders`, `order_items`, `inventory`, `inventory_movements`, `products`, `product_variants`, `customers`, `publications`, `app_config`, `page_sections`, `admin_users`, `is_admin()`, `get_sales_counts()`, `compute_growth_metrics()`, sus RLS) se crearon a mano en el dashboard y no están en el repo. Antes de escribir SQL, consulta el esquema real; `supabase/tests/micra_atomic_sale/schema.sql` es una réplica parcial para pruebas, no la fuente.
- `e2e/`: Playwright. Simulador de Supabase y helpers en `e2e/micra/fixtures.js`; úsalo también para secciones nuevas.

## Comandos
- `npm run dev` · `npm run build` · `npm run api` (FastAPI en :8000; necesita `uvicorn`, no está en `requirements.txt`).
- `npm test`: unitarias (`node --test`) de los módulos puros. El glob es fijo (`admin/micra` y `home/sections`): si agregas un `*.test.js` en otra carpeta, amplía el script.
- `npm run e2e`: navegador con Supabase simulado; nunca toca la base real. Chromium viene con `@playwright/test`; `PW_CHROMIUM` apunta a uno propio.
- `npm run shot -- <ruta> <salida.png> [--desk] [--session] [--street=e2e/data/street.json] [--click=sel] [--full]`: captura con el mismo simulador, para mirar un cambio visual antes de probarlo entero. Mira la captura con el lector de imágenes; no la subas a git.
- `npm run test:sql`: funciones SQL de venta contra un Postgres local desechable (variables `PG*`; se niega a correr contra Supabase).
- No hay CI, lint ni formateador: lo que no corras tú no lo corre nadie.

Antes de dar algo por terminado: `npm test`, `npm run build` (sin avisos nuevos de tamaño) y `npm run e2e`; `npm run test:sql` si cambió SQL. Si lo probado depende de Safari/iOS (cámara, video, scroll), dilo: aquí solo hay Chromium.

## Convenciones
- Textos de interfaz, comentarios y mensajes de error en español. Commits y PRs en inglés. Comentarios cortos que dicen el porqué.
- Lógica que se pueda probar sin React va en un módulo puro con su `*.test.js` al lado (como `cardLayout.js`, `pressStory.js`).
- Migraciones: un archivo nuevo `AAAAMMDDhhmmss_nombre.sql`, idempotente (`if not exists`, `create or replace`), con `set lock_timeout` si altera tablas vivas. Funciones que tocan dinero o stock: `security invoker`, verifican `is_admin()`, `revoke ... from anon`.
- Escrituras que tocan `orders`, `inventory` o dinero van en UNA función SQL transaccional (modelo: `micra_record_sale`), nunca en varias llamadas sueltas desde el navegador ni leyendo el stock y volviéndolo a escribir.
- Precios y totales se calculan en la base o en el servidor a partir de `product_variants`; lo que manda el navegador es `variant_id` y `qty`.
- e2e: espera con `expect.poll`/locators, no con `waitForTimeout`; los selectores por rol o `data-testid` cuando los toques.
- Una variable de entorno nueva se documenta en `SETUP.md` en el mismo cambio.
- Medios en `public/image/`; nada por encima de ~1 MB sin comprimir y sin una razón escrita en el commit. La carpeta `image/` de la raíz es legado (solo se usa su favicon).

## Reglas
- Nunca pedir ni pegar secretos en el chat (claves, tokens, `.env`).
- DDL en Supabase solo con aprobación explícita del usuario: se entrega el SQL y se aplica cuando lo autorice. Consultas de solo lectura sí, siempre.
- `reports/` y `research_notes/` no van a git (hoy solo están en `.git/info/exclude`; si clonas de nuevo, vuelve a excluirlos o pásalos a `.gitignore`).
- Sin identificadores de modelo en commits, PRs ni código.
- Pull requests solo cuando el usuario lo pide; «merge» autoriza crear y fusionar (squash).

## Invariantes (lo que no se puede romper)
Venta de Micra, protegidas por SQL, unitarias y e2e:
- Una venta se registra en una sola transacción (`micra_record_sale`); los precios salen de la base.
- El mismo ticket reintentado (misma `client_ref`, 2 min) devuelve el pedido existente: nunca se cobra dos veces.
- El inventario no baja de 0; la suma de `inventory_movements` de un pedido es lo que de verdad cambió el inventario.
- «Deshacer» devuelve exactamente lo descontado y una sola vez (`micra_void_sale`).
- Una venta no se pega a otra tarjeta; una tarjeta publicada no le pasa su venta a la siguiente; se publica una vez a la vez.

Las mismas invariantes aplican a pedidos web, mesas, webhooks de pago e inventario manual, pero AHÍ TODAVÍA NO SE CUMPLEN (ver «Deuda conocida»). No agregues más escrituras por ese camino: pásalas al patrón de Micra.

## Deuda conocida (oct. 2026)
Para no redescubrirla. Ordenada por riesgo:
1. **Pagos confían en el navegador**: `api/create-checkout-session.js` y `api/create-local-payment.js` cobran el monto que llega en el body; los webhooks no comparan lo pagado con `orders.total` ni actualizan con condición de estado. Wompi busca el pedido por `transaction.id`, que se guarda después de responder (carrera).
2. **`orders` acepta inserts anónimos sin restricción** (`with check (true)`, sin check de `status`/`total`): el contador público, el BI y el agente se pueden inflar desde fuera.
3. **Stock read-then-write sin bloqueo** en `OrdersPage`, `TablesPage`, `InventoryPage`, `stripe-webhook`, `wompi-webhook`. Mesas: la cuenta se crea como `orders.status='pending'`, Pedidos la puede «confirmar» y al cerrar la mesa se descuenta otra vez.
4. **`/api/barista` es público y cuesta dinero** por llamada; el límite por IP vive en memoria de la instancia.
5. **Todo el admin viaja al público** (`main.jsx` importa `AdminApp` sin `lazy`; `SectionEditButton` arrastra `admin.css`): bundle de ~830 kB.
6. `instagram.js` conserva el camino no atómico (`atomicMissing`) aunque la migración ya está aplicada; `useCardOutput` sube dos veces si se guarda y luego se publica.
7. Cualquier rol de `admin_users` ve todo el panel (Configuración, token de Instagram); `ADMIN_TOOLS` no tiene roles.
8. Legado sin uso: `CSS/`, `JS/`, `image/` (11 MB duplicados), `README.md` describe el sitio HTML anterior, `og:image` apunta a un archivo que no existe.
