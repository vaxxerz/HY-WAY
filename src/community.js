import { supabase, getOrCreateDeviceId } from './supabase.js';

export async function loadCommunityPosts() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('community_posts').select('*').order('created_at', { ascending: false });
  if (error) throw new Error('커뮤니티 글 조회 실패');
  return data;
}

export async function loadPostsByBuilding(buildingId) {
  console.log('[HYWAY] loading posts for building:', buildingId);
  if (!supabase) {
    console.error('[HYWAY] Supabase client is missing');
    return [];
  }
  const { data, error } = await supabase.from('community_posts').select('*').eq('building_id', buildingId).order('created_at', { ascending: false });
  if (error) {
    console.error('[HYWAY] loadPostsByBuilding failed:', error);
    alert(`게시글을 불러오지 못했습니다: ${error.message}`);
    return [];
  }
  console.log('[HYWAY] loaded posts:', data);
  return data || [];
}

export async function createCommunityPost(post) {
  console.log('[HYWAY] createCommunityPost called:', post);
  if (!supabase) {
    console.error('[HYWAY] Supabase client is missing');
    alert('Supabase 연결이 초기화되지 않았습니다.');
    return null;
  }
  const payload = {
    building_id: post.buildingId,
    building_name: post.buildingName,
    type: post.type,
    title: post.title,
    content: post.content,
    author: post.author || '익명',
    crowd_level: post.crowdLevel || null,
  };
  console.log('[HYWAY] inserting community post payload:', payload);
  const { data, error } = await supabase.from('community_posts').insert(payload).select().single();
  if (error) {
    console.error('[HYWAY] community post insert failed:', error);
    alert(`게시글 저장 실패: ${error.message}`);
    return null;
  }
  console.log('[HYWAY] community post insert success:', data);
  return data;
}

export async function loadComments(postId) {
  if (!supabase) return [];
  const { data, error } = await supabase.from('community_comments').select('*').eq('post_id', postId).order('created_at');
  if (error) throw new Error('댓글 조회 실패');
  return data;
}

export async function createComment(postId, buildingId, content, author = '익명') {
  if (!supabase) throw new Error('Supabase URL 또는 anon key가 설정되지 않았습니다.');
  const { data, error } = await supabase.from('community_comments').insert({ post_id: postId, building_id: buildingId, content, author }).select().single();
  if (error) throw new Error('댓글 작성 실패');
  return data;
}

export async function toggleLikePost(postId) {
  if (!supabase) throw new Error('Supabase URL 또는 anon key가 설정되지 않았습니다.');
  const deviceId = getOrCreateDeviceId();
  const { error } = await supabase.from('post_likes').insert({ post_id: postId, device_id: deviceId });
  if (error?.code === '23505') return false;
  if (error) throw new Error('좋아요 실패');
  return true;
}
