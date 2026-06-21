export const NEARBY_BUILDING_LIMIT = 5;
export const NEARBY_BUILDING_RADIUS_M = 250;

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('이 브라우저는 위치 기능을 지원하지 않습니다.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      }),
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

export function handleGeolocationError(error) {
  if (error?.code === 1) return '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.';
  if (error?.code === 2) return '현재 위치를 확인할 수 없습니다.';
  if (error?.code === 3) return '위치 확인 시간이 초과되었습니다. 다시 시도해주세요.';
  return error?.message || '현재 위치를 가져오지 못했습니다.';
}

export function findNearestNode(lat, lng, nodes, options = {}) {
  const excludedTypes = options.excludedTypes || ['portal', 'elevator', 'stairs'];
  const maxDistance = options.maxDistance ?? Infinity;
  const distanceMeter = options.distanceMeter;
  if (typeof distanceMeter !== 'function') throw new Error('거리 계산 함수를 찾지 못했습니다.');
  const valid = nodes.filter((node) => Number.isFinite(node.lat) && Number.isFinite(node.lng));
  const candidates = valid.filter((node) => !excludedTypes.includes(node.type));
  let node = null;
  let distance = Infinity;
  for (const candidate of candidates.length ? candidates : valid) {
    const candidateDistance = distanceMeter(lat, lng, candidate.lat, candidate.lng);
    if (candidateDistance < distance) {
      node = candidate;
      distance = candidateDistance;
    }
  }
  return { node: distance <= maxDistance ? node : null, distance };
}

export function findNearbyBuildings(lat, lng, nodes, options = {}) {
  const limit = options.limit ?? NEARBY_BUILDING_LIMIT;
  const radius = options.radius ?? NEARBY_BUILDING_RADIUS_M;
  const distanceMeter = options.distanceMeter;
  if (typeof distanceMeter !== 'function') throw new Error('거리 계산 함수를 찾지 못했습니다.');
  return nodes
    .filter((node) => node.type === 'building' && Number.isFinite(node.lat) && Number.isFinite(node.lng))
    .map((node) => ({ ...node, distanceFromUser: distanceMeter(lat, lng, node.lat, node.lng) }))
    .filter((node) => node.distanceFromUser <= radius)
    .sort((a, b) => a.distanceFromUser - b.distanceFromUser)
    .slice(0, limit);
}

export function formatDistance(meter) {
  return meter < 1000 ? `${Math.round(meter)}m` : `${(meter / 1000).toFixed(1)}km`;
}
