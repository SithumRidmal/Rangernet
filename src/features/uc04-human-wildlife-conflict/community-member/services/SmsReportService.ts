import * as SMS from 'expo-sms';
import { env } from '@shared/config/env';

export type SmsSendResult = 'sent' | 'cancelled' | 'unknown' | 'unavailable';

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

export function isSmsReportingConfigured(): boolean {
  return env.smsReportNumber.trim().length > 0;
}

/** Message format parsed by the ingest_sms_report gateway function. */
export function buildSmsMessage(typeName: string, location: string, details: string): string {
  return `RANGERNET CONFLICT\nType: ${oneLine(typeName)}\nLocation: ${oneLine(location)}\nDetails: ${oneLine(details)}`;
}

export function formatSmsCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

/** Opens the SMS composer pre-filled with the gateway number and the message. */
export async function sendSmsReport(body: string): Promise<SmsSendResult> {
  if (!(await SMS.isAvailableAsync())) return 'unavailable';
  const { result } = await SMS.sendSMSAsync([env.smsReportNumber], body);
  return result;
}
