import { supabase, getOrCreateDeviceId } from './supabase.js';

export async function loadCommunityPosts() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('community_posts').select('*').order('created_at', { ascending: false });
  if (error) throw new Error('커뮤니티 글 조회 실패');
  return data;
}

export async function loadPostsByBuilding(buildingId) {
  if (!supabase) return [];
  const { data, error } = await supabase.from('community_posts').select('*').eq('building_id', buildingId).order('created_at', { ascending: false });
  if (error) throw new Error('건물 커뮤니티 글 조회 실패');
  return data;
}

export async function createCommunityPost(post) {
  if (!supabase) throw new Error('Supabase URL 또는 anon key가 설정되지 않았습니다.');
  const { data, error } = await supabase.from('community_posts').insert(post).select().single();
  if (error) throw new Error('게시글 작성 실패');
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
