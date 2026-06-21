import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config.js';

console.log('[HYWAY] app started');
console.log('[HYWAY] Supabase URL exists:', Boolean(CONFIG.supabaseUrl));
console.log('[HYWAY] Supabase anon key exists:', Boolean(CONFIG.supabaseAnonKey));

export const supabase = CONFIG.supabaseUrl && CONFIG.supabaseAnonKey
  ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey)
  : null;

export function getOrCreateDeviceId() {
  const key = 'HYWAY_DEVICE_ID';
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = `device_${crypto.randomUUID()}`;
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

export function isSupabaseConfigured() {
  return Boolean(supabase);
}
