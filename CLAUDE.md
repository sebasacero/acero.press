# ACERO.press

Tienda y café (Bogotá) con panel de admin y Micra (cámara/editor de tarjetas para redes + venta en barra).

## Stack
- React 18 + Vite, CSS plano (sin frameworks de CSS). Supabase (auth, Postgres con RLS, storage, Edge Functions). Vercel.
- `api/`: funciones de Vercel en JS (pagos, webhooks, agentes) y la API de Acero en FastAPI (`api/v1.py`, `api/_acero/`).
- `src/features/<área>/` por funcionalidad; `src/shared/lib/` para clientes y lógica compartida.
- Micra: `src/features/admin/micra/` (orquestador `MicraStudio.jsx`, ventas en `useSale.js`, escritura en `src/shared/lib/instagram.js`).

## Comandos
- `npm run dev` · `npm run build` · `npm run api` (FastAPI en :8000)
- `npm test`: pruebas unitarias (`node --test`) de los módulos puros de Micra.
- `npm run e2e`: pruebas de navegador (Playwright) en `e2e/`. Levanta Vite con un Supabase simulado; nunca toca la base real.
- `npm run test:sql`: funciones SQL de venta contra un Postgres local desechable (variables `PG*`; se niega a correr contra Supabase).
- Servidor de desarrollo con datos simulados (lo que usa `e2e`):
  `VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --host 127.0.0.1 --port 5174 --strictPort`

Antes de dar algo por terminado: `npm test`, `npm run build` y `npm run e2e` (y `npm run test:sql` si cambió SQL).

## Convenciones
- Textos de la interfaz y comentarios en español; comentarios cortos que dicen el porqué.
- Lógica pura en módulos sin React (`cardModel.js`, `cardLayout.js`, `captions.js`) con su `*.test.js` al lado.
- Cambios de base de datos: un archivo nuevo en `supabase/migrations/` (`AAAAMMDDhhmmss_nombre.sql`), idempotente (`if not exists`, `create or replace`). Las tablas base (orders, inventory…) no están en migraciones: consulta el esquema real antes de escribir SQL.
- Pruebas e2e: selectores y simulador en `e2e/micra/fixtures.js`; cada prueba nueva de Micra va ahí, no en scripts sueltos.

## Reglas
- Nunca pedir ni pegar secretos en el chat (claves, tokens, `.env`).
- DDL en Supabase solo con aprobación explícita del usuario: se entrega el SQL y el usuario lo aplica o lo autoriza. Consultas de solo lectura sí.
- `reports/` y `research_notes/` (investigación) no van a git.
- Sin identificadores de modelo en commits, PRs ni código.
- Pull requests solo cuando el usuario lo pide.

## Invariantes de venta (Micra)
- Una venta se registra en una sola transacción (`micra_record_sale`); los precios salen de la base, no del navegador.
- El mismo ticket reintentado (misma `client_ref`) devuelve el pedido existente: nunca se cobra dos veces.
- El inventario no baja de 0; la suma de `inventory_movements` de un pedido es lo que de verdad cambió el inventario.
- «Deshacer» devuelve exactamente lo descontado y una sola vez por pedido (`micra_void_sale`).
- Una venta no se pega a otra tarjeta; una tarjeta publicada no le pasa su venta a la siguiente; se publica una vez a la vez.
