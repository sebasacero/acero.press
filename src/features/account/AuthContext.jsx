import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const loadCustomer = useCallback(async (currentSession) => {
    if (!currentSession) {
      setCustomer(null);
      return;
    }
    const { data, error } = await supabase
      .from('customers')
      .select('id, email, full_name, avatar_url, subscribed_offers, monthly_subscription')
      .eq('auth_user_id', currentSession.user.id)
      .maybeSingle();
    if (error) {
      console.error('Error cargando el perfil del cliente:', error.message);
      return;
    }
    setCustomer(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadCustomer(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      await loadCustomer(newSession);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, [loadCustomer]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setIsOpen(false);
  }, []);

  const toggleOffersSubscription = useCallback(
    async (subscribed) => {
      if (!session) return;
      const { error } = await supabase
        .from('customers')
        .update({ subscribed_offers: subscribed })
        .eq('auth_user_id', session.user.id);
      if (!error) setCustomer((c) => (c ? { ...c, subscribed_offers: subscribed } : c));
    },
    [session]
  );

  const toggleMonthlySubscription = useCallback(
    async (subscribed) => {
      if (!session) return;
      const { error } = await supabase
        .from('customers')
        .update({ monthly_subscription: subscribed })
        .eq('auth_user_id', session.user.id);
      if (!error) setCustomer((c) => (c ? { ...c, monthly_subscription: subscribed } : c));
    },
    [session]
  );

  const value = {
    session,
    customer,
    loading,
    isLoggedIn: !!session,
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    signInWithGoogle,
    signOut,
    toggleOffersSubscription,
    toggleMonthlySubscription,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
