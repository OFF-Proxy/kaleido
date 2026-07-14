<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData } from "./$types.js";
  let { form }: { form: ActionData } = $props();

  let game = $state<"daredeza" | "egaraate">("daredeza");

  const games = [
    {
      key: "daredeza" as const,
      name: "誰デザ",
      desc: "お題でキャラをデザイン → 他の人が作画 → 誰がデザインしたか当てる。",
    },
    {
      key: "egaraate" as const,
      name: "絵柄当て",
      desc: "各自が自分の絵柄で1枚描く → 誰が描いたかを絵柄から当てる。",
    },
  ];

  const labelCls = "mb-1 block text-[13px] font-bold";
  const inputStyle =
    "background: var(--color-surface-2); border: 1px solid var(--color-hairline-strong); color: var(--color-ink); border-radius: 4px;";
</script>

<div class="flex items-center gap-3">
  <a href="/organizer" class="dd-btn dd-btn-ghost" style="padding: 4px 8px;">← 一覧</a>
  <span class="banner">
    <span class="dd-eyebrow" style="color: #fff;">NEW</span>
    <span style="font-family: var(--font-display); font-size: 18px;">新規企画</span>
  </span>
</div>

{#if form?.message}
  <div class="mt-6 p-3 text-[14px] font-bold" style="background: color-mix(in srgb, var(--color-danger) 14%, var(--color-surface-1)); border: 2px solid var(--color-danger); border-radius: 4px; color: var(--color-ink);">
    {form.message}
  </div>
{/if}

<form method="POST" use:enhance class="mt-8 grid max-w-2xl gap-5">
  <input type="hidden" name="gameType" value={game} />
  <div>
    <span class={labelCls}>ゲームを選ぶ</span>
    <div class="grid gap-3 sm:grid-cols-2">
      {#each games as g (g.key)}
        <button
          type="button"
          onclick={() => (game = g.key)}
          class="p-4 text-left transition"
          style={`border-radius: var(--radius-md); border: 2px solid ${game === g.key ? "var(--color-shock)" : "var(--color-hairline-strong)"}; background: ${game === g.key ? "color-mix(in srgb, var(--color-shock) 12%, var(--color-surface-1))" : "var(--color-surface-1)"};`}
        >
          <div class="flex items-center gap-2">
            <span
              class="inline-block h-3 w-3 rounded-full"
              style={`background: ${game === g.key ? "var(--color-shock)" : "var(--color-hairline-strong)"};`}
            ></span>
            <span class="text-[15px] font-extrabold" style="font-family: var(--font-display);">{g.name}</span>
          </div>
          <p class="mt-2 text-[12px] leading-relaxed" style="color: var(--color-ink-subtle);">{g.desc}</p>
        </button>
      {/each}
    </div>
  </div>

  <label>
    <span class={labelCls}>タイトル <span style="color: var(--color-danger);">*</span></span>
    <input name="title" required placeholder={game === "egaraate" ? "第1回 絵柄当て" : "第8回 誰デザ"} class="w-full px-3 py-2 text-[14px]" style={inputStyle} />
  </label>

  <label>
    <span class={labelCls}>お題（テーマ）</span>
    <input name="theme" placeholder="サイバーパンクな和風妖怪" class="w-full px-3 py-2 text-[14px]" style={inputStyle} />
  </label>

  <label>
    <span class={labelCls}>説明</span>
    <textarea name="description" rows="2" placeholder="企画の説明・ルールなど" class="w-full px-3 py-2 text-[14px]" style={inputStyle}></textarea>
  </label>

  <div class="grid gap-4 sm:grid-cols-3">
    {#if game !== "egaraate"}
      <label>
        <span class={labelCls}>デザイン締切</span>
        <input type="datetime-local" name="deadline_design" class="w-full px-2 py-2 text-[13px]" style={inputStyle} />
      </label>
    {/if}
    <label>
      <span class={labelCls}>{game === "egaraate" ? "作品締切" : "作画締切"}</span>
      <input type="datetime-local" name="deadline_artwork" class="w-full px-2 py-2 text-[13px]" style={inputStyle} />
    </label>
    <label>
      <span class={labelCls}>投票締切</span>
      <input type="datetime-local" name="deadline_voting" class="w-full px-2 py-2 text-[13px]" style={inputStyle} />
    </label>
  </div>

  <label>
    <span class={labelCls}>参加者（1行に1人）</span>
    <textarea name="participants" rows="6" placeholder={"ネオ\n墨丸\nルカ"} class="w-full px-3 py-2 text-[14px]" style={inputStyle}></textarea>
    <span class="mt-1 block text-[12px]" style="color: var(--color-ink-faint);">
      入力した人数ぶんの招待リンクを自動発行します。
    </span>
  </label>

  <div class="flex flex-col gap-2">
    <label class="flex items-center gap-2 text-[14px]">
      <input type="checkbox" name="isPublic" checked />
      観覧者にも公開する（投票を開放）
    </label>
    {#if game !== "egaraate"}
      <label class="flex items-center gap-2 text-[14px]">
        <input type="checkbox" name="excludeArtistGuess" checked />
        投票候補から作画者を除外する
      </label>
    {/if}
  </div>

  <div>
    <button class="dd-btn dd-btn-primary">企画を作成</button>
  </div>
</form>
