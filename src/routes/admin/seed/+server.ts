import { json } from "@sveltejs/kit";
import { seededRng } from "$lib/domain/rng.js";
import { generatePreferredAssignments } from "$lib/domain/shuffle.js";
import type { RequestHandler } from "./$types.js";

// デモの土台（インメモリ版と同じ内容をD1に投入する）
const NAMES = ["ネオ", "墨丸", "ルカ", "あおい", "蓮", "ざくろ", "つむぎ", "玄"];
const CAPTIONS = [
  "電脳提灯を背負う雨の妖狐。ネオン色の尾が九本。",
  "廃神社に棲むブラウザ管狐。目はスキャンライン。",
  "唐傘お化けドローン。骨はカーボン、和紙は有機EL。",
  "河童のダイバー。甲羅は放熱フィン、皿は冷却水。",
  "ろくろ首の配信者。首がLANケーブルのように伸びる。",
  "鵺のサイボーグ。四獣のパーツを換装式で組み替える。",
  "雪女のアンドロイド。吐息で機器を強制冷却する。",
  "百目の監視AI。無数のレンズが提灯行列のように灯る。",
];
const DIFF = [3, 2, 1, 3, 2, 1, 2, 3];
const COMFORT = [1, 3, 2, 3, 1, 2, 3, 2];
const PID = "demo-daredeza";
const UID = "u-demo";

function art(seed: number, kind: "design" | "artwork"): string {
  const hue = (seed * 47) % 360;
  const hue2 = (hue + 45) % 360;
  const sat = kind === "artwork" ? 78 : 62;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1000'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue} ${sat}% 74%)'/><stop offset='1' stop-color='hsl(${hue2} ${sat}% 60%)'/></linearGradient></defs><rect width='800' height='1000' fill='url(#g)'/><circle cx='${200 + (seed % 400)}' cy='${300 + (seed % 300)}' r='190' fill='hsl(${hue2} 90% 88% / 0.55)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function shuffleIdx(n: number, rng: ReturnType<typeof seededRng>): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

export const GET: RequestHandler = async ({ platform, url }) => {
  const db = platform?.env?.DB;
  if (!db) return json({ ok: false, reason: "platform.env.DB が無い" });

  // ?reset=1 でデモ企画を作り直す（連鎖削除で関連データも消える）
  if (url.searchParams.has("reset")) {
    await db.prepare("DELETE FROM projects WHERE id=?").bind(PID).run();
  }

  const existing = await db
    .prepare("SELECT count(*) AS n FROM projects WHERE id=?")
    .bind(PID)
    .first<{ n: number }>();
  if ((existing?.n ?? 0) > 0) {
    return json({
      ok: true,
      note: "既にシード済み（作り直すなら /admin/seed?reset=1）",
      projects: existing?.n,
    });
  }

  const now = new Date().toISOString();
  const ids = NAMES.map((_, i) => `p${i + 1}`);
  const s: D1PreparedStatement[] = [];

  s.push(
    db
      .prepare(
        "INSERT OR IGNORE INTO users (id, display_name, created_at) VALUES (?,?,?)",
      )
      .bind(UID, "主催デモ", now),
  );
  s.push(
    db
      .prepare(
        "INSERT INTO projects (id, owner_id, title, theme, description, phase, game_type, visibility, is_public, exclude_artist_guess, deadline_voting, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        PID,
        UID,
        "第7回 誰デザ",
        "サイバーパンクな和風妖怪",
        "お題に沿ってキャラをデザインし、他の誰かが作画。誰がデザインしたかを当てよう。",
        "Voting",
        "daredeza",
        "public",
        1,
        1,
        "2026-07-12T23:59:00+09:00",
        now,
      ),
  );
  s.push(
    db
      .prepare(
        "INSERT INTO project_organizers (project_id, user_id, role, created_at) VALUES (?,?,?,?)",
      )
      .bind(PID, UID, "owner", now),
  );

  // 参加者
  for (let i = 0; i < 8; i++) {
    s.push(
      db
        .prepare(
          "INSERT INTO participations (id, project_id, user_id, display_name, invite_token, status, created_at) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(`p${i + 1}`, PID, null, NAMES[i], `tok-p${i + 1}`, "joined", now),
    );
  }

  // デザイン
  for (let i = 0; i < 8; i++) {
    s.push(
      db
        .prepare(
          "INSERT INTO designs (id, project_id, author_id, image_key, caption, difficulty, preferred_difficulty, submitted_at) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          `d${i + 1}`,
          PID,
          `p${i + 1}`,
          art(i * 37 + 11, "design"),
          CAPTIONS[i],
          DIFF[i],
          COMFORT[i],
          now,
        ),
    );
  }

  // 希望シャッフルで割当を生成
  const pref = generatePreferredAssignments(
    ids.map((pid, i) => ({
      participantId: pid,
      designDifficulty: DIFF[i]!,
      artistComfort: COMFORT[i]!,
    })),
    { rng: seededRng(7) },
  );
  const artistOf = new Map<string, string>();
  for (const a of pref.assignments) artistOf.set(a.designAuthorId, a.artistId);

  for (let i = 0; i < 8; i++) {
    const author = `p${i + 1}`;
    const artist = artistOf.get(author)!;
    s.push(
      db
        .prepare(
          "INSERT INTO assignments (id, project_id, design_id, design_author_id, artist_id, created_at) VALUES (?,?,?,?,?,?)",
        )
        .bind(`as${i + 1}`, PID, `d${i + 1}`, author, artist, now),
    );
  }

  // 作品（表示順は固定シャッフル）
  const order = shuffleIdx(8, seededRng(99));
  for (let i = 0; i < 8; i++) {
    const artist = artistOf.get(`p${i + 1}`)!;
    s.push(
      db
        .prepare(
          "INSERT INTO artworks (id, project_id, assignment_id, design_id, artist_id, image_key, caption, display_order, submitted_at) VALUES (?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          `a${i + 1}`,
          PID,
          `as${i + 1}`,
          `d${i + 1}`,
          artist,
          art(i * 53 + 5, "artwork"),
          "",
          order.indexOf(i),
          now,
        ),
    );
  }

  // 投票（デモ。ネオ=p1 は自分で投票する想定なので除外）
  let ballotSeq = 1;
  let voteSeq = 1;
  for (let vi = 0; vi < 8; vi++) {
    const voter = `p${vi + 1}`;
    if (voter === "p1") continue;
    const rng = seededRng(1000 + vi);
    const skill = 0.35 + vi * 0.07;
    const bid = `b${ballotSeq++}`;
    s.push(
      db
        .prepare(
          "INSERT INTO ballots (id, project_id, voter_participation_id, anonymous_key, submitted_at) VALUES (?,?,?,?,?)",
        )
        .bind(bid, PID, voter, null, now),
    );
    for (let ai = 0; ai < 8; ai++) {
      const trueDesigner = `p${ai + 1}`;
      if (trueDesigner === voter) continue; // 自作品は投票しない
      const guess = rng.next() < skill ? trueDesigner : `p${rng.nextInt(8) + 1}`;
      s.push(
        db
          .prepare(
            "INSERT INTO votes (id, ballot_id, artwork_id, guessed_designer_id) VALUES (?,?,?,?)",
          )
          .bind(`v${voteSeq++}`, bid, `a${ai + 1}`, guess),
      );
    }
  }

  await db.batch(s);

  return json({
    ok: true,
    seeded: true,
    participants: 8,
    designs: 8,
    artworks: 8,
    votes: voteSeq - 1,
  });
};
