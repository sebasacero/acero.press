// Celestra sin la migración (20261111200000_celestra.sql sin aplicar): el parte
// del día y lo que el dueño decide se guardan solo en este celular, para que no
// se pague dos veces el mismo parte y Celestra recuerde lo decidido.
// Puro: recibe el almacenamiento (localStorage o un objeto en las pruebas).

export const CELESTRA_KEY = 'micra_celestra_v1';
const MAX_DECISIONES = 20;

function read(storage) {
  try {
    const v = JSON.parse(storage?.getItem(CELESTRA_KEY) ?? 'null');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
function write(storage, v) {
  try { storage?.setItem(CELESTRA_KEY, JSON.stringify(v)); } catch { /* sin espacio o bloqueado: sigue sin guardar */ }
}

/** El estado con la misma forma que celestra_estado(), armado con lo del celular. */
export function localEstado(storage, today) {
  return shape(read(storage), today);
}
// Se arma desde lo que hay en memoria, no releyendo: si guardar falla, igual se ve
function shape(v, today) {
  const parte = v.parte?.day === today ? v.parte : null;
  return { hoy: today, gastado_mes: null, corridas_mes: null, parte, decisiones: Array.isArray(v.decisiones) ? v.decisiones : [], local: true };
}

/** Guarda el parte recién escrito; cada propuesta lleva un id local y queda pendiente. */
export function saveLocalParte(storage, today, parte) {
  const v = read(storage);
  v.parte = {
    day: today,
    resumen: parte.resumen,
    propuestas: (parte.propuestas ?? []).map((p, i) => ({ ...p, id: `${today}-${i + 1}`, pos: i + 1, estado: 'pendiente', nota: null })),
  };
  write(storage, v);
  return shape(v, today);
}

/** El dueño decide sobre una propuesta del parte de hoy; queda también en la memoria (las últimas 20). */
export function decideLocal(storage, today, id, estado, nota = null) {
  const v = read(storage);
  const p = v.parte?.day === today ? v.parte.propuestas?.find((x) => x.id === id) : null;
  if (!p) return localEstado(storage, today);
  p.estado = estado;
  p.nota = nota || null;
  const rest = (Array.isArray(v.decisiones) ? v.decisiones : []).filter((d) => d.id !== id);
  v.decisiones = [{ id, dia: today, titulo: p.titulo, estado, nota: p.nota }, ...rest].slice(0, MAX_DECISIONES);
  write(storage, v);
  return shape(v, today);
}
