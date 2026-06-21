import { CONFIG } from './config.js';
import { supabase, getOrCreateDeviceId } from './supabase.js';
import {
  createCommunityPost,
  createComment,
  loadComments,
  loadPostsByBuilding,
  toggleLikePost,
} from './community.js';

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

window.HYWAY_COMMUNITY = { renderBuildingCommunityDetail, renderPostList };
window.renderBuildingCommunityDetail = renderBuildingCommunityDetail;
window.renderPostList = renderPostList;
window.renderComments = renderComments;
window.toggleLikePost = likePost;

const originalOpenCommunityTab = window.openCommunityTab;
window.openCommunityTab = function openCommunityTab(...args) {
  console.log('[HYWAY] community tab opened');
  return originalOpenCommunityTab?.apply(this, args);
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
