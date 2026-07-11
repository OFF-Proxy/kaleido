<script lang="ts">
  import type { PageData } from "./$types.js";
  let { data }: { data: PageData } = $props();

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
</script>

<div class="flex items-center gap-3">
  <span class="banner">
    <span class="dd-eyebrow" style="color: #fff;">INBOX</span>
    <span style="font-family: var(--font-display); font-size: 18px;">通知</span>
  </span>
</div>

{#if !data.isParticipant}
  <p class="mt-8 text-[14px]" style="color: var(--color-ink-subtle);">
    通知を見るには参加者としてログインしてください（トップのDEMO招待リンクから）。
  </p>
{:else if data.items.length === 0}
  <p class="mt-8 text-[14px]" style="color: var(--color-ink-subtle);">通知はまだありません。</p>
{:else}
  <div class="mt-8 grid gap-2">
    {#each data.items as n (n.id)}
      <a
        href={n.href ?? "#"}
        class="flex items-start gap-3 p-4"
        style={`text-decoration: none; background: var(--color-surface-1); border: 1px solid ${n.readAt === null ? "var(--color-shock)" : "var(--color-hairline-strong)"}; border-radius: 4px;`}
      >
        <span class="text-[16px]">{n.readAt === null ? "🟢" : "⚪"}</span>
        <span class="flex-1">
          <span class="block text-[14px]" style="color: var(--color-ink);">{n.body}</span>
          <span class="mt-1 block font-mono text-[12px]" style="color: var(--color-ink-faint);">{fmt(n.createdAt)}</span>
        </span>
      </a>
    {/each}
  </div>
{/if}
