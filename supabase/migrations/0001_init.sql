-- 誰デザ 初期スキーマ（要件定義 v1.1 第7章）
-- Postgres / Supabase 向け。匿名性の担保はアプリ層のサーバコード＋本 RLS の二重防御。
--
-- 重要な前提:
--   * 参加者・観覧者向けの読み取りは基本的に anon ロールでは行わせず、
--     サーバ（service_role キー）経由でアクセス制御する設計を既定とする。
--   * したがって全テーブルで RLS を有効化し、既定は「全拒否」。
--     公開して良いデータだけ anon 向けポリシーで明示的に許可する。
--   * 「作者⇔提出物」の対応（designs.author_id / assignments.* / artworks.artist_id）は
--     anon には一切公開しない。結果発表の開示はサーバが Result フェーズを確認して行う。

-- 拡張
create extension if not exists "pgcrypto";

-- フェーズ列挙
do $$ begin
  create type phase as enum (
    'Draft','Recruiting','DesignSubmission','Shuffling',
    'ArtworkSubmission','Voting','Result'
  );
exception when duplicate_object then null; end $$;

-- 参加状態
do $$ begin
  create type participation_status as enum ('invited','joined');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- users: 主催（参加者はトークンベースの一時識別でも可）
-- =====================================================================
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- projects: 企画
-- =====================================================================
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  title text not null,
  theme text not null default '',
  description text not null default '',
  phase phase not null default 'Draft',
  is_public boolean not null default false,
  deadline_design timestamptz,
  deadline_artwork timestamptz,
  deadline_voting timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_projects_owner on projects(owner_id);

-- =====================================================================
-- participations: 企画への参加（個別トークンで識別）
--   invite_token は参加者ごとに一意。招待リンクに載る秘密値。
-- =====================================================================
create table if not exists participations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  display_name text not null,
  invite_token text not null unique,
  status participation_status not null default 'invited',
  created_at timestamptz not null default now()
);
create index if not exists idx_participations_project on participations(project_id);
create index if not exists idx_participations_token on participations(invite_token);

-- =====================================================================
-- designs: デザイン提出（author_id は秘匿対象）
-- =====================================================================
create table if not exists designs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  author_id uuid not null references participations(id) on delete cascade,
  image_path text not null,          -- Storage 上のパス
  caption text not null default '',
  submitted_at timestamptz not null default now(),
  unique (project_id, author_id)     -- MVP: 1 参加者 1 デザイン
);
create index if not exists idx_designs_project on designs(project_id);

-- =====================================================================
-- assignments: シャッフル割当（作者 ≠ 作画者、1対1）。全て秘匿対象。
-- =====================================================================
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  design_id uuid not null references designs(id) on delete cascade,
  design_author_id uuid not null references participations(id) on delete cascade,
  artist_id uuid not null references participations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, design_id),    -- 1 デザインは 1 割当
  unique (project_id, artist_id),    -- 1 作画者は 1 割当
  constraint author_ne_artist check (design_author_id <> artist_id)
);
create index if not exists idx_assignments_project on assignments(project_id);
create index if not exists idx_assignments_artist on assignments(artist_id);

-- =====================================================================
-- artworks: 作画提出（artist_id は秘匿対象）
-- =====================================================================
create table if not exists artworks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  assignment_id uuid not null unique references assignments(id) on delete cascade,
  design_id uuid not null references designs(id) on delete cascade,
  artist_id uuid not null references participations(id) on delete cascade,
  image_path text not null,
  -- 表示順は提出順を漏らさないため保存時に固定シャッフルした値を持つ
  display_order int not null default 0,
  submitted_at timestamptz not null default now()
);
create index if not exists idx_artworks_project on artworks(project_id);

-- =====================================================================
-- ballots / votes: 投票用紙と各票
--   参加者票は voter_participation_id、観覧者票は anonymous_key。
--   1 参加者につき投票用紙は 1 枚（部分ユニーク制約で担保）。
-- =====================================================================
create table if not exists ballots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  voter_participation_id uuid references participations(id) on delete cascade,
  anonymous_key text,
  submitted_at timestamptz not null default now(),
  check (
    (voter_participation_id is not null and anonymous_key is null) or
    (voter_participation_id is null and anonymous_key is not null)
  )
);
-- 参加者は 1 企画 1 投票用紙
create unique index if not exists uq_ballot_participant
  on ballots(project_id, voter_participation_id)
  where voter_participation_id is not null;
-- 観覧者はセッション鍵で 1 企画 1 用紙（ゆるい抑止）
create unique index if not exists uq_ballot_anon
  on ballots(project_id, anonymous_key)
  where anonymous_key is not null;

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  ballot_id uuid not null references ballots(id) on delete cascade,
  artwork_id uuid not null references artworks(id) on delete cascade,
  guessed_designer_id uuid not null references participations(id) on delete cascade,
  unique (ballot_id, artwork_id)     -- 1 用紙で 1 作品 1 票
);

-- =====================================================================
-- notifications: サイト内通知
-- =====================================================================
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  participation_id uuid not null references participations(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_participation on notifications(participation_id);

-- =====================================================================
-- audit_logs: 匿名性に関わる例外操作（緊急開示 F-29 等）の記録
-- =====================================================================
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  actor text not null,
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Row Level Security: 既定は全拒否。サーバ(service_role)は RLS を
-- バイパスするため、通常のデータアクセスはサーバ経由で行う。
-- anon には「公開して安全なもの」だけを明示許可する。
-- =====================================================================
alter table users            enable row level security;
alter table projects         enable row level security;
alter table participations   enable row level security;
alter table designs          enable row level security;
alter table assignments      enable row level security;
alter table artworks         enable row level security;
alter table ballots          enable row level security;
alter table votes            enable row level security;
alter table notifications    enable row level security;
alter table audit_logs       enable row level security;

-- 公開企画のメタ情報のみ anon に読み取り許可（作者情報は含まれない列のみ）
drop policy if exists anon_read_public_projects on projects;
create policy anon_read_public_projects on projects
  for select to anon
  using (is_public = true);

-- 注意: designs.author_id / assignments.* / artworks.artist_id といった
-- 「正解データ」は anon 向けポリシーを一切作らない = 既定の全拒否のまま。
-- これらの取得は必ずサーバ（service_role）経由で、フェーズを検証して行う。
-- artworks の画像・表示順を投票フェーズで見せる場合も、author/artist を
-- 除いた射影をサーバが返す（View もしくはアプリ層の DTO 変換）。

-- 便利: 公開用の作品ビュー（作者・作画者を含めない）
create or replace view public_artwork_cards as
select
  a.id           as artwork_id,
  a.project_id   as project_id,
  a.image_path   as image_path,
  a.display_order as display_order,
  d.caption      as caption
from artworks a
join designs d on d.id = a.design_id;
