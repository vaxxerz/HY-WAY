import { CONFIG } from './config.js';
import { supabase, getOrCreateDeviceId } from './supabase.js';
import {
  createCommunityPost,
  createComment,
  loadCommunityPosts,
  loadComments,
  loadPostsByBuilding,
  toggleLikePost,
} from './community.js';
import { findNearbyBuildings, findNearestNode, formatDistance, getCurrentPosition, handleGeolocationError } from './location.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const relativeTime = (date) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return '방금 전';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  return `${Math.floor(seconds / 86400)}일 전`;
};

function buildingFor(id) {
  return window.HYWAY_LEGACY?.getBuilding?.(id) ?? null;
}

const postTypeIcon = (type) => ({
  '잡담': '💬', '길찾기 팁': '🧭', '혼잡도 제보': '🔥', '시설 정보': '🏢', '질문': '❓', '공지': '📌',
}[type] || '✨');

let communityPreviewState = { posts: [], comments: [] };
let currentLocation = null;
let nearbyBuildings = [];

async function getLocationForFeature() {
  currentLocation = await getCurrentPosition();
  window.HYWAY_LEGACY?.renderCurrentLocationMarker?.(currentLocation.lat, currentLocation.lng, currentLocation.accuracy);
  return currentLocation;
}

export async function setStartToNearestNode() {
  const button = document.querySelector('#useCurrentLocationBtn');
  const hint = document.querySelector('#locationRouteHint');
  try {
    if (button) { button.disabled = true; button.textContent = '현재 위치를 확인하는 중입니다…'; }
    const location = await getLocationForFeature();
    const result = findNearestNode(location.lat, location.lng, window.HYWAY_LEGACY?.getNodes?.() || [], { distanceMeter: window.HYWAY_LEGACY?.distanceMeter });
    if (!result.node) throw new Error('가까운 출발 노드를 찾지 못했습니다.');
    window.HYWAY_LEGACY?.setStartNode?.(result.node);
    if (hint) hint.textContent = `가장 가까운 출발 지점은 ‘${result.node.name}’입니다. 출발지로 설정했습니다. GPS 오차 약 ${Math.round(location.accuracy)}m`;
    showToast(`현재 위치 기준 ‘${result.node.name}’을(를) 출발지로 설정했습니다.`);
  } catch (error) {
    if (hint) hint.textContent = handleGeolocationError(error);
    showToast(handleGeolocationError(error));
  } finally {
    if (button) { button.disabled = false; button.textContent = '⌖ 내 위치로 출발'; }
  }
}

async function openNearbyCommunity() {
  const result = document.querySelector('#nearbyCommunityResult');
  try {
    if (result) result.innerHTML = '<p class="empty">내 주변 건물을 확인하는 중…</p>';
    const location = await getLocationForFeature();
    nearbyBuildings = findNearbyBuildings(location.lat, location.lng, window.HYWAY_LEGACY?.getNodes?.() || [], { limit: 3, distanceMeter: window.HYWAY_LEGACY?.distanceMeter });
    if (!result) return;
    if (!nearbyBuildings.length) {
      result.innerHTML = '<p class="empty">주변 250m 안에 등록된 건물이 없습니다. 전체 건물 커뮤니티를 확인해주세요.</p><button class="secondary" onclick="renderCommunityHome()">전체 건물 커뮤니티 보기</button>';
      return;
    }
    result.innerHTML = nearbyBuildings.map((building) => { const posts = communityPreviewState.posts.filter((post) => post.building_id === building.id); const comments = communityPreviewState.comments.filter((comment) => comment.building_id === building.id); return `<article class="post-card"><b>${escapeHtml(building.name)}</b><div class="post-meta">${formatDistance(building.distanceFromUser)} · 게시글 ${posts.length} · 댓글 ${comments.length}</div><div class="community-actions"><button onclick="openBuildingCommunity('${building.id}')">글쓰기 · 자세히 보기</button><button onclick="focusBuildingOnMap('${building.id}')">지도에서 보기</button></div></article>`; }).join('');
  } catch (error) {
    if (result) result.innerHTML = `<p class="empty">${escapeHtml(handleGeolocationError(error))}<br>전체 건물 커뮤니티는 아래에서 계속 확인할 수 있어요.</p>`;
  }
}

