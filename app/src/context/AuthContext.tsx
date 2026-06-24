import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/lib/routes';
import { DB_RPC, DB_TABLES } from '@/lib/dbNames';
import { apiFetch } from '@/lib/api-client';
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

type AdminLookupResult = {
  user_id?: string | null;
  email?: string | null;
};

function isNetworkFetchError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return /failed to fetch|fetch failed|networkerror|network error/i.test(message);
}

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
  // The DB function reads the clone admins table for
  // the currently authenticated user — the client cannot forge this result.
  const checkAdmin = useCallback(async (
    expectedUserId?: string,
    accessToken?: string,
    expectedEmail?: string | null,
  ): Promise<boolean> => {
    try {
      const { data, error: rpcError } = await supabase.rpc(DB_RPC.isCurrentUserAdmin);
      if (!rpcError && Boolean(data)) {
        return true;
      }

      if (rpcError) {
        console.warn(`[auth] ${DB_RPC.isCurrentUserAdmin} RPC error:`, rpcError.message);
      }

      let currentSession: any = null;
      let userId = expectedUserId;
      let userEmail = (expectedEmail || '').trim();
      let bearerToken = accessToken;

      if (!userId || !userEmail || !bearerToken) {
        const { data: { session } } = await supabase.auth.getSession();
        currentSession = session;
        userId = userId || session?.user?.id;
        userEmail = userEmail || (session?.user?.email || '').trim();
        bearerToken = bearerToken || session?.access_token;
      }

      if (!userId) {
        return false;
      }

      const { data: explicitRpcData, error: explicitRpcError } = await supabase.rpc(DB_RPC.isAdmin, {
        p_user: userId,
      });
      if (!explicitRpcError && Boolean(explicitRpcData)) {
        return true;
      }

      if (explicitRpcError) {
        console.warn(`[auth] ${DB_RPC.isAdmin} RPC error:`, explicitRpcError.message);
      }

      const { data: adminRows, error: adminError } = await supabase
        .from(DB_TABLES.admins)
        .select('user_id,email')
        .eq('user_id', userId)
        .limit(1);

      if (adminError) {
        console.warn(`[auth] ${DB_TABLES.admins} fallback admin check failed:`, adminError.message);
      } else if ((adminRows as AdminLookupResult[] | null)?.some((row) => row?.user_id)) {
        return true;
      }

      if (userEmail) {
        const { data: adminEmailRows, error: adminEmailError } = await supabase
          .from(DB_TABLES.admins)
          .select('user_id,email')
          .ilike('email', userEmail)
          .limit(1);

        if (adminEmailError) {
          console.warn(`[auth] ${DB_TABLES.admins} email fallback admin check failed:`, adminEmailError.message);
        } else if ((adminEmailRows as AdminLookupResult[] | null)?.some((row) => row?.user_id)) {
          return true;
        }
      }

      bearerToken = bearerToken || currentSession?.access_token;
      if (bearerToken) {
        const response = await apiFetch('/admin-status', {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        });

        if (response.ok) {
          const status = await response.json().catch(() => null);
          return Boolean(status?.isAdmin);
        }

        const status = await response.json().catch(() => null);
        console.warn('[auth] admin-status fallback failed:', response.status, status?.warning || status?.error || status);
      }

      return false;
    } catch (e) {
      console.warn(`[auth] ${DB_RPC.isCurrentUserAdmin} failed:`, e);
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let authStateTimer: ReturnType<typeof setTimeout> | null = null;

    const applySession = async (session: { user: SupabaseUser } | null) => {
      if (session?.user) {
        if (!mounted) return;
        setUser(formatUser(session.user));
        setAdminLoading(true);
        const admin = await checkAdmin(session.user.id, (session as any).access_token, session.user.email);
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
      if (authStateTimer) clearTimeout(authStateTimer);
      authStateTimer = setTimeout(() => {
        void applySession(session as any);
      }, 0);
    });

    return () => {
      mounted = false;
      if (authStateTimer) clearTimeout(authStateTimer);
      subscription.unsubscribe();
    };
  }, [checkAdmin]);

  const clearError = useCallback(() => setError(null), []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const signedInUser = data.user || data.session?.user;
      if (signedInUser) {
        setUser(formatUser(signedInUser));
      }

      setAdminLoading(true);
      const admin = await checkAdmin(signedInUser?.id, data.session?.access_token, signedInUser?.email);
      setIsAdmin(admin);
      setAdminLoading(false);

      navigate(admin ? ROUTES.PROTECTED.ADMIN : ROUTES.DEFAULT, { replace: true });
    } catch (err: any) {
      const message = isNetworkFetchError(err)
        ? 'Unable to reach the authentication backend. Check your internet connection and try again.'
        : err.message || 'Login failed';
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
        options: {
          data: {
            name: name.trim(),
            app: 'virtualpresenceai',
            app_name: 'Virtual Presence AI',
          },
        },
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
