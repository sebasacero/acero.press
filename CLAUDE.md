# ACERO.press

Café de especialidad en Bogotá, hecho alrededor de la AeroPress. Una sola base de código con tres cosas:

1. **El sitio público** (`/`): la marca personal de ACERO.press (barismo con AeroPress). Portada en `src/App.jsx`, en este orden: `EsspresaleHero` (`#baristas`, los dos banners principales de la web en línea sobre la hoja de plano: «Pide café en AeroPress a domicilio» y «Vive del café con tu AeroPress», con pestañas; lleva el menú y el único `h1`; `/#baristas` y `/#tinteros` abren el segundo; debajo del iPhone (arriba en celular) los botones pequeños de App Store y Google Play, `esspresale/StoreButtons.jsx`, `app_config` `app_store_url`/`play_store_url`, sin enlace dicen «Pronto»; los títulos se pueden cambiar con el lápiz, `app_config` `essp_<banner>_*`), `MicraSection` (`#micra`, sobre blanco: la app, el celular con las cifras reales del estudio y debajo `SocialBanners` (`#publicaciones`: una ficha con video propio por red y el botón de la app)), la tienda (pestañas Café, AeroPress, Kit), `LocalHero` (`#visitanos`: el logo de Visítanos, el plano ilustrado acostado como piso con el pin parado en la Cra. 13 #85-32 (gradiente de colores de Google Maps: la única excepción al rojo único, pedida por el usuario) y el nombre en Archivo y Permanent Marker, abre Google Maps; junto a `#recetas`: la foto de la barra que tuvimos en Chapinero, `public/image/local.webp`, enmarcada, con el banner original de la barra (video, título con el logo, cuadro oscuro de la receta y botón crema) dentro del vidrio de la vitrina, la foto completa también en celular; contenido en `page_sections` `cold_brew`, lápiz `ColdBrewCarouselEditor`), `BrewGuide` (`#escuela`: la hoja de instrucciones oficial de AeroPress Go, diez pasos con dibujos a trazo en `brewDrawings.jsx`, caliente y cold brew, contada con el scroll: el panel queda fijo (sticky, por eso `overflow: clip`) y `home/lib/scrolly.js` elige el paso; los puntos saltan a cada paso y un aviso de «desliza» rebota en el primero) y el archivo de recetas campeonas del WAC con barista IA (foto oficial de cada campeón enlazada del WAC, grande en el banner y con sus iniciales si no carga, y, en 10 de 17 años, un video con botón ▶ que abre YouTube sin cookies o Vimeo solo al tocarlo: `recipes/data/champions.js`), antes del pie. Sin meta de ventas flotante ni feed de Instagram en la portada. Todo en `src/features/home/` (lógica pura en `home/lib/` con tests). En lo público se dice «barista», nunca «tintero» (el código y las tablas siguen con `tintero`). Ningún aliado (p. ej. un tostador) se nombra en público antes de que exista el acuerdo.
2. **El panel de admin** (`/admin`, y flotando sobre el sitio para el owner): pedidos, mesas, inventario, catálogo, secciones del sitio, Instagram, publicaciones, agente de crecimiento, algoritmo/BI y tinteros.
3. **Micra**: la herramienta de barra dentro del panel. Cámara y editor táctil que convierte una preparación en una tarjeta para redes, registra la venta y la publica. También es el nombre de la app futura que anuncia el sitio (lista de espera).

Datos reales hoy (oct. 2026): 13 productos, 31 presentaciones, 8 pedidos, 4 clientes, 1 admin. Es un negocio arrancando: cada decisión de diseño debe sobrevivir a un cajero con prisa y a un celular con mala red.

## Stack
- React 18 + Vite, CSS plano (sin frameworks). Un solo bundle hoy; `main.jsx` monta `AdminApp` en `/admin` y `App` en el resto.
- Supabase: Postgres con RLS, auth con Google, storage (`marketing`), Edge Functions (`supabase/functions/`: Instagram y publicación).
- Vercel: funciones JS en `api/*.js` (pagos Stripe/Wompi, webhooks, barista y agente con Claude) y la API de Acero en FastAPI (`api/v1.py`, `api/_acero/`: pulso de mercado y BI).
- Idiomas: es/en/ja en `src/features/i18n/translations.js`. Español es el idioma fuente.

## Mapa
- `src/App.jsx`: orden de las secciones del inicio. `src/features/<área>/` por funcionalidad; `src/shared/lib/` clientes y lógica compartida; `src/shared/layout/` navbar, drawer, footer: los enlaces del menú (arriba y de tres rayas) salen de una sola lista, `navLinks.js` (en la portada el menú pasa a tres rayas por debajo de 1100 px de ancho: con seis enlaces cabe justo hacia 940 y con otra letra se partía bajo el logo), y llegar a `/#sección` desde otra página lo resuelve `useHashLanding` (el navegador busca la sección antes de que React la pinte y se queda arriba).
- `src/features/esspresale/`: piezas de Micra que usa la portada (el celular con el mapa, `parts.jsx`, el mapa ilustrado) (el nombre viejo quedó en carpetas, enum `order_source='esspresale'` y ruta de storage `esspresale/`; no lo cambies sin migrar datos).
- `src/features/admin/`: `AdminShell.jsx` + `adminTools.js` (lista de herramientas), `pages/*`, y `micra/` (`MicraStudio.jsx` orquesta; `useSale.js` venta; `useCardOutput.js` salida; `cardModel.js`/`cardLayout.js`/`captions.js` lógica pura con tests; `espresaleCard.js` dibuja la tarjeta).
- `src/shared/lib/instagram.js`: escritura de ventas de Micra (RPC) y publicación.
- Estudio de calle (MVP con datos reales; en el panel se llama «Estudio», el código aún dice `piloto`): las fichas y encuestas se levantan en la calle con «Tintero» en Micra (ficha → encuesta → tarjeta), con el punto de GPS del celular (`micra/gps.js`) y una referencia; la cuadra es opcional. Estudio solo muestra y completa lo pendiente. `src/features/admin/survey/` (encuesta del tintero: `survey.js` puro con tests, `SurveyForm`, `SurveyDialog`; se llena en Micra después de la ficha o desde Piloto) y `src/features/admin/piloto/` (`pilotReport.js` puro con tests arma el informe: medianas con su n, precio techo por kilo, cuenta del distribuidor, grupos de 5 para género/edad; `PilotReport` es la pestaña Informe imprimible y `PilotDeck` la presentación a pantalla completa, cargados aparte).
- Mi ruta (`/ruta`, `src/features/ruta/`): la app del tintero, cargada aparte desde `main.jsx`. Entra con Google, enlaza su cuenta con un código que genera el equipo en Piloto, acepta compartir su ubicación (Ley 1581) y registra recorridos con el GPS del celular (`useTracker.js`: puntos en `localStorage` primero, lotes a `tintero_route_add_points`). `track.js` puro con tests: filtro de lecturas, paradas, GPS → cuadra, trazo simplificado. Todo pasa por funciones SQL (`20261023120000_tintero_routes.sql`); el tintero solo ve y escribe lo suyo. Límite de la web: con la pantalla apagada no hay GPS.
- `src/features/school/`: la Escuela (seis lecciones para empezar como barista con AeroPress). Tiene su página, `/escuela` (`SchoolPage`: temario en pestañas con teclado en computador, acordeón en celular; `#leccion-3` abre esa lección), y en la portada solo `BrewGuide` (`#escuela`). La receta base de la Escuela es la oficial de AeroPress Original (aeropress.com: 16–18 g, molienda media, 85 °C, hasta el n.º 4, 3 s, 1 min); la portada muestra la hoja de AeroPress Go (80 °C, hasta el ③, 10 s), que es otra prensa. Contenido en `lessons.js` (es/en/ja, con la figura de cada lección); lógica pura en `school.js` con tests; `CookMode` es el cronómetro a pantalla completa (Wake Lock). Lo visto se guarda solo en el navegador. La vista previa de WhatsApp de `/escuela` sale de `dist/escuela.html`, que el build copia de `index.html` cambiando título y `og:` (`vite.config.js`; si cambias esas etiquetas en `index.html`, el build avisa) y `vercel.json` sirve en `/escuela`.
- Mapas: el celular de Micra en la portada usa el mapa ilustrado (`esspresale/bogotaMap.js`, canvas, sin servicio externo). La página Piloto usa MapLibre con teselas de OpenFreeMap (sin clave; cae a OpenStreetMap si no responde), cargado con import dinámico (`shared/lib/maplibre.js`): no lo importes desde el sitio público. `shared/lib/bogotaGeo.js` convierte (carrera, calle) en GPS con una o dos cuadras de margen en Chapinero y el norte; `shared/lib/mapTheme.js` viste las capas del estilo base con la paleta de la app (Plano, Noche) sin cambiar de teselas.
- `supabase/migrations/`: SOLO lo creado desde que el repo tiene migraciones (Instagram, pairings, waitlist, tinteros, venta atómica, estudio de calle, encuestas y escenario). Las tablas base (`orders`, `order_items`, `inventory`, `inventory_movements`, `products`, `product_variants`, `customers`, `publications`, `app_config`, `page_sections`, `admin_users`, `is_admin()`, `get_sales_counts()`, `compute_growth_metrics()`, sus RLS) se crearon a mano en el dashboard y no están en el repo. Antes de escribir SQL, consulta el esquema real; `supabase/tests/micra_atomic_sale/schema.sql` es una réplica parcial para pruebas, no la fuente.
- Medición: Google Analytics 4 (`G-6F6S72KWWQ`) se carga en `index.html` solo en el sitio público, con Consent Mode (sin cookies hasta «Aceptar» en `ConsentBanner`) y sin contar al equipo (`markTeam` al entrar como admin). Los eventos pasan por `shared/lib/analytics.js` (`track`, `commerce`): `add_to_cart`, `begin_checkout`, `purchase`/`payment_pending`, `contact_whatsapp`, `school_lesson`, `school_lesson_done`, `school_timer`. De dónde llega la gente: enlaces con `utm_*`.
- `e2e/`: Playwright. Simulador de Supabase y helpers en `e2e/micra/fixtures.js`; úsalo también para secciones nuevas.

## Comandos
- `npm run dev` · `npm run build` · `npm run api` (FastAPI en :8000; necesita `uvicorn`, no está en `requirements.txt`).
- `npm test`: unitarias (`node --test`) de los módulos puros: todo `src/**/*.test.js`.
- `npm run e2e`: navegador con Supabase simulado; nunca toca la base real. Chromium viene con `@playwright/test`; `PW_CHROMIUM` apunta a uno propio (en la nube: `PW_CHROMIUM=/opt/pw-browsers/chromium`). No edites archivos mientras corre: Vite recarga la página y las pruebas fallan por eso.
- `npm run shot -- <ruta> <salida.png> [--desk] [--session] [--street=e2e/data/street.json] [--piloto=e2e/data/informe.json] [--click=sel] [--full]`: captura con el mismo simulador, para mirar un cambio visual antes de probarlo entero. Mira la captura con el lector de imágenes; no la subas a git.
- `npm run test:sql`: funciones SQL de venta contra un Postgres local desechable (variables `PG*`; se niega a correr contra Supabase).
- No hay CI, lint ni formateador: lo que no corras tú no lo corre nadie.

Antes de dar algo por terminado: `npm test`, `npm run build` (sin avisos nuevos de tamaño) y `npm run e2e`; `npm run test:sql` si cambió SQL. Si lo probado depende de Safari/iOS (cámara, video, scroll), dilo: aquí solo hay Chromium.

## Convenciones
- Textos de interfaz, comentarios y mensajes de error en español. Commits y PRs en inglés. Comentarios cortos que dicen el porqué.
- Lógica que se pueda probar sin React va en un módulo puro con su `*.test.js` al lado (como `cardLayout.js`, `home/lib/houseRecipes.js`).
- Migraciones: un archivo nuevo `AAAAMMDDhhmmss_nombre.sql`, idempotente (`if not exists`, `create or replace`), con `set lock_timeout` si altera tablas vivas. Funciones que tocan dinero o stock: `security invoker`, verifican `is_admin()`, `revoke ... from anon`.
- Escrituras que tocan `orders`, `inventory` o dinero van en UNA función SQL transaccional (modelo: `micra_record_sale`), nunca en varias llamadas sueltas desde el navegador ni leyendo el stock y volviéndolo a escribir.
- Precios y totales se calculan en la base o en el servidor a partir de `product_variants`; lo que manda el navegador es `variant_id` y `qty`.
- e2e: espera con `expect.poll`/locators, no con `waitForTimeout`; los selectores por rol o `data-testid` cuando los toques.
- Una variable de entorno nueva se documenta en `SETUP.md` en el mismo cambio.
- Diseño (auditoría del 26 oct 2026): un solo rojo, `var(--red)` (#DE1B1B, 4,9:1 con blanco; `--magenta` y `--yt` son alias); nada de rojos, morados o dorados sueltos. Letra: Archivo (títulos y lectura), JetBrains Mono (etiquetas y cifras), Permanent Marker (el subrayado a mano). Todo lo que se toca mide 44 × 44 px o más (bloque al final de `index.css`). Un solo `h1` por página.
- Medios en `public/image/`; nada por encima de ~1 MB sin comprimir y sin una razón escrita en el commit. La carpeta `image/` de la raíz es legado (solo se usa su favicon).

## Reglas
- Nunca pedir ni pegar secretos en el chat (claves, tokens, `.env`).
- `app_config` es de lectura pública: nada privado ahí. Los supuestos de la reunión (precio de distribuidor, costo del kit) van en `pilot_scenarios`, solo del equipo. Las encuestas exigen consentimiento en la base; nombres, notas y fotos nunca salen en el informe ni en la presentación.
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
8. Legado sin uso: `CSS/`, `JS/`, `image/` (11 MB duplicados), `README.md` describe el sitio HTML anterior. (`og:image` sí existe: `public/image/local.jpg`.)
