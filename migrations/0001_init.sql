-- 誰デザ 初期スキーマ（Cloudflare D1 / SQLite 版）— 要件定義 v1.1 第7章
--
-- D1(SQLite) には RLS が無いため、匿名性のアクセス制御は「アプリ層（サーバコード）」で
-- 一元的に行う。公開向けの取得は作者・作画者を含まない射影のみを返す（repository/DTO）。
-- 秘匿解除は Result フェーズのみ（src/lib/domain/phase.ts の mayRevealAuthors）。
--
-- ID は基本アプリ側で crypto.randomUUID() を採番。素の INSERT でも埋まるよう
-- DEFAULT にランダム hex を用意しておく。時刻は ISO8601 文字列。

PRAGMA foreign_keys = ON;

-- =====================================================================
-- users: 主催（参加者はトークンベースの一時識別でも可）
-- =====================================================================
create table if not exists users (
  id text primary key default (lower(hex(randomblob(16)))),
  display_name text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- =====================================================================
-- projects: 企画
-- =====================================================================
create table if not exists projects (
  id text primary key default (lower(hex(randomblob(16)))),
  owner_id text not null references users(id) on delete cascade,
  title text not null,
  theme text not null default '',
  description text not null default '',
  phase text not null default 'Draft'
    check (phase in ('Draft','Recruiting','DesignSubmission','Shuffling',
                     'ArtworkSubmission','Voting','Result')),
  is_public integer not null default 0,           -- 0/1
  exclude_artist_guess integer not null default 0, -- 0/1: 作画者を投票候補から除外
  deadline_design text,
  deadline_artwork text,
  deadline_voting text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists idx_projects_owner on projects(owner_id);

-- =====================================================================
-- participations: 企画への参加（個別トークンで識別）
-- =====================================================================
create table if not exists participations (
  id text primary key default (lower(hex(randomblob(16)))),
  project_id text not null references projects(id) on delete cascade,
  user_id text references users(id) on delete set null,
  display_name text not null,
  invite_token text not null unique,
  status text not null default 'invited' check (status in ('invited','joined')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists idx_participations_project on participations(project_id);
create index if not exists idx_participations_token on participations(invite_token);

-- =====================================================================
-- designs: デザイン提出（author_id は秘匿対象）
-- =====================================================================
create table if not exists designs (
  id text primary key default (lower(hex(randomblob(16)))),
  project_id text not null references projects(id) on delete cascade,
  author_id text not null references participations(id) on delete cascade,
  image_key text not null,          -- R2 上のオブジェクトキー
  caption text not null default '',
  difficulty integer not null default 2,           -- 1..3 デザインの難易度（作者申告）
  preferred_difficulty integer not null default 3, -- 1..3 描きたい難易度の上限（希望）
  submitted_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  unique (project_id, author_id)     -- MVP: 1 参加者 1 デザイン
);
create index if not exists idx_designs_project on designs(project_id);

-- =====================================================================
-- assignments: シャッフル割当（作者 ≠ 作画者、1対1）。全て秘匿対象。
-- =====================================================================
create table if not exists assignments (
  id text primary key default (lower(hex(randomblob(16)))),
  project_id text not null references projects(id) on delete cascade,
  design_id text not null references designs(id) on delete cascade,
  design_author_id text not null references participations(id) on delete cascade,
  artist_id text not null references participations(id) on delete cascade,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  unique (project_id, design_id),    -- 1 デザインは 1 割当
  unique (project_id, artist_id),    -- 1 作画者は 1 割当
  check (design_author_id <> artist_id)
);
create index if not exists idx_assignments_project on assignments(project_id);
create index if not exists idx_assignments_artist on assignments(artist_id);

-- =====================================================================
-- artworks: 作画提出（artist_id は秘匿対象）。display_order は固定シャッフル値。
-- =====================================================================
create table if not exists artworks (
  id text primary key default (lower(hex(randomblob(16)))),
  project_id text not null references projects(id) on delete cascade,
  assignment_id text not null unique references assignments(id) on delete cascade,
  design_id text not null references designs(id) on delete cascade,
  artist_id text not null references participations(id) on delete cascade,
  image_key text not null,
  display_order integer not null default 0,
  submitted_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists idx_artworks_project on artworks(project_id);

-- =====================================================================
-- ballots / votes: 投票用紙と各票
-- =====================================================================
create table if not exists ballots (
  id text primary key default (lower(hex(randomblob(16)))),
  project_id text not null references projects(id) on delete cascade,
  voter_participation_id text references participations(id) on delete cascade,
  anonymous_key text,
  submitted_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
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
  id text primary key default (lower(hex(randomblob(16)))),
  ballot_id text not null references ballots(id) on delete cascade,
  artwork_id text not null references artworks(id) on delete cascade,
  guessed_designer_id text not null references participations(id) on delete cascade,
  unique (ballot_id, artwork_id)     -- 1 用紙で 1 作品 1 票
);

-- =====================================================================
-- notifications: サイト内通知
-- =====================================================================
create table if not exists notifications (
  id text primary key default (lower(hex(randomblob(16)))),
  participation_id text not null references participations(id) on delete cascade,
  body text not null,
  read_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists idx_notifications_participation on notifications(participation_id);

-- =====================================================================
-- audit_logs: 匿名性に関わる例外操作（緊急開示 F-29 等）の記録
-- =====================================================================
create table if not exists audit_logs (
  id text primary key default (lower(hex(randomblob(16)))),
  project_id text not null references projects(id) on delete cascade,
  actor text not null,
  action text not null,
  detail text not null default '{}',   -- JSON 文字列
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 公開用の作品ビュー（作者・作画者を含めない）
drop view if exists public_artwork_cards;
create view public_artwork_cards as
select
  a.id            as artwork_id,
  a.project_id    as project_id,
  a.image_key     as image_key,
  a.display_order as display_order,
  d.caption       as caption
from artworks a
join designs d on d.id = a.design_id;
