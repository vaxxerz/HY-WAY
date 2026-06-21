create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(), building_id text not null, building_name text not null,
  type text not null, title text not null, content text not null, author text default '익명',
  crowd_level text, likes_count integer default 0, created_at timestamptz default now()
);
create table if not exists community_comments (
  id uuid primary key default gen_random_uuid(), post_id uuid references community_posts(id) on delete cascade,
  building_id text not null, content text not null, author text default '익명', created_at timestamptz default now()
);
create table if not exists post_likes (
  id uuid primary key default gen_random_uuid(), post_id uuid references community_posts(id) on delete cascade,
  device_id text not null, created_at timestamptz default now(), unique(post_id, device_id)
);
create table if not exists reports (
  id uuid primary key default gen_random_uuid(), report_type text not null, node_id text, edge_id text,
  title text not null, content text not null, suggested_uphill integer, suggested_time integer,
  author text default '익명', status text default '검토 전', created_at timestamptz default now()
);
alter table community_posts enable row level security;
alter table community_comments enable row level security;
alter table post_likes enable row level security;
alter table reports enable row level security;
create policy "public_read_posts" on community_posts for select to anon using (true);
create policy "public_insert_posts" on community_posts for insert to anon with check (true);
create policy "public_read_comments" on community_comments for select to anon using (true);
create policy "public_insert_comments" on community_comments for insert to anon with check (true);
create policy "public_read_likes" on post_likes for select to anon using (true);
create policy "public_insert_likes" on post_likes for insert to anon with check (true);
create policy "public_read_reports" on reports for select to anon using (true);
create policy "public_insert_reports" on reports for insert to anon with check (true);
