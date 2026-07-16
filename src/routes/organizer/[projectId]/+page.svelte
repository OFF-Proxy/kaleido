<script lang="ts">
  import { enhance } from "$app/forms";
  import { page } from "$app/stores";
  import type { PageData, ActionData } from "./$types.js";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const o = $derived(data.overview);
  const origin = $derived($page.url.origin);
  const diffLabel = ["", "かんたん", "ふつう", "むずかしい"];

  async function copyInvite(token: string) {
    try {
      await navigator.clipboard.writeText(`${origin}/join/${token}`);
    } catch {
      /* noop */
    }
  }

  async function copyCohost() {
    if (!data.cohostInvitePath) return;
    try {
      await navigator.clipboard.writeText(`${origin}${data.cohostInvitePath}`);
    } catch {
      /* noop */
    }
  }
</script>

<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
  <span class="banner">
    <span class="dd-eyebrow" style="color: #fff;">ORGANIZER</span>
    <span style="font-family: var(--font-display); font-size: 18px;">主催ダッシュボード</span>
  </span>
  <span class="text-[14px]" style="color: var(--color-ink-subtle);">
    {o.project.title} ・ {o.project.theme}
  </span>
</div>

{#if form?.done}
  <div class="mt-6 p-3 text-[14px] font-bold" style="background: color-mix(in srgb, var(--color-shock) 16%, var(--color-surface-1)); border: 2px solid var(--color-shock); border-radius: var(--radius-md); color: var(--color-ink);">
    {form.done}
  </div>
{/if}
{#if form?.message}
  <div class="mt-6 p-3 text-[14px] font-bold" style="background: color-mix(in srgb, var(--color-danger) 14%, var(--color-surface-1)); border: 2px solid var(--color-danger); border-radius: var(--radius-md); color: var(--color-ink);">
    {form.message}
  </div>
{/if}

<!-- フェーズ制御 -->
<section class="dd-card mt-8 p-5">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h2 class="text-[16px] font-bold">進行フェーズ</h2>
    <div class="flex gap-2">
      <form method="POST" action="?/rewind" use:enhance>
        <button class="dd-btn dd-btn-secondary" style="padding: 6px 12px; font-size: 13px;">← 戻す</button>
      </form>
      <form
        method="POST"
        action="?/advance"
        use:enhance={({ cancel }) => {
          if (
            !confirm("フェーズを次に進めますか？（「← 戻す」でいつでも戻せます）")
          )
            cancel();
        }}
      >
        <button class="dd-btn dd-btn-primary" style="padding: 6px 14px; font-size: 13px;">次へ →</button>
      </form>
    </div>
  </div>
  <ol class="mt-4 flex flex-wrap items-center gap-2">
    {#each data.phases as p, i (p.key)}
      <li class="flex items-center gap-2">
        <span
          class="rounded-[4px] px-3 py-1.5 text-[13px] font-bold"
          style={p.current
            ? "background: var(--color-shock); color: var(--color-on-shock);"
            : "background: var(--color-surface-2); color: var(--color-ink-subtle); border: 1px solid var(--color-hairline-strong);"}
        >
          {p.label}
        </span>
        {#if i < data.phases.length - 1}
          <span style="color: var(--color-ink-faint);">→</span>
        {/if}
      </li>
    {/each}
  </ol>
</section>

<!-- 主催メンバー -->
<section class="dd-card mt-6 p-5">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h2 class="text-[16px] font-bold">主催メンバー</h2>
    {#if data.myRole}
      <span class="dd-chip">あなた: {data.myRole === "owner" ? "オーナー" : "共同ホスト"}</span>
    {:else}
      <span class="text-[12px]" style="color: var(--color-ink-faint);">
        あなたはこの企画の主催として認識されていません（閲覧）
      </span>
    {/if}
  </div>
  <div class="mt-3 flex flex-wrap gap-2">
    {#each data.organizers as o (o.userId)}
      <span class="tag {o.role === 'owner' ? 'tag-violet' : ''}" style="font-size: 12px; padding: 3px 10px;">
        <span>{o.role === "owner" ? "👑 " : "🤝 "}{o.displayName}</span>
      </span>
    {/each}
  </div>
  {#if data.cohostInvitePath}
    <div class="mt-4">
      <div class="dd-eyebrow" style="color: var(--color-ink-subtle);">共同ホストを招待</div>
      <p class="mt-1 text-[12px]" style="color: var(--color-ink-faint);">
        このリンクを渡すと、相手は名前を入力して共同ホストとして参加できます。
      </p>
      <div class="mt-2 flex w-full items-center gap-2">
        <code
          class="min-w-0 flex-1 truncate rounded-[3px] px-2 py-1 text-[12px]"
          style="background: var(--color-canvas); color: var(--color-ink-subtle);"
        >
          {origin}{data.cohostInvitePath}
        </code>
        <button
          type="button"
          class="dd-btn dd-btn-secondary shrink-0"
          style="padding: 4px 10px; font-size: 12px;"
          onclick={copyCohost}
        >
          コピー
        </button>
      </div>
    </div>
  {/if}
</section>

<!-- 提出状況カウンタ -->
<div class="mt-6 grid gap-4" style={`grid-template-columns: repeat(${data.isEgaraate ? 2 : 3}, minmax(0, 1fr));`}>
  {#each data.isEgaraate ? [{ l: "参加者", v: o.counts.participants }, { l: "作品提出", v: o.counts.artworks }] : [{ l: "参加者", v: o.counts.participants }, { l: "デザイン提出", v: o.counts.designs }, { l: "作画提出", v: o.counts.artworks }] as c (c.l)}
    <div class="dd-card p-4">
      <div class="font-mono text-[12px]" style="color: var(--color-ink-subtle);">{c.l}</div>
      <div class="mt-1 text-[30px] font-extrabold" style="font-family: var(--font-en); color: var(--color-shock);">
        {c.v}
      </div>
    </div>
  {/each}
</div>

{#if data.isEgaraate}
<!-- 絵柄当て: シャッフル無し。提出と投票の導線のみ。 -->
<section class="dd-card mt-6 p-5">
  <h2 class="text-[16px] font-bold">絵柄当ての進行</h2>
  <p class="mt-1 text-[13px]" style="color: var(--color-ink-subtle);">
    各参加者が自分の絵柄で1枚提出 → 投票で「誰が描いたか」を当てます。デザイン提出・シャッフルはありません。
  </p>
  <div class="mt-4 flex flex-wrap gap-2">
    <a href={`/vote?p=${o.project.id}`} class="dd-btn dd-btn-secondary" style="padding: 6px 12px; font-size: 13px;">▶ 投票ページ</a>
    <a href={`/result?p=${o.project.id}`} class="dd-btn dd-btn-secondary" style="padding: 6px 12px; font-size: 13px;">結果ページ</a>
  </div>
</section>
{:else}
<!-- シャッフル & 設定 -->
<section class="dd-card mt-6 p-5">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="text-[16px] font-bold">シャッフル（自動割当）</h2>
      <p class="mt-1 text-[13px]" style="color: var(--color-ink-subtle);">
        提出済みで「作者 ≠ 作画者」の割当を生成します。
        {#if !data.canShuffle}
          <span style="color: var(--color-warning);">作品提出後はロック（作品を守るため）。</span>
        {:else}
          作品提出前なら何度でも再実行できます。
        {/if}
      </p>
    </div>
    <form method="POST" action="?/shuffle" use:enhance>
      <button class="dd-btn dd-btn-primary" disabled={!data.canShuffle}>
        🔀 シャッフル実行
      </button>
    </form>
  </div>

  <form method="POST" action="?/toggleArtist" use:enhance class="mt-4 flex items-center gap-3">
    <input type="hidden" name="value" value={o.project.excludeArtistGuess ? "off" : "on"} />
    <span class="text-[13px]" style="color: var(--color-ink-muted);">
      作画者を投票候補から除外:
      <strong style="color: {o.project.excludeArtistGuess ? 'var(--color-shock)' : 'var(--color-ink-faint)'};">
        {o.project.excludeArtistGuess ? "ON" : "OFF"}
      </strong>
    </span>
    <button class="dd-btn dd-btn-secondary" style="padding: 5px 12px; font-size: 13px;">
      {o.project.excludeArtistGuess ? "OFFにする" : "ONにする"}
    </button>
  </form>

  {#if o.matching}
    <div class="mt-5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="dd-eyebrow" style="color: var(--color-ink-subtle);">MATCHING（匿名）</div>
        {#if o.preferenceSatisfied}
          <span class="dd-chip">
            希望充足 {o.preferenceSatisfied.ok}/{o.preferenceSatisfied.total}
          </span>
        {/if}
      </div>
      <p class="mt-1 text-[12px]" style="color: var(--color-ink-faint);">
        匿名ラベルで割当のみ確認（作者は主催にも伏せる）。難易度＞希望の割当は ⚠ で警告。
      </p>
      <div class="mt-3 grid gap-2 sm:grid-cols-2">
        {#each o.matching as m, i (i)}
          <div
            class="flex items-center gap-2 rounded-[4px] px-3 py-2 text-[13px]"
            style={`background: var(--color-surface-2); border: 1px solid ${m.satisfied ? "var(--color-hairline-strong)" : "var(--color-warning)"};`}
          >
            <span class="font-mono" style="color: var(--color-ink-muted);">{m.designLabel}</span>
            <span class="text-[11px]" style="color: var(--color-ink-faint);">
              [{diffLabel[m.designDifficulty]}]
            </span>
            <span style="color: var(--color-accent);">→</span>
            <span class="font-mono" style="color: var(--color-shock);">{m.artistLabel}</span>
            <span class="ml-auto text-[13px]">
              {m.satisfied ? "✓" : "⚠"}
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</section>
{/if}

<!-- 参加者名簿 & 招待リンク -->
<section class="dd-card mt-6 p-5">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h2 class="text-[16px] font-bold">参加者と招待リンク</h2>
    <form method="POST" action="?/nudge" use:enhance>
      <button class="dd-btn dd-btn-secondary" style="padding: 6px 12px; font-size: 13px;">
        🔔 未提出者に催促
      </button>
    </form>
  </div>
  <div class="mt-4 overflow-hidden rounded-[4px] border" style="border-color: var(--color-hairline-strong);">
    {#each o.roster as r, i (r.inviteToken)}
      <div
        class="flex flex-wrap items-center gap-3 px-4 py-3 text-[14px]"
        style={`background: ${i % 2 ? "var(--color-surface-1)" : "var(--color-surface-2)"};`}
      >
        <span class="min-w-[70px] font-bold">{r.displayName}</span>
        {#if !data.isEgaraate}
          <span class="font-mono text-[12px]" style="color: {r.submittedDesign ? 'var(--color-success)' : 'var(--color-ink-faint)'};">
            {r.submittedDesign ? "✔ デザイン" : "✗ デザイン"}
          </span>
        {/if}
        <span class="font-mono text-[12px]" style="color: {r.submittedArtwork ? 'var(--color-success)' : 'var(--color-ink-faint)'};">
          {r.submittedArtwork ? (data.isEgaraate ? "✔ 作品" : "✔ 作画") : (data.isEgaraate ? "✗ 作品" : "✗ 作画")}
        </span>
        <div class="flex w-full min-w-0 items-center gap-2 sm:ml-auto sm:w-auto">
          <code
            class="min-w-0 flex-1 truncate rounded-[3px] px-2 py-1 text-[12px] sm:max-w-[260px] sm:flex-none"
            style="background: var(--color-canvas); color: var(--color-ink-subtle);"
          >
            {origin}/join/{r.inviteToken}
          </code>
          <button
            type="button"
            class="dd-btn dd-btn-secondary shrink-0"
            style="padding: 4px 10px; font-size: 12px;"
            onclick={() => copyInvite(r.inviteToken)}
          >
            コピー
          </button>
        </div>
      </div>
    {/each}
  </div>
</section>
