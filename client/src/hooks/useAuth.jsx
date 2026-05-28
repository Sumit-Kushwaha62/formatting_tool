import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userPlan, setUserPlan] = useState('free');
  const [realDocs, setRealDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [modal, setModal] = useState(null);

  const openModal = (m) => {
    setModal(m);
    setAuthError('');
  };
  
  const closeModal = () => setModal(null);

  // Fetch real plan and documents for the user
  const refreshPlanAndDocs = async (userId) => {
    const targetId = userId || user?.id;
    if (!targetId) return { docsCount: 0, plan: 'free' };
    
    try {
      // 1. Fetch user documents
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', targetId)
        .order('created_at', { ascending: false });
      
      let dCount = 0;
      if (docs) {
        setRealDocs(docs);
        dCount = docs.length;
      }

      // 2. Fetch user plan from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', targetId)
        .single();
      
      let activePlan = 'free';
      if (profile && profile.plan) {
        activePlan = profile.plan;
        setUserPlan(profile.plan);
      } else {
        // If profile does not exist, let's insert a default 'free' profile
        await supabase.from('profiles').insert({ id: targetId, plan: 'free' });
        setUserPlan('free');
      }

      return { docsCount: dCount, plan: activePlan };
    } catch (err) {
      console.error('Error fetching plan/docs:', err);
      return { docsCount: realDocs.length, plan: userPlan };
    }
  };

  useEffect(() => {
    // Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = {
          name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
          email: session.user.email,
          id: session.user.id,
        };
        setUser(u);
        refreshPlanAndDocs(u.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const u = {
          name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
          email: session.user.email,
          id: session.user.id,
        };
        setUser(u);
        await refreshPlanAndDocs(u.id);
      } else {
        setUser(null);
        setUserPlan('free');
        setRealDocs([]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    setAuthError('');
    if (!email || !password) {
      setAuthError('Email and password are required.');
      return false;
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    const u = {
      name: data.user.user_metadata?.full_name || data.user.email.split('@')[0],
      email: data.user.email,
      id: data.user.id,
    };
    setUser(u);
    await refreshPlanAndDocs(u.id);
    closeModal();
    return true;
  };

  const signup = async (name, email, password) => {
    setAuthError('');
    if (!name || !email || !password) {
      setAuthError('All fields are required.');
      return false;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    const u = {
      name,
      email: data.user.email,
      id: data.user.id,
    };
    setUser(u);
    await refreshPlanAndDocs(u.id);
    closeModal();
    return true;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    setUserPlan('free');
    setRealDocs([]);
    closeModal();
    return !error;
  };

  const deleteAccount = async () => {
    const targetId = user?.id;
    if (!targetId) return false;

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/account/${targetId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Account delete failed');
      }

      await supabase.auth.signOut({ scope: 'global' });
      setUser(null);
      setUserPlan('free');
      setRealDocs([]);
      closeModal();
      return true;
    } catch (err) {
      console.error('Delete account error:', err);
      return false;
    }
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: import.meta.env.VITE_SITE_URL || window.location.origin
      }
    });
    if (error) setAuthError(error.message);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userPlan,
        realDocs,
        docsCount: realDocs.length,
        loading,
        authError,
        modal,
        openModal,
        closeModal,
        login,
        signup,
        logout,
        deleteAccount,
        loginWithGoogle,
        refreshPlanAndDocs: (id) => refreshPlanAndDocs(id || user?.id),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
