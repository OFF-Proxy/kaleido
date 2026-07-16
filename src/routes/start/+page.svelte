<script lang="ts">
  // 役割選択の入口。どちらの立場でKaleidoを使うかを最初に選ぶ。
</script>

<div class="mx-auto max-w-2xl">
  <span class="tag"><span>はじめかた</span></span>
  <h1 class="text-3d mt-5 leading-[1.1]" style="font-family: var(--font-display); font-size: clamp(28px, 4.5vw, 44px);">
    どっちで遊ぶ？
  </h1>
  <p class="mt-4 text-[15px]" style="color: var(--color-ink-muted);">
    Kaleido は「主催」して企画を回す人と、「参加」して描く/当てる人がいます。立場を選んでください。
  </p>

  <div class="mt-8 grid gap-4 sm:grid-cols-2">
    <!-- 主催 -->
    <div class="dd-card p-6">
      <div class="text-[40px] leading-none">🎛</div>
      <h2 class="mt-3 text-[20px] font-extrabold" style="font-family: var(--font-display);">主催する</h2>
      <p class="mt-2 text-[13px] leading-relaxed" style="color: var(--color-ink-subtle);">
        企画を作り、募集・シャッフル・投票・結果発表まで進行します。共同ホストを招いて一緒に運営もできます。
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <a href="/organizer/new" class="dd-btn dd-btn-primary" style="font-size: 13px;">＋ 企画を作る</a>
        <a href="/organizer" class="dd-btn dd-btn-secondary" style="font-size: 13px;">主催ダッシュボード</a>
      </div>
    </div>

    <!-- 参加 -->
    <div class="dd-card p-6">
      <div class="text-[40px] leading-none">🎨</div>
      <h2 class="mt-3 text-[20px] font-extrabold" style="font-family: var(--font-display);">参加する</h2>
      <p class="mt-2 text-[13px] leading-relaxed" style="color: var(--color-ink-subtle);">
        主催から届いた<strong style="color: var(--color-ink);">招待リンク</strong>を開くと参加できます。まだリンクが無ければ、公開中の企画をのぞいて投票から楽しめます。
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <a href="/explore" class="dd-btn dd-btn-primary" style="font-size: 13px;">🔎 公開企画をみる</a>
        <a href="/dashboard" class="dd-btn dd-btn-secondary" style="font-size: 13px;">参加者ダッシュボード</a>
      </div>
    </div>
  </div>

  <p class="mt-6 text-[12px]" style="color: var(--color-ink-faint);">
    ※ 招待リンク（<code>/join/…</code>）を開くと自動的に参加者としてログインします。共同ホストのリンク（<code>/org-join/…</code>）は主催メンバーとして参加します。
  </p>
</div>
