<script lang="ts">
  import type { PageData } from "./$types.js";
  let { data }: { data: PageData } = $props();
</script>

<div>
  <p class="dd-eyebrow">{data.project?.theme}</p>
  <h1 class="mt-2 text-[32px] font-semibold tracking-[-0.02em]">完成作ギャラリー</h1>
  <p class="mt-1 text-[14px]" style="color: var(--color-ink-subtle);">
    作者は伏せられています。表示順は提出順とは無関係です。
  </p>
</div>

<div class="mt-8 columns-2 gap-4 md:columns-3 [&>*]:mb-4">
  {#each data.cards as card (card.artworkId)}
    <figure class="dd-frame break-inside-avoid">
      <img src={card.imageUrl} alt={card.label} class="w-full" />
      <figcaption class="p-3">
        <div class="font-mono text-[12px]" style="color: var(--color-ink-subtle);">
          {card.label}
        </div>
        <p class="mt-1 text-[13px]" style="color: var(--color-ink-muted);">
          {card.caption}
        </p>
      </figcaption>
    </figure>
  {/each}
</div>
