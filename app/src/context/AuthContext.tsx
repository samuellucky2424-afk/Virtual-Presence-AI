import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/lib/routes';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  adminLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, name: string, password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const formatUser = (su: SupabaseUser): User => ({
    id: su.id,
    name: su.user_metadata?.name || su.email?.split('@')[0] || 'User',
    email: su.email || '',
    avatar: su.user_metadata?.avatar_url,
    createdAt: su.created_at,
  });

  // Backend-enforced admin check via Supabase RPC.
  // The DB function `is_current_user_admin()` reads the `admins` table for
  // the currently authenticated user — the client cannot forge this result.
  const checkAdmin = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error: rpcError } = await supabase.rpc('is_current_user_admin');
      if (rpcError) {
        console.warn('[auth] is_current_user_admin RPC error:', rpcError.message);
        return false;
      }
      return Boolean(data);
    } catch (e) {
      console.warn('[auth] is_current_user_admin failed:', e);
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const applySession = async (session: { user: SupabaseUser } | null) => {
      if (session?.user) {
        if (!mounted) return;
        setUser(formatUser(session.user));
        setAdminLoading(true);
        const admin = await checkAdmin();
        if (!mounted) return;
        setIsAdmin(admin);
        setAdminLoading(false);
      } else {
        if (!mounted) return;
        setUser(null);
        setIsAdmin(false);
        setAdminLoading(false);
      }
      if (mounted) setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      void applySession(session as any);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session as any);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkAdmin]);

  const clearError = useCallback(() => setError(null), []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      // Backend-enforced admin detection — Supabase RPC checks `admins` table
      const admin = await checkAdmin();
      setIsAdmin(admin);
      setAdminLoading(false);

      navigate(admin ? ROUTES.PROTECTED.ADMIN : ROUTES.DEFAULT, { replace: true });
    } catch (err: any) {
      const message = err.message || 'Login failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, name: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      if (name.trim().length < 2) throw new Error('Name must be at least 2 characters');

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name.trim() } },
      });
      if (authError) throw authError;

      navigate(ROUTES.DEFAULT, { replace: true });
    } catch (err: any) {
      const message = err.message || 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setIsAdmin(false);
      setError(null);
      navigate(ROUTES.PUBLIC.LOGIN, { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isAdmin,
      adminLoading,
      login,
      logout,
      register,
      loading,
      error,
      clearError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
