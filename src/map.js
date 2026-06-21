export function loadKakaoMapSdk(appKey) {
  return new Promise((resolve, reject) => {
    if (!appKey) return reject(new Error('카카오맵 JavaScript 키가 설정되지 않았습니다.'));
    if (window.kakao?.maps) return resolve();
    const existing = document.querySelector('script[data-kakao-map-sdk]');
    if (existing) {
      existing.addEventListener('load', () => window.kakao.maps.load(resolve), { once: true });
      existing.addEventListener('error', () => reject(new Error('카카오맵 SDK 로드에 실패했습니다.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.dataset.kakaoMapSdk = 'true';
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services,clusterer`;
    script.onload = () => window.kakao.maps.load(resolve);
    script.onerror = () => reject(new Error('카카오맵 SDK 로드에 실패했습니다.'));
    document.head.appendChild(script);
  });
}