function buildActivity(building, posts, comments) {
  const buildingPosts = posts.filter((post) => post.building_id === building.id);
  const buildingComments = comments.filter((comment) => comment.building_id === building.id);
  const lastActivityAt = [...buildingPosts, ...buildingComments]
    .map((item) => item.created_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  const likes = buildingPosts.reduce((sum, post) => sum + (post.likes_count || 0), 0);
  const ageHours = lastActivityAt ? (Date.now() - new Date(lastActivityAt).getTime()) / 3600000 : Infinity;
  const recentBonus = ageHours <= 1 ? 20 : ageHours <= 6 ? 12 : ageHours <= 24 ? 8 : ageHours <= 72 ? 4 : 0;
  return { building, posts: buildingPosts, postCount: buildingPosts.length, commentCount: buildingComments.length, likes, lastActivityAt, score: buildingPosts.length * 5 + buildingComments.length * 2 + likes + recentBonus };
}

async function refreshCommunityPreviewData() {
  console.log('[HYWAY] loading community previews from Supabase');
  const [posts, commentsResult] = await Promise.all([
    loadCommunityPosts(),
    supabase ? supabase.from('community_comments').select('post_id, building_id, created_at') : Promise.resolve({ data: [], error: null }),
  ]);
  if (commentsResult.error) console.error('[HYWAY] community preview comments load failed:', commentsResult.error);
  communityPreviewState = { posts: posts || [], comments: commentsResult.data || [] };
  console.log('[HYWAY] community previews loaded:', { posts: communityPreviewState.posts.length, comments: communityPreviewState.comments.length });
}

async function renderBuildingCommunityList() {
  const target = document.querySelector('#communityCards');
  if (!target) return;
  const query = (document.querySelector('#communitySearch')?.value || '').toLowerCase();
  const filter = document.querySelector('#communityFilter')?.value || 'all';
  const buildings = window.HYWAY_LEGACY?.getBuildings?.() || [];
  let activity = buildings.map((building) => buildActivity(building, communityPreviewState.posts, communityPreviewState.comments))
    .filter(({ building }) => `${building.name} ${building.building || ''} ${building.group || ''}`.toLowerCase().includes(query));
  if (filter === 'posts') activity = activity.filter((item) => item.postCount);
  if (filter === 'hot') activity = activity.filter((item) => item.score >= 12);
  if (filter === 'crowd') activity = activity.filter((item) => item.posts.some((post) => ['혼잡', '매우 혼잡'].includes(post.crowd_level)));
  activity.sort((a, b) => b.score - a.score || b.postCount - a.postCount || a.building.name.localeCompare(b.building.name, 'ko'));
  target.innerHTML = activity.map((item, index) => {
    const previews = [...item.posts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
    return `<article class="building-card ${index < 3 && item.score ? 'hot' : ''}">
      <div class="card-head"><span class="rank">#${index + 1}${index < 3 && item.score ? ' · HOT' : ''}</span><span class="activity">${item.score}<small> 활동</small></span></div>
      <h3>${escapeHtml(item.building.name)}</h3>
      <p class="post-meta">${item.postCount ? '지금 이 건물에서 이야기 중' : '아직 새 글이 없어요'} · ${item.lastActivityAt ? relativeTime(item.lastActivityAt) : '활동 없음'}</p>
      <div class="feed-preview">${previews.length ? previews.map((post) => `<button onclick="openBuildingCommunity('${item.building.id}')"><b>${postTypeIcon(post.type)} ${escapeHtml(post.title)}</b><span>♥ ${post.likes_count || 0} · 댓글 ${communityPreviewState.comments.filter((comment) => comment.post_id === post.id).length}</span></button>`).join('') : '<span class="empty">첫 이야기를 남겨 보세요.</span>'}</div>
      <div class="community-actions"><button onclick="openBuildingCommunity('${item.building.id}')">자세히 보기</button><button onclick="focusBuildingOnMap('${item.building.id}')">지도에서 보기</button></div>
    </article>`;
  }).join('') || '<p class="empty">조건에 맞는 건물이 없습니다.</p>';
}

function isHotBuilding(buildingId) {
  const buildings = window.HYWAY_LEGACY?.getBuildings?.() || [];
  return buildings
    .map((building) => buildActivity(building, communityPreviewState.posts, communityPreviewState.comments))
    .sort((a, b) => b.score - a.score || b.postCount - a.postCount || a.building.name.localeCompare(b.building.name, 'ko'))
    .slice(0, 3)
    .some((item) => item.score > 0 && item.building.id === buildingId);
}

async function renderCommunityHome() {
  const view = document.querySelector('#communityView');
  if (!view) return;
  view.innerHTML = `<section style="margin-bottom:15px;padding:14px;border:1px solid #cde3ff;border-radius:16px;background:#edf7ff"><h3 style="margin:0">내 주변 커뮤니티</h3><p class="post-meta">현재 위치 근처 건물 3개를 자동으로 보여드려요</p><div id="nearbyCommunityResult"><p class="empty">내 주변 건물을 확인하는 중…</p></div></section><div class="section-title"><div><h2>장소 커뮤니티</h2><p>한양대 건물별 실시간 이야기와 제보를 확인하세요</p></div></div>
    <div class="list-tools"><input id="communitySearch" placeholder="건물명·그룹 검색"><select id="communityFilter"><option value="all">전체</option><option value="posts">게시글 있음</option><option value="hot">HOT</option><option value="crowd">혼잡 제보 있음</option></select></div>
    <div id="communityCards" class="community-grid"><p class="empty">Supabase에서 커뮤니티를 불러오는 중…</p></div>`;
  document.querySelector('#communitySearch').addEventListener('input', renderBuildingCommunityList);
  document.querySelector('#communityFilter').addEventListener('change', renderBuildingCommunityList);
  try {
    await refreshCommunityPreviewData();
    await renderBuildingCommunityList();
    await openNearbyCommunity();
    if (window.hotBuildingsEnabled !== false) window.renderAllNodes?.();
  } catch (error) {
    console.error('[HYWAY] community preview load failed:', error);
    document.querySelector('#communityCards').innerHTML = '<p class="empty">커뮤니티를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>';
  }
}

function showToast(message) {
  if (typeof window.toast === 'function') window.toast(message);
  else window.alert(message);
}

async function renderPostList(buildingId) {
  const target = document.querySelector('#postList');
  if (!target) return;
  target.innerHTML = '<p class="empty">게시글을 불러오는 중…</p>';
  const posts = await loadPostsByBuilding(buildingId);
  target.innerHTML = posts.length ? posts.map((post) => `
    <article class="post-card">
      <span class="badge">💬 ${escapeHtml(post.type)}</span>
      ${post.crowd_level ? `<span class="badge portal">${escapeHtml(post.crowd_level)}</span>` : ''}
      <h4>${escapeHtml(post.title)}</h4>
      <p>${escapeHtml(post.content)}</p>
      <div class="post-meta">${escapeHtml(post.author || '익명')} · ${relativeTime(post.created_at)} · 댓글 <span id="commentCount_${post.id}">…</span></div>
      <div class="post-actions">
        <button onclick="toggleLikePost('${post.id}', '${buildingId}')">♥ ${post.likes_count || 0}</button>
        <button onclick="renderComments('${post.id}', '${buildingId}')">댓글</button>
      </div>
      <div id="comments_${post.id}"></div>
    </article>`).join('') : '<p class="empty">첫 게시글을 작성해 보세요.</p>';
  await Promise.all(posts.map(async (post) => {
    const comments = await loadComments(post.id);
    const count = document.querySelector(`#commentCount_${post.id}`);
    if (count) count.textContent = comments.length;
  }));
}

async function renderBuildingCommunityDetail(buildingId) {
  const building = buildingFor(buildingId);
  const view = document.querySelector('#communityView');
  if (!building || !view) return;
  const nearbyBuilding = nearbyBuildings.find((nearby) => nearby.id === buildingId);
  console.log('[HYWAY] building community opened:', buildingId);
  view.innerHTML = `
    <button class="ghost" onclick="renderCommunityHome()">← 목록</button>
    <div class="section-title" style="margin-top:12px"><div>
      <h2>${escapeHtml(building.name)} 커뮤니티</h2>
      <p>${escapeHtml(building.group || building.building || '한양대학교')}의 실시간 이야기</p>
    </div><div class="community-actions">
      <button onclick="focusBuildingOnMap('${buildingId}')">지도에서 보기</button>
      <button onclick="startRouteToBuilding('${buildingId}')">이 건물로 길찾기</button>
    </div></div>
    ${nearbyBuilding ? `<p class="community-note">현재 위치 근처 건물입니다 · 약 ${formatDistance(nearbyBuilding.distanceFromUser)} · 정확한 좌표는 저장하지 않습니다.</p>` : '<p class="community-note">이 건물은 현재 위치와 떨어져 있을 수 있습니다. 정확한 장소 기반 커뮤니티를 위해 현재 위치 근처 건물에 글을 작성하는 것을 권장합니다.</p>'}
    <form id="communityPostForm" class="community-form" data-building-id="${escapeHtml(buildingId)}">
      <select name="type"><option>잡담</option><option>길찾기 팁</option><option>혼잡도 제보</option><option>질문</option><option>공지</option></select>
      <input name="title" required maxlength="80" placeholder="제목">
      <textarea name="content" required maxlength="600" placeholder="건물의 실시간 이야기를 남겨 주세요."></textarea>
      <div class="row"><input name="author" value="익명" maxlength="20"><select name="crowdLevel"><option value="">혼잡도 선택 안 함</option><option>여유</option><option>보통</option><option>혼잡</option><option>매우 혼잡</option></select></div>
      <button class="primary" type="submit">게시글 작성</button>
    </form><div id="postList"></div>`;
  const form = document.querySelector('#communityPostForm');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    console.log('[HYWAY] community post form submitted');
    const values = new FormData(form);
    const post = {
      buildingId,
      buildingName: building.name,
      type: values.get('type') || '잡담',
      title: String(values.get('title') || '').trim(),
      content: String(values.get('content') || '').trim(),
      author: String(values.get('author') || '').trim() || '익명',
      crowdLevel: values.get('crowdLevel') || null,
      locationBased: nearbyBuildings.some((nearby) => nearby.id === buildingId),
      distanceToBuilding: nearbyBuildings.find((nearby) => nearby.id === buildingId)?.distanceFromUser ?? null,
      userAccuracy: currentLocation?.accuracy ?? null,
    };
    if (!post.title || !post.content) return showToast('제목과 내용을 입력해주세요.');
    const saved = await createCommunityPost(post);
    if (saved) {
      showToast('게시글이 Supabase에 저장되었습니다.');
      form.reset();
      await renderBuildingCommunityDetail(buildingId);
    }
  });
  await renderPostList(buildingId);
}

