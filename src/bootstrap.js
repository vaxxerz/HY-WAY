import { CONFIG } from './config.js';
import { loadKakaoMapSdk } from './map.js';

export async function bootstrapLegacyApp() {
  const response = await fetch('/hyway_hanyang_route_service.html');
  if (!response.ok) throw new Error('HY-WAY 앱 파일을 불러오지 못했습니다.');
  const html = await response.text();
  document.open();
  document.write(html);
  document.close();

  if (!CONFIG.kakaoMapKey) return;
  try {
    await loadKakaoMapSdk(CONFIG.kakaoMapKey);
    window.loadKakaoMap?.(CONFIG.kakaoMapKey);
  } catch (error) {
    console.warn(error.message);
  }
}
