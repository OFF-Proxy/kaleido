<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import type { LayoutData } from "./$types.js";

  let { children, data }: { children: any; data: LayoutData } = $props();

  const nav = [
    { href: "/", label: "ホーム" },
    { href: "/start", label: "はじめる" },
    { href: "/explore", label: "みんな" },
    { href: "/dashboard", label: "参加者" },
    { href: "/gallery", label: "ギャラリー" },
    { href: "/organizer", label: "主催" },
  ];
</script>

<div class="bg-gallery min-h-screen">
  <header
    class="sticky top-0 z-30 border-b border-[var(--color-hairline)] bg-[color-mix(in_srgb,var(--color-canvas)_80%,transparent)] backdrop-blur"
  >
    <div class="grad-bar"></div>
    <div class="mx-auto flex h-14 max-w-5xl items-center gap-3 px-5">
      <a href="/" class="flex shrink-0 items-center gap-2.5">
        <span
          class="cut-sm grid h-8 w-8 place-items-center text-[18px] leading-none"
          style="background: var(--grad-brand); color: #fff; font-family: var(--font-en);"
        >
          K
        </span>
        <span
          class="hidden text-[20px] leading-none sm:inline"
          style="font-family: var(--font-en); letter-spacing: 0.02em;"
        >
          KALEIDO
        </span>
      </a>
      <nav class="no-scrollbar flex min-w-0 flex-1 items-center gap-4 overflow-x-auto whitespace-nowrap text-[14px]">
        {#each nav as item (item.href)}
          {@const active =
            item.href === "/"
              ? $page.url.pathname === "/"
              : $page.url.pathname.startsWith(item.href)}
          <a
            href={item.href}
            class="shrink-0 py-1 font-bold transition"
            style={active
              ? "color: var(--color-shock); border-bottom: 2px solid var(--color-shock);"
              : "color: var(--color-ink-subtle); border-bottom: 2px solid transparent;"}
          >
            {item.label}
          </a>
        {/each}
      </nav>

      <div class="flex shrink-0 items-center gap-3 text-[13px]">
        {#if data.me}
          <a href="/notifications" class="relative grid h-8 w-8 place-items-center rounded-full text-[16px]" style="border: 1px solid var(--color-hairline-strong); color: var(--color-ink-muted);" aria-label="通知">
            🔔
            {#if data.unread > 0}
              <span class="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-extrabold" style="background: var(--color-hot); color: #fff;">
                {data.unread}
              </span>
            {/if}
          </a>
          <span
            class="flex items-center gap-2 rounded-full px-3 py-1"
            style="background: var(--color-surface-1); border: 1px solid var(--color-hairline);"
          >
            <span
              class="grid h-5 w-5 place-items-center rounded-full text-[11px]"
              style="background: var(--color-accent); color: var(--color-on-accent);"
            >
              {data.me.displayName.slice(0, 1)}
            </span>
            <span style="color: var(--color-ink-muted);">{data.me.displayName}</span>
          </span>
          <a href="/logout" class="dd-btn-ghost rounded-md px-2 py-1" style="color: var(--color-ink-subtle);">
            ログアウト
          </a>
        {:else}
          <span style="color: var(--color-ink-faint);">未参加</span>
        {/if}
      </div>
    </div>
  </header>

  <main class="mx-auto max-w-5xl px-5 py-10">
    {@render children()}
  </main>

  <footer
    class="mx-auto max-w-5xl px-5 py-10 text-[13px]"
    style="color: var(--color-ink-faint);"
  >
    Kaleido — 誰デザ ほかイラスト企画で遊ぶプラットフォーム。スケルトン（デモデータ）。
  </footer>
</div>
