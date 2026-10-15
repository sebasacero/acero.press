import { createContext, useContext, useState, useCallback } from 'react';

const AdminUIContext = createContext(null);
const EDIT_MODE_KEY = 'acero_edit_mode';

function readEditMode() {
  try {
    return localStorage.getItem(EDIT_MODE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function AdminUIProvider({ children }) {
  const [activeTool, setActiveTool] = useState(null); // null = cerrado
  // Modo edición: muestra u oculta los lápices sobre el sitio en vivo, para
  // que puedas ver la página tal como la ve un cliente sin cerrar sesión.
  const [editMode, setEditModeState] = useState(readEditMode);

  const openTool = useCallback((id) => setActiveTool(id), []);
  const close = useCallback(() => setActiveTool(null), []);
  const setEditMode = useCallback((on) => {
    setEditModeState(on);
    try {
      localStorage.setItem(EDIT_MODE_KEY, on ? 'on' : 'off');
    } catch {
      /* sin almacenamiento: solo dura esta visita */
    }
  }, []);

  const value = { activeTool, openTool, close, isOpen: !!activeTool, editMode, setEditMode };
  return <AdminUIContext.Provider value={value}>{children}</AdminUIContext.Provider>;
}

export function useAdminUI() {
  const ctx = useContext(AdminUIContext);
  if (!ctx) throw new Error('useAdminUI debe usarse dentro de <AdminUIProvider>');
  return ctx;
}
