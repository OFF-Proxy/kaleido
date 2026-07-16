<script lang="ts">
  import { enhance } from "$app/forms";
  import type { PageData, ActionData } from "./$types.js";

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="mx-auto max-w-md">
  <span class="banner">
    <span class="dd-eyebrow" style="color: #fff;">CO-HOST</span>
    <span style="font-family: var(--font-display); font-size: 18px;">共同ホストとして参加</span>
  </span>

  <div class="dd-card mt-6 p-6">
    <p class="text-[14px]" style="color: var(--color-ink-muted);">
      <strong style="color: var(--color-ink);">{data.projectTitle}</strong>
      <span style="color: var(--color-ink-subtle);">（{data.theme}）</span>
      の共同ホストに招待されています。表示名を入力して参加してください。
    </p>

    {#if form?.message}
      <div class="mt-4 p-3 text-[14px] font-bold" style="background: color-mix(in srgb, var(--color-danger) 14%, var(--color-surface-1)); border: 2px solid var(--color-danger); border-radius: var(--radius-md); color: var(--color-ink);">
        {form.message}
      </div>
    {/if}

    <form method="POST" use:enhance class="mt-5 grid gap-4">
      <label>
        <span class="mb-1 block text-[13px] font-bold">表示名</span>
        <input
          name="displayName"
          required
          maxlength="40"
          placeholder="共同ホストの名前"
          class="w-full px-3 py-2 text-[14px]"
          style="background: var(--color-surface-2); border: 1px solid var(--color-hairline-strong); color: var(--color-ink); border-radius: 4px;"
        />
      </label>
      <div>
        <button class="dd-btn dd-btn-primary">共同ホストとして参加</button>
      </div>
    </form>
  </div>
</div>
