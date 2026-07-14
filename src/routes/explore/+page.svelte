<script lang="ts">
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  // サーバー専用モジュールを import せず、PageData から要素型を導出する
  type ProjectCard = PageData["voting"][number];

  let q = $state(data.filter);

  const gameLabel = (g: string) => (g === "egaraate" ? "絵柄当て" : "誰デザ");
</script>

{#snippet card(p: ProjectCard, kind: "vote" | "recruit" | "result")}
  <article class="dd-card p-5">
    <div class="flex flex-wrap items-center gap-2">
      <span class="tag {p.gameType === 'egaraate' ? '' : 'tag-violet'}" style="font-size: 11px; padding: 2px 8px;">
        <span>{gameLabel(p.gameType)}</span>
      </span>
      {#if p.visibility === "restricted"}
        <span class="dd-chip" style="font-size: 11px;">界隈限定</span>
      {/if}
      {#if p.genre}
        <span class="font-mono text-[11px]" style="color: var(--color-ink-faint);">#{p.genre}</span>
      {/if}
      {#if p.circle}
        <span class="font-mono text-[11px]" style="color: var(--color-ink-faint);">@{p.circle}</span>
      {/if}
    </div>

    <div class="mt-3 text-[18px] font-bold" style="color: var(--color-ink);">{p.title}</div>
    <div class="mt-1 text-[13px]" style="color: var(--color-ink-subtle);">{p.theme}</div>

    <div class="mt-3 flex items-center gap-3 font-mono text-[12px]" style="color: var(--color-ink-faint);">
      <span>{p.participants}人参加</span>
      {#if p.artworks > 0}<span>・ {p.artworks}作品</span>{/if}
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      {#if kind === "vote"}
        {#if p.viewerVotable}
          <a href={`/vote?p=${p.id}`} class="dd-btn dd-btn-primary" style="font-size: 13px;">▶ 投票する</a>
        {:else}
          <a href={`/vote?p=${p.id}`} class="dd-btn dd-btn-secondary" style="font-size: 13px;">作品を見る</a>
          <span class="self-center text-[11px]" style="color: var(--color-ink-faint);">投票は参加者限定</span>
        {/if}
      {:else if kind === "result"}
        <a href={`/result?p=${p.id}`} class="dd-btn dd-btn-primary" style="font-size: 13px;">結果を見る</a>
      {:else}
        <span class="dd-chip" style="font-size: 12px;">募集中</span>
        <span class="self-center text-[12px]" style="color: var(--color-ink-faint);">投票開始までお待ちください</span>
      {/if}
    </div>
  </article>
{/snippet}

<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
  <span class="banner">
    <span class="dd-eyebrow" style="color: #fff;">EXPLORE</span>
    <span style="font-family: var(--font-display); font-size: 18px;">みんなの企画</span>
  </span>
  <span class="text-[13px]" style="color: var(--color-ink-subtle);">公開中の企画をのぞいて投票しよう</span>
</div>

<!-- ジャンル/界隈フィルタ -->
<form method="GET" class="mt-6 flex flex-wrap items-center gap-2">
  <input
    name="q"
    bind:value={q}
    placeholder="ジャンル・界隈で絞り込む（界隈限定も表示）"
    class="min-w-0 flex-1 px-3 py-2 text-[14px] sm:max-w-md"
    style="background: var(--color-surface-2); border: 1px solid var(--color-hairline-strong); color: var(--color-ink); border-radius: 4px;"
  />
  <button class="dd-btn dd-btn-secondary" style="font-size: 13px;">絞り込む</button>
  {#if data.filter}
    <a href="/explore" class="dd-btn dd-btn-ghost" style="font-size: 13px;">クリア</a>
  {/if}
</form>

{#if data.filter}
  <p class="mt-2 text-[12px]" style="color: var(--color-ink-faint);">
    「{data.filter}」で絞り込み中（一致する界隈限定の企画も表示）
  </p>
{/if}

{#if data.total === 0}
  <div class="dd-card mt-8 p-6 text-[14px]" style="color: var(--color-ink-subtle);">
    公開中の企画がまだありません。
    {#if data.filter}別のキーワードでも試してみてください。{/if}
  </div>
{/if}

{#if data.voting.length > 0}
  <section class="mt-8">
    <h2 class="text-[15px] font-bold" style="color: var(--color-shock);">🗳 投票中</h2>
    <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.voting as p (p.id)}
        {@render card(p, "vote")}
      {/each}
    </div>
  </section>
{/if}

{#if data.recruiting.length > 0}
  <section class="mt-10">
    <h2 class="text-[15px] font-bold">📣 募集中</h2>
    <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.recruiting as p (p.id)}
        {@render card(p, "recruit")}
      {/each}
    </div>
  </section>
{/if}

{#if data.finished.length > 0}
  <section class="mt-10">
    <h2 class="text-[15px] font-bold" style="color: var(--color-ink-subtle);">🏁 結果発表</h2>
    <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.finished as p (p.id)}
        {@render card(p, "result")}
      {/each}
    </div>
  </section>
{/if}
