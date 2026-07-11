<script lang="ts">
  import type { PageData } from "./$types.js";
  import { PHASE_META } from "$lib/domain/phase.js";
  let { data }: { data: PageData } = $props();
</script>

<div class="flex flex-wrap items-center justify-between gap-4">
  <span class="banner">
    <span class="dd-eyebrow" style="color: #fff;">ORGANIZER</span>
    <span style="font-family: var(--font-display); font-size: 18px;">企画一覧</span>
  </span>
  <a href="/organizer/new" class="dd-btn dd-btn-primary">＋ 新規企画</a>
</div>

<div class="mt-8 grid gap-4 sm:grid-cols-2">
  {#each data.projects as p (p.id)}
    <a href={`/organizer/${p.id}`} class="dd-card block p-5" style="text-decoration: none;">
      <div class="flex items-center justify-between">
        <span class="dd-chip">{PHASE_META[p.phase].label}</span>
        <span class="font-mono text-[12px]" style="color: var(--color-ink-subtle);">
          {p.participants}人
        </span>
      </div>
      <div class="mt-3 text-[18px] font-bold" style="color: var(--color-ink);">{p.title}</div>
      <div class="mt-1 text-[13px]" style="color: var(--color-ink-subtle);">{p.theme}</div>
    </a>
  {/each}
</div>

{#if data.projects.length === 0}
  <p class="mt-8 text-[14px]" style="color: var(--color-ink-subtle);">
    まだ企画がありません。「＋ 新規企画」から作成してください。
  </p>
{/if}
