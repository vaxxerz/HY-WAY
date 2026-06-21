-- HY-WAY GPS 기반 커뮤니티 메타데이터 (정확한 위도/경도는 저장하지 않습니다.)
alter table community_posts
  add column if not exists user_accuracy double precision,
  add column if not exists distance_to_building double precision,
  add column if not exists location_based boolean default false;
