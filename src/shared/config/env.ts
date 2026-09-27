// Each variable must be referenced statically (process.env.EXPO_PUBLIC_X) so Expo can inline it.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const env = {
  supabaseUrl,
  supabasePublishableKey,
  smsReportNumber: process.env.EXPO_PUBLIC_SMS_REPORT_NUMBER ?? '',
  incidentPhotoBucket: process.env.EXPO_PUBLIC_INCIDENT_PHOTO_BUCKET || 'incident-photos',
  reportPhotoBucket: process.env.EXPO_PUBLIC_REPORT_PHOTO_BUCKET || 'report-photos',
  conservationReportBucket: 'conservation-reports',
  syncRetryIntervalMs: Number(process.env.EXPO_PUBLIC_SYNC_RETRY_INTERVAL_MS) || 30000,
};

export const isSupabaseConfigured =
  /^https?:\/\//.test(supabaseUrl) && supabasePublishableKey.length > 20;
