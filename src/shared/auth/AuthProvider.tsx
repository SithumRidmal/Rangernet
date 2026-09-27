import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { cacheGet, cacheSet } from '../sync/localDb';
import { ServiceError, unwrap } from '../utils/errors';
import type { AppRole, Profile } from '../types';

export type SignUpParams = {
  email: string;
  password: string;
  role: AppRole;
  fullName: string;
  employeeId?: string;
  contactNumber?: string;
  village?: string;
  assignedArea?: string;
  parkId?: string | null;
};

type AuthContextValue = {
  initializing: boolean;
  session: Session | null;
  profile: Profile | null;
  profileLoading: boolean;
  profileError: string | null;
  /** True while the user is inside the OTP password recovery flow. */
  recovering: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (params: SignUpParams) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resolveEmail: (identifier: string) => Promise<string>;
  sendRecoveryCode: (email: string) => Promise<void>;
  verifyRecoveryCode: (email: string, token: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  finishRecovery: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const PROFILE_CACHE_KEY = (uid: string) => `profile:${uid}`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const recoveringRef = useRef(false);

  const loadProfile = useCallback(async (uid: string) => {
    setProfileLoading(true);
    setProfileError(null);
    const cached = await cacheGet<Profile>(PROFILE_CACHE_KEY(uid));
    if (cached) setProfile(cached);
    try {
      const data = unwrap(await supabase.from('profiles').select('*').eq('id', uid).maybeSingle());
      if (!data) {
        if (!cached) setProfileError('Your user profile was not found. Please contact the park office.');
      } else {
        setProfile(data as Profile);
        await cacheSet(PROFILE_CACHE_KEY(uid), data);
      }
    } catch (e) {
      // Offline start-up: keep working with the cached profile.
      if (!cached) setProfileError(e instanceof Error ? e.message : 'Could not load your profile.');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        if (data.session) loadProfile(data.session.user.id);
      })
      .finally(() => mounted && setInitializing(false));

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setProfileError(null);
      }
      if (next && (event === 'SIGNED_IN' || event === 'USER_UPDATED') && !recoveringRef.current) {
        loadProfile(next.user.id);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const resolveEmail = useCallback(async (identifier: string) => {
    const id = identifier.trim();
    if (!id) throw new ServiceError('Enter your Employee ID or e-mail.');
    if (id.includes('@')) return id.toLowerCase();
    const email = unwrap(await supabase.rpc('resolve_login_email', { p_identifier: id })) as string | null;
    if (!email) throw new ServiceError('No account found for this Employee ID.');
    return email;
  }, []);

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      const email = await resolveEmail(identifier);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (/email not confirmed/i.test(error.message)) {
          throw new ServiceError('Please confirm your e-mail address first (check your inbox).');
        }
        if (/invalid login credentials/i.test(error.message)) {
          throw new ServiceError('Incorrect ID or password.');
        }
        throw new ServiceError(error.message);
      }
    },
    [resolveEmail],
  );

  const signUp = useCallback(async (p: SignUpParams) => {
    if (p.employeeId) {
      const available = unwrap(
        await supabase.rpc('is_employee_id_available', { p_employee_id: p.employeeId }),
      ) as boolean;
      if (!available) throw new ServiceError('This Employee ID is already registered.');
    }
    const { data, error } = await supabase.auth.signUp({
      email: p.email.trim().toLowerCase(),
      password: p.password,
      options: {
        data: {
          role: p.role,
          full_name: p.fullName.trim(),
          employee_id: p.employeeId?.trim() || null,
          contact_number: p.contactNumber?.trim() || null,
          village: p.village?.trim() || null,
          assigned_area: p.assignedArea?.trim() || null,
          park_id: p.parkId || null,
        },
      },
    });
    if (error) throw new ServiceError(error.message);
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' });
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const sendRecoveryCode = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new ServiceError(error.message);
  }, []);

  const verifyRecoveryCode = useCallback(async (email: string, token: string) => {
    recoveringRef.current = true;
    setRecovering(true);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
    if (error) {
      recoveringRef.current = false;
      setRecovering(false);
      throw new ServiceError(error.message);
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new ServiceError(error.message);
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const finishRecovery = useCallback(async () => {
    recoveringRef.current = false;
    setRecovering(false);
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing,
      session,
      profile,
      profileLoading,
      profileError,
      recovering,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      resolveEmail,
      sendRecoveryCode,
      verifyRecoveryCode,
      updatePassword,
      finishRecovery,
    }),
    [
      initializing,
      session,
      profile,
      profileLoading,
      profileError,
      recovering,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      resolveEmail,
      sendRecoveryCode,
      verifyRecoveryCode,
      updatePassword,
      finishRecovery,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Convenience hook for screens rendered only when signed in. */
export function useProfile(): Profile {
  const { profile } = useAuth();
  if (!profile) throw new Error('useProfile used without a signed-in profile');
  return profile;
}
