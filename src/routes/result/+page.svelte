<script lang="ts">
  import type { PageData } from "./$types.js";
  import { page } from "$app/stores";
  let { data }: { data: PageData } = $props();

  const medal = (rank: number) =>
    rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";

  const origin = $derived($page.url.origin);
  const shareUrl = $derived(`${origin}/result`);
  const title = $derived(data.project?.title ?? "誰デザ");
  const tweetHref = $derived(
    `https://x.com/intent/tweet?text=${encodeURIComponent(`「${title}」の結果発表！ 作者は誰だ？`)}&url=${encodeURIComponent(shareUrl)}&hashtags=Kaleido,${encodeURIComponent("誰デザ")}`,
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      /* noop */
    }
  }
</script>

<svelte:head>
  <title>{title} 結果発表 ・ Kaleido</title>
  <meta property="og:title" content={`${title} 結果発表`} />
  <meta property="og:description" content="作者は誰だ？ Kaleido の誰デザ結果発表" />
  <meta property="og:image" content={`${origin}/result/card.svg`} />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div>
  <p class="dd-eyebrow">{data.project?.theme} ・ 結果発表</p>
  <h1 class="mt-2 text-[30px] font-bold" style="font-family: var(--font-display);">答え合わせ</h1>
</div>

{#if !data.revealed}
  <div class="dd-card mt-6 p-6">
    <p class="text-[15px]" style="color: var(--color-ink-muted);">
      まだ結果発表フェーズではありません。主催が「結果発表」にすると、答え合わせ・正解率ランキング・シェア画像が表示されます。
    </p>
  </div>
{:else}
<!-- シェア -->
<section class="dd-card mt-6 overflow-hidden">
  <img src="/result/card.svg" alt="結果まとめカード" class="w-full" style="display: block; border-bottom: 1px solid var(--color-hairline-strong);" />
  <div class="flex flex-wrap items-center gap-3 p-4">
    <span class="dd-eyebrow" style="color: var(--color-ink-subtle);">SHARE</span>
    <a href={tweetHref} target="_blank" rel="noopener" class="dd-btn dd-btn-primary" style="font-size: 13px;">Xでシェア</a>
    <button type="button" class="dd-btn dd-btn-secondary" style="font-size: 13px;" onclick={copyLink}>リンクをコピー</button>
    <a href="/result/card.svg" download="kaleido-result.svg" class="dd-btn dd-btn-secondary" style="font-size: 13px;">画像を保存</a>
  </div>
</section>

<section class="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
  <!-- 答え合わせ -->
  <div class="grid gap-4 sm:grid-cols-2">
    {#each data.results as r (r.artworkId)}
      <article class="dd-frame">
        <img src={r.imageUrl} alt={r.label} class="aspect-[4/5] w-full object-cover" />
        <div class="p-4">
          <div class="font-mono text-[12px]" style="color: var(--color-ink-subtle);">
            {r.label}
          </div>
          <div class="mt-2 text-[15px]">
            デザイナー
            <span class="font-semibold" style="color: var(--color-accent);">{r.designerName}</span>
          </div>
          <div class="text-[13px]" style="color: var(--color-ink-subtle);">
            作画 {r.artistName}
          </div>
          <div class="mt-2 text-[12px]" style="color: var(--color-ink-faint);">
            正解 {r.correctCount} / {r.totalVotes} 票
          </div>
        </div>
      </article>
    {/each}
  </div>

  <!-- ランキング -->
  <aside class="dd-card h-fit p-5">
    <h2 class="text-[18px] font-semibold tracking-tight">正解率ランキング</h2>
    <p class="mt-1 text-[12px]" style="color: var(--color-ink-faint);">
      自分のデザインは集計から除外
    </p>
    <ol class="mt-4 space-y-1">
      {#each data.ranking as row (row.participationId)}
        <li
          class="flex items-center justify-between rounded-md px-3 py-2"
          style={row.rank <= 3 ? "background: var(--color-surface-2);" : ""}
        >
          <span class="flex items-center gap-2">
            <span class="w-6 font-mono text-[13px]" style="color: var(--color-ink-subtle);">
              {row.rank}
            </span>
            <span class="text-[14px]">{medal(row.rank)} {row.displayName}</span>
          </span>
          <span class="text-[13px]" style="color: var(--color-ink-muted);">
            {row.correct}/{row.answered}
            <span style="color: var(--color-ink-faint);">
              （{Math.round(row.accuracy * 100)}%）
            </span>
          </span>
        </li>
      {/each}
    </ol>
  </aside>
</section>
{/if}
