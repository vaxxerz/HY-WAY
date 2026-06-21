import { supabase } from './supabase.js';

export async function loadReports() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
  if (error) throw new Error('제보 조회 실패');
  return data;
}

export async function createReport(report) {
  if (!supabase) throw new Error('Supabase URL 또는 anon key가 설정되지 않았습니다.');
  const { data, error } = await supabase.from('reports').insert(report).select().single();
  if (error) throw new Error('제보 작성 실패');
  return data;
}
