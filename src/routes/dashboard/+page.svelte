<script lang="ts">
  import type { PageData } from "./$types.js";
  let { data }: { data: PageData } = $props();

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("ja-JP", {
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const currentPhase = $derived(data.project?.phase);
</script>

<div>
  <p class="dd-eyebrow">{data.project?.title}</p>
  <h1 class="mt-2 text-[32px] font-semibold tracking-[-0.02em]">
    {data.meName ? `${data.meName} さんのダッシュボード` : "ダッシュボード"}
  </h1>
  {#if data.isDemo}
    <p class="mt-2 text-[13px]" style="color: var(--color-ink-faint);">
      未参加のためデモ表示中。トップの招待リンクから参加すると自分のビューになります。
    </p>
  {/if}
</div>

<section
  class="mt-8 overflow-hidden rounded-xl border"
  style="border-color: var(--color-hairline); background: linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-1)), var(--color-surface-1));"
>
  <div class="p-6">
    <span class="dd-chip">現在: {data.task?.phaseLabel}</span>
    <h2 class="mt-3 text-[22px] font-semibold tracking-tight">
      {data.task?.action}
    </h2>
    <div class="mt-4 flex flex-wrap items-center gap-4">
      <a href="/vote" class="dd-btn dd-btn-primary">投票へ進む</a>
      <span class="text-[13px]" style="color: var(--color-ink-subtle);">
        締切 {fmt(data.task?.deadline ?? null)}
      </span>
    </div>
  </div>
</section>

<section class="mt-8">
  <h3 class="text-[14px] font-semibold" style="color: var(--color-ink-subtle);">進行状況</h3>
  <ol class="mt-4 flex flex-wrap items-center gap-2">
    {#each data.phases as p, i (p.key)}
      {@const active = p.key === currentPhase}
      <li class="flex items-center gap-2">
        <span
          class="rounded-full px-3 py-1.5 text-[13px]"
          style={active
            ? "background: var(--color-accent); color: var(--color-on-accent);"
            : "background: var(--color-surface-1); color: var(--color-ink-subtle); border: 1px solid var(--color-hairline);"}
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
