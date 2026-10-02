import { AppState, type AppStateStatus } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from '../config/env';

export const supabase = createClient(
  isSupabaseConfigured ? env.supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? env.supabasePublishableKey : 'placeholder-key-not-configured',
  {
    auth: {
      storage: window.localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

function onAppStateChange(state: AppStateStatus) {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
}
AppState.addEventListener('change', onAppStateChange);
