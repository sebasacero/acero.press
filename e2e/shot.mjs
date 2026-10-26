// Captura de pantalla con el Supabase simulado de las pruebas: para mirar un
// cambio visual sin montar nada a mano.
//
//   npm run shot -- / portada.png                 celular (390×844), como un visitante
//   npm run shot -- / portada.png --desk          computador (1440×900)
//   npm run shot -- / portada.png --width=1024    cualquier ancho (alto 900)
//   npm run shot -- /admin piloto.png --session   con sesión de owner
//   npm run shot -- / portada.png --street=e2e/data/street.json   datos del mapa
//   npm run shot -- / portada.png --click=".essp-tabs button >> nth=1" --wait=900
//
// Levanta Vite en el puerto de las pruebas si no está corriendo. Las capturas
// van a la carpeta que se indique (por defecto, la actual); nada se sube a git.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { PHONE, mockBackend, signIn, watchErrors } from './micra/fixtures.js';
import { BASE_URL } from '../playwright.config.js';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]; }));
const [path = '/', out = 'shot.png'] = args.filter((a) => !a.startsWith('--'));

const DESK = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const base = flags.width ? { viewport: { width: Number(flags.width), height: 900 }, deviceScaleFactor: 1 } : flags.desk ? DESK : PHONE;
const context = { ...base, locale: flags.locale || 'es-CO' };

async function serverUp() {
  try { await fetch(BASE_URL); return true; } catch { return false; }
}

let vite = null;
if (!(await serverUp())) {
  const port = new URL(BASE_URL).port;
  // En su propio grupo de procesos: al final se mata el grupo entero (npx y Vite)
  vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', port, '--strictPort'], {
    stdio: 'ignore', detached: true, env: { ...process.env, VITE_SUPABASE_URL: 'https://mock.supabase.co', VITE_SUPABASE_ANON_KEY: 'e2e' },
  });
  for (let i = 0; i < 60 && !(await serverUp()); i += 1) await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
try {
  // Como un visitante, salvo --session: entonces con la sesión de owner de las pruebas
  const page = await (await browser.newContext(context)).newPage();
  page.setDefaultTimeout(8000);
  const errors = watchErrors(page);
  const api = await mockBackend(page);
  if (flags.session) await signIn(page, { coach: true });
  if (flags.street) api.opts.streetMap = JSON.parse(readFileSync(flags.street, 'utf8'));
  if (flags.piloto) api.opts.piloto = JSON.parse(readFileSync(flags.piloto, 'utf8'));
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'load' });
  if (flags.click) await page.click(flags.click);
  await page.waitForTimeout(Number(flags.wait || 1200));
  await page.screenshot({ path: out, fullPage: !!flags.full });
  console.log(`${out} · ${context.viewport.width}×${context.viewport.height}${errors.length ? ` · ERRORES: ${errors.join(' | ')}` : ''}`);
  await page.context().close();
} finally {
  await browser.close();
  if (vite) { try { process.kill(-vite.pid); } catch { vite.kill(); } }
}
