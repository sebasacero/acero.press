import { useCallback, useMemo, useReducer } from 'react';
import { resolveElements } from './cardLayout.js';
import { initialLook, lookReducer } from './cardModel.js';

/**
 * Diseño de la tarjeta para la sección activa: capas (predeterminado → diseño
 * del modelo → cambios del usuario), textos y deshacer. `act` le pone a cada
 * acción la sección y el diseño base, para que el reductor guarde solo lo que
 * difiere de él.
 */
export function useCardLook({ kind, preset, onPhoto, hasCobrand, saved }) {
  const [state, dispatch] = useReducer(lookReducer, saved, initialLook);
  const presetLayout = preset?.layout ?? null;
  const base = useMemo(() => resolveElements([presetLayout], { onPhoto, hasCobrand }), [presetLayout, onPhoto, hasCobrand]);
  const userLayer = state.overrides[kind];
  const elements = useMemo(
    () => resolveElements([presetLayout, userLayer], { onPhoto, hasCobrand }),
    [presetLayout, userLayer, onPhoto, hasCobrand]
  );
  const act = useCallback((a) => dispatch({ kind, base, ...a }), [kind, base]);
  return {
    elements, base, overrides: state.overrides, texts: state.texts,
    act, canUndo: state.undo.length > 0, undo: () => dispatch({ type: 'undo' }),
  };
}
