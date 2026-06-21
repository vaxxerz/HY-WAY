import { CONFIG } from './config.js';
import { supabase, getOrCreateDeviceId } from './supabase.js';

window.HYWAY_CONFIG = CONFIG;
window.HYWAY_SUPABASE = supabase;
window.HYWAY_DEVICE_ID = getOrCreateDeviceId();

if (CONFIG.kakaoMapKey && typeof window.loadKakaoMap === 'function') {
  window.loadKakaoMap(CONFIG.kakaoMapKey);
} else if (!CONFIG.kakaoMapKey) {
  console.info('HY-WAY: VITE_KAKAO_MAP_KEY가 없어 지도 키 입력 UI를 표시합니다.');
}
