// Dirección de las funciones del sitio (/api/...). En el navegador es relativa;
// la app instalada (Capacitor) no tiene ese origen y llama al sitio público.
let base = '';

export const setApiBase = (url) => { base = String(url || '').replace(/\/+$/, ''); };
export const apiUrl = (path) => base + path;