async function renderComments(postId, buildingId) {
  const target = document.querySelector(`#comments_${postId}`);
  if (!target) return;
  const comments = await loadComments(postId);
  target.innerHTML = `<div class="comment-box">${comments.map((comment) => `<div class="comment"><b>${escapeHtml(comment.author || '익명')}</b> ${escapeHtml(comment.content)} <span class="post-meta">${relativeTime(comment.created_at)}</span></div>`).join('')}
    <form class="row" data-comment-form="${postId}"><input name="content" required placeholder="댓글"><input name="author" value="익명" style="max-width:90px"><button class="secondary">등록</button></form></div>`;
  const form = target.querySelector('form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    console.log('[HYWAY] community comment form submitted:', postId);
    const data = new FormData(form);
    const content = String(data.get('content') || '').trim();
    if (!content) return;
    try {
      await createComment(postId, buildingId, content, String(data.get('author') || '').trim() || '익명');
      await renderPostList(buildingId);
      await renderComments(postId, buildingId);
    } catch (error) {
      console.error('[HYWAY] community comment insert failed:', error);
      showToast(`댓글 저장 실패: ${error.message}`);
    }
  });
}

async function likePost(postId, buildingId) {
  try {
    const added = await toggleLikePost(postId);
    showToast(added ? '좋아요를 남겼습니다.' : '이미 좋아요를 눌렀습니다.');
    await renderPostList(buildingId);
  } catch (error) {
    console.error('[HYWAY] post like failed:', error);
    showToast(`좋아요 실패: ${error.message}`);
  }
}

