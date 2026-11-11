// El botón del centro de la barra del cliente pide «Quiero un café» desde
// cualquier pestaña: si el inicio no está montado, se deja pendiente y el
// inicio lo toma al abrir.
let pending = false;
export function requestWant() {
  pending = true;
  window.dispatchEvent(new Event('micra:want'));
}
export function takeWant() {
  const p = pending;
  pending = false;
  return p;
}
