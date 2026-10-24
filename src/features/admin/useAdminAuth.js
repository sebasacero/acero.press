import { useSyncExternalStore, useCallback } from 'react';
import { markTeam } from '../../shared/lib/analytics.js';
import { supabase } from '../../shared/lib/supabaseClient.js';

// Estado de sesión compartido: antes cada lápiz/dock/botón llamaba a
// useAdminAuth() por su cuenta y cada uno abría su propio listener de
// Supabase y consultaba admin_users. Ahora hay una sola suscripción para
// toda la app y todos los componentes leen el mismo estado.
let state = { session: null, isAdmin: false, adminInfo: null, loading: true };
const listeners = new Set();
let started = false;

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

async function checkAdmin(session) {
  if (!session) {
    setState({ session: null, isAdmin: false, adminInfo: null, loading: false });
    return;
  }
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, full_name, role')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();

  if (error) console.error('Error verificando admin:', error.message);
  if (!error && data) markTeam(); // el equipo no cuenta como visita del sitio
  setState({ session, isAdmin: !error && !!data, adminInfo: error ? null : data, loading: false });
}

function start() {
  if (started) return;
  started = true;
  supabase.auth.getSession().then(({ data }) => checkAdmin(data.session));
  supabase.auth.onAuthStateChange((_event, newSession) => {
    // Los refrescos de token no cambian de usuario: no vuelvas a consultar.
    if (newSession?.user?.id && newSession.user.id === state.session?.user?.id) {
      setState({ session: newSession });
      return;
    }
    setState({ loading: true });
    checkAdmin(newSession);
  });
}

function subscribe(listener) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;

export function useAdminAuth() {
  const snap = useSyncExternalStore(subscribe, getSnapshot);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { ...snap, signIn, signOut };
}

/** true solo para tu cuenta (role: owner) — quien ve lápices, dock y Micra. */
export function useIsOwner() {
  const { isAdmin, adminInfo } = useSyncExternalStore(subscribe, getSnapshot);
  return isAdmin && adminInfo?.role === 'owner';
}