window.HYWAY_COMMUNITY = { isHotBuilding, renderCommunityHome, renderBuildingCommunityList, renderBuildingCommunityDetail, renderPostList };
window.renderCommunityHome = renderCommunityHome;
window.renderBuildingCommunityList = renderBuildingCommunityList;
window.renderBuildingCommunityDetail = renderBuildingCommunityDetail;
window.renderPostList = renderPostList;
window.renderComments = renderComments;
window.toggleLikePost = likePost;
window.setStartToNearestNode = setStartToNearestNode;
window.openNearbyCommunity = openNearbyCommunity;

window.openCommunityTab = async function openCommunityTab() {
  console.log('[HYWAY] community tab opened');
  window.showPage?.(2);
  await renderCommunityHome();
};
window.openBuildingCommunity = async function openBuildingCommunity(buildingId) {
  console.log('[HYWAY] building community open requested:', buildingId);
  await renderBuildingCommunityDetail(buildingId);
  window.showPage?.(2);
};

window.testSupabasePost = async function testSupabasePost() {
  console.log('[HYWAY] testSupabasePost started');
  if (!supabase) return console.error('[HYWAY] Supabase client is missing');
  const { data, error } = await supabase.from('community_posts').insert({
    building_id: 'test_building', building_name: '테스트 건물', type: '잡담',
    title: 'Supabase 연결 테스트', content: '이 글이 Supabase에 들어가면 연결 성공입니다.',
    author: '테스트', crowd_level: '보통',
  }).select().single();
  console.log('[HYWAY] testSupabasePost result:', { data, error });
  return { data, error };
};

console.log('[HYWAY] legacy community bridge ready', {
  supabaseConfigured: Boolean(supabase),
  urlConfigured: Boolean(CONFIG.supabaseUrl),
  deviceIdReady: Boolean(getOrCreateDeviceId()),
});

document.querySelector('#useCurrentLocationBtn')?.addEventListener('click', setStartToNearestNode);
