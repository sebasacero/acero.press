import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';

export function useAdminAuth() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminInfo, setAdminInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAdmin = useCallback(async (currentSession) => {
    if (!currentSession) {
      setIsAdmin(false);
      setAdminInfo(null);
      return;
    }
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, full_name, role')
      .eq('auth_user_id', currentSession.user.id)
      .maybeSingle();

    if (error) {
      console.error('Error verificando admin:', error.message);
      setIsAdmin(false);
      setAdminInfo(null);
      return;
    }
    setIsAdmin(!!data);
    setAdminInfo(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await checkAdmin(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setLoading(true);
      await checkAdmin(newSession);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, [checkAdmin]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { session, isAdmin, adminInfo, loading, signIn, signOut };
}
