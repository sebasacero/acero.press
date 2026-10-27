// Lógica pura de los enlaces que abren la app instalada (sin Capacitor, para
// probarla con node --test). El esquema propio vuelve del inicio de sesión con
// Google; Supabase tiene que tener AUTH_REDIRECT en su lista de Redirect URLs.

export const APP_SCHEME = 'com.aceropress.micra';
export const AUTH_REDIRECT = `${APP_SCHEME}://auth`;

/**
 * ¿Qué trae un enlace de vuelta del inicio de sesión?
 * { code } (PKCE), { access_token, refresh_token } (implícito), { error } o null si no es de auth.
 */
export function authFromUrl(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== `${APP_SCHEME}:` || u.host !== 'auth') return null;
  const q = u.searchParams;
  const h = new URLSearchParams(u.hash.replace(/^#/, ''));
  const error = q.get('error_description') || h.get('error_description') || q.get('error') || h.get('error');
  if (error) return { error };
  if (q.get('code')) return { code: q.get('code') };
  if (h.get('access_token') && h.get('refresh_token')) return { access_token: h.get('access_token'), refresh_token: h.get('refresh_token') };
  return { error: 'El inicio de sesión no devolvió una sesión.' };
}

/**
 * La ruta de Micra a la que lleva un enlace al sitio (el del barista en su termo,
 * el código del equipo) o null si no es de Micra: https://www.aceropress.com/micra/b/<id> → /micra/b/<id>.
 */
export function micraPathFromUrl(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.protocol === `${APP_SCHEME}:` ? 'app' : u.hostname.replace(/^www\./, '');
  if (host !== 'aceropress.com' && host !== 'app') return null;
  const path = host === 'app' ? `/${u.host}${u.pathname}`.replace(/\/+$/, '') : u.pathname.replace(/\/+$/, '');
  if (!/^\/micra(\/|$)/.test(path)) return null;
  return path + u.search;
}

/** Al arrancar, la app vive en /micra: lo demás (/, /index.html) se lleva allí. */
export const startPath = (pathname) => (/^\/micra(\/|$)/.test(pathname || '') ? pathname : '/micra');
