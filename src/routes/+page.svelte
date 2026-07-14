<script lang="ts">
  import type { PageData } from "./$types.js";
  let { data }: { data: PageData } = $props();

  const steps = [
    { n: "01", t: "募集", d: "テーマを決めて招待リンクで参加者を集める", pop: "dd-pop-lilac" },
    { n: "02", t: "デザイン", d: "各自がお題に沿ってキャラを匿名で提出", pop: "dd-pop-pink" },
    { n: "03", t: "シャッフル", d: "自分に当たらない条件で自動割当（目玉機能）", pop: "dd-pop-blue" },
    { n: "04", t: "作画", d: "受け取ったデザインを別の人が作画", pop: "dd-pop-mint" },
    { n: "05", t: "投票", d: "作者を伏せた一覧で「誰がデザインしたか」を推理", pop: "dd-pop-amber" },
    { n: "06", t: "結果発表", d: "答え合わせと正解率ランキング", pop: "dd-pop-coral" },
  ];

  const tickerItems = ["誰デザ", "お絵描き企画", "みんなで当てっこ", "匿名でわいわい", "作者は誰だ"];
  const ticker = tickerItems.join("　✦　") + "　✦　";

  // ヒーローの作品"手札"（扇状に重ねる位置・回転）
  const fan = [
    "left: 0%;  top: 16%; transform: rotate(-9deg); z-index: 3;",
    "left: 24%; top: 0;   transform: rotate(4deg);  z-index: 2;",
    "left: 46%; top: 20%; transform: rotate(14deg); z-index: 1;",
  ];
</script>

