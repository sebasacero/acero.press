// Una herramienta puede pedir confirmación antes de que el panel la cierre o
// navegue a otra (p. ej. Micra mientras prepara o publica un video). La
// herramienta registra una función que devuelve false para quedarse.
let guard = null;

export function setLeaveGuard(fn) {
  guard = fn;
}

/** true si se puede salir de la herramienta activa. */
export function canLeave() {
  try {
    return !guard || guard() !== false;
  } catch {
    return true;
  }
}
