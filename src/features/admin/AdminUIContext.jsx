import { createContext, useContext, useState, useCallback } from 'react';

const AdminUIContext = createContext(null);

export function AdminUIProvider({ children }) {
  const [activeTool, setActiveTool] = useState(null); // null = cerrado

  const openTool = useCallback((id) => setActiveTool(id), []);
  const close = useCallback(() => setActiveTool(null), []);

  const value = { activeTool, openTool, close, isOpen: !!activeTool };
  return <AdminUIContext.Provider value={value}>{children}</AdminUIContext.Provider>;
}

export function useAdminUI() {
  const ctx = useContext(AdminUIContext);
  if (!ctx) throw new Error('useAdminUI debe usarse dentro de <AdminUIProvider>');
  return ctx;
}