<!-- HERO -->
<section class="grid items-center gap-6 pt-2 pb-2 lg:grid-cols-[1.25fr_0.75fr]">
  <div>
    <span class="tag"><span>お絵描き企画プラットフォーム</span></span>

    <h1
      class="text-3d mt-7 leading-[1.08]"
      style="font-family: var(--font-display); font-size: clamp(34px, 5vw, 60px);"
    >
      イラスト企画で、<br />
      <span class="text-3d-shock">遊び倒せ。</span>
    </h1>

    <p class="mt-7 max-w-xl text-[16px] leading-relaxed" style="color: var(--color-ink-muted);">
      <span class="dd-eyebrow">Kaleido</span> は、絵師どうしのお題企画をまるごと回せるプラットフォーム。募集・シャッフル・作画・投票・結果発表まで1か所で。第一弾は「誰がデザインしたか」を当てる<span
        style="color: var(--color-shock); font-weight: 700;">誰デザ</span
      >。
    </p>

    <div class="mt-8 flex flex-wrap gap-3">
      <a href="/organizer/new" class="dd-btn dd-btn-primary">＋ 企画を主催する</a>
      <a href="/organizer" class="dd-btn dd-btn-secondary">🎛 主催ダッシュボード</a>
      <a href="/vote?p=demo-daredeza" class="dd-btn dd-btn-secondary">▶ 投票をみる</a>
    </div>

    <div
      class="cut mt-7 inline-flex flex-wrap items-center gap-2 border p-3"
      style="border-color: var(--color-hairline-strong); background: var(--color-surface-1);"
    >
      <span class="dd-eyebrow" style="color: var(--color-ink-subtle);">DEMO</span>
      <span class="text-[13px]" style="color: var(--color-ink-muted);">参加者ログイン →</span>
      {#each data.invites as inv (inv.token)}
        <a
          href={`/join/${inv.token}`}
          class="dd-btn dd-btn-secondary"
          style="padding: 5px 12px; font-size: 13px;"
        >
          {inv.name}
        </a>
      {/each}
    </div>
  </div>

  <!-- 作品の手札（右） -->
  <div class="relative hidden h-[420px] lg:block">
    {#each data.heroArt as src, i (i)}
      <img
        src={src}
        alt="サンプル作品"
        class="absolute aspect-[4/5] w-[172px] rounded-[4px] object-cover"
        style={`border: 2px solid var(--color-hairline-strong); box-shadow: 0 14px 30px rgba(0,0,0,0.55); ${fan[i]}`}
      />
    {/each}
    <div
      class="float absolute grid h-[70px] w-[70px] place-items-center rounded-full text-[34px]"
      style="left: -2%; top: 4%; z-index: 5; background: var(--color-shock); color: var(--color-on-shock); box-shadow: 0 6px 0 var(--color-shock-deep); font-family: var(--font-display);"
    >
      ?
    </div>
    <span
      class="tag tag-violet absolute"
      style="left: 4%; top: 58%; z-index: 6; font-size: 18px; padding: 0.6rem 1.2rem; box-shadow: 0 6px 0 var(--color-accent-deep), 0 10px 18px rgba(0,0,0,0.5);"
    >
      <span>作者は誰だ？</span>
    </span>
  </div>
</section>

<!-- MARQUEE -->
<div
  class="marquee -mx-5 mt-12 border-y py-3"
  style="border-color: var(--color-hairline-strong); color: var(--color-shock);"
>
  <div class="marquee-track">
    <span>{ticker}{ticker}{ticker}</span><span>{ticker}{ticker}{ticker}</span>
  </div>
</div>

<!-- GAMES: 遊べるゲーム一覧 -->
<section class="mt-14">
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
    <span class="banner">
      <span class="dd-eyebrow" style="color: #fff;">GAMES</span>
      <span style="font-family: var(--font-display); font-size: 20px;">遊べるゲーム</span>
    </span>
    <span class="text-[13px]" style="color: var(--color-ink-subtle);">デモをすぐ体験できます</span>
  </div>

  <div class="mt-5 grid gap-4 sm:grid-cols-2">
    <!-- 誰デザ -->
    <div class="dd-card p-5">
      <div class="flex items-center gap-2">
        <span class="tag tag-violet"><span>誰デザ</span></span>
        <span class="text-[12px]" style="color: var(--color-ink-faint);">デザイナーを当てる</span>
      </div>
      <p class="mt-3 text-[14px] leading-relaxed" style="color: var(--color-ink-muted);">
        お題でキャラをデザイン → 他の人が作画 → 誰がデザインしたかを当てる。
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <a href="/vote?p=demo-daredeza" class="dd-btn dd-btn-primary" style="font-size: 13px;">▶ 投票デモ</a>
        <a href="/result?p=demo-daredeza" class="dd-btn dd-btn-secondary" style="font-size: 13px;">結果を見る</a>
      </div>
    </div>

    <!-- 絵柄当て -->
    <div class="dd-card p-5">
      <div class="flex items-center gap-2">
        <span class="tag"><span>絵柄当て</span></span>
        <span class="text-[12px]" style="color: var(--color-ink-faint);">描いた人を当てる</span>
      </div>
      <p class="mt-3 text-[14px] leading-relaxed" style="color: var(--color-ink-muted);">
        各自が自分の絵柄で1枚描く → 誰が描いたかを絵柄から推理して当てる。
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <a href="/vote?p=demo-egaraate" class="dd-btn dd-btn-primary" style="font-size: 13px;">▶ 投票デモ</a>
        <a href="/result?p=demo-egaraate" class="dd-btn dd-btn-secondary" style="font-size: 13px;">結果を見る</a>
      </div>
    </div>
  </div>
</section>

<!-- NOW PLAYING: 誰デザ -->
<section class="mt-14">
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
    <span class="banner">
      <span class="dd-eyebrow" style="color: #fff;">NOW PLAYING</span>
      <span style="font-family: var(--font-display); font-size: 20px;">誰デザ</span>
    </span>
    <span class="text-[13px]" style="color: var(--color-ink-subtle);">
      誰がデザインしたかを当てる
    </span>
  </div>

  <div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each steps as s (s.n)}
      <div class={`dd-pop ${s.pop} p-5`}>
        <div class="dd-pop-num text-[42px] leading-none">{s.n}</div>
        <div class="mt-3 text-[19px] font-bold" style="color: var(--color-ink);">
          {s.t}
        </div>
        <p class="mt-1 text-[14px] leading-relaxed" style="color: var(--color-ink-muted);">
          {s.d}
        </p>
      </div>
    {/each}
  </div>
</section>
