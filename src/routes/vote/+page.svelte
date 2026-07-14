<script lang="ts">
  import { enhance } from "$app/forms";
  import { untrack } from "svelte";
  import type { PageData, ActionData } from "./$types.js";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // artworkId -> guessed designerId（既存投票を初回のみプレフィル）
  let picks = $state<Record<string, string>>(
    untrack(() => ({ ...data.prefill })),
  );
  let submitting = $state(false);

  const isEgaraate = $derived(data.gameType === "egaraate");
  const guessTarget = $derived(isEgaraate ? "描いた人" : "デザイナー");

  const votable = $derived(
    data.cards.filter((c) => c.artworkId !== data.ownArtworkId),
  );
  const answered = $derived(
    votable.filter((c) => picks[c.artworkId]).length,
  );
  const total = $derived(votable.length);

  // 他の作品で既に選んだ人は選べない（1人1作品まで）
  function takenElsewhere(artworkId: string, designerId: string): boolean {
    for (const c of votable) {
      if (c.artworkId !== artworkId && picks[c.artworkId] === designerId)
        return true;
    }
    return false;
  }
</script>

<div class="flex flex-wrap items-end justify-between gap-4">
  <div>
    <p class="dd-eyebrow">{data.project?.theme}</p>
    <h1 class="mt-2 text-[30px] font-bold" style="font-family: var(--font-display);">
      {guessTarget}を当てる
    </h1>
    <p class="mt-1 text-[14px]" style="color: var(--color-ink-subtle);">
      各作品の{guessTarget}を推理して選ぼう。締切前は何度でも変更できます。
    </p>
    <p class="mt-1 font-mono text-[12px]" style="color: var(--color-ink-faint);">
      候補から自分は除外{data.excludeArtist ? " ・ 作画者も除外（主催設定）" : ""}
    </p>
  </div>
  <div class="flex flex-col items-end gap-1">
    <div class="dd-chip">{answered} / {total} 回答</div>
    {#if !data.isParticipant}
      <span class="text-[12px]" style="color: var(--color-ink-faint);">観覧者（参考集計）</span>
    {:else if data.hasVoted}
      <span class="text-[12px]" style="color: var(--color-shock);">投票済み・変更できます</span>
    {/if}
  </div>
</div>

{#if !data.canVote}
  <div
    class="dd-card mt-8 p-6"
    style="border-color: var(--color-hairline-strong);"
  >
    <p class="text-[15px]" style="color: var(--color-ink-muted);">
      現在は投票期間ではありません。投票フェーズになると参加できます。
    </p>
  </div>
{:else}
  {#if form?.success}
    <div
      class="mt-6 flex items-center gap-3 p-4"
      style="background: color-mix(in srgb, var(--color-shock) 16%, var(--color-surface-1)); border: 2px solid var(--color-shock); border-radius: var(--radius-md);"
    >
      <span class="text-[20px]">✔</span>
      <span class="text-[14px] font-bold" style="color: var(--color-ink);">
        投票を受け付けました！締切前ならいつでも変更できます。
      </span>
    </div>
  {/if}
  {#if form?.message}
    <div
      class="mt-6 p-4 text-[14px] font-bold"
      style="background: color-mix(in srgb, var(--color-danger) 14%, var(--color-surface-1)); border: 2px solid var(--color-danger); border-radius: var(--radius-md); color: var(--color-ink);"
    >
      {form.message}
    </div>
  {/if}

  <form
    method="POST"
    action="?/submit"
    use:enhance={() => {
      submitting = true;
      return async ({ update }) => {
        await update({ reset: false });
        submitting = false;
      };
    }}
  >
    <input type="hidden" name="p" value={data.projectId} />
    <div class="mt-8 grid gap-5 sm:grid-cols-2">
      {#each data.cards as card (card.artworkId)}
        {@const isOwn = card.artworkId === data.ownArtworkId}
        <article class="dd-frame" data-selected={!isOwn && !!picks[card.artworkId]}>
          <div class="relative aspect-[4/5] w-full overflow-hidden">
            <img src={card.imageUrl} alt={card.label} class="h-full w-full object-cover" />
            {#if isOwn}
              <span
                class="tag tag-violet absolute left-2 top-2"
                style="font-size: 11px; padding: 3px 8px;"
              >
                <span>あなたの作品</span>
              </span>
            {/if}
          </div>
          <div class="p-4">
            <div class="flex items-center justify-between">
              <span class="font-mono text-[12px]" style="color: var(--color-ink-subtle);">
                {card.label}
              </span>
              {#if !isOwn && picks[card.artworkId]}
                <span class="font-mono text-[12px]" style="color: var(--color-shock);">SELECTED</span>
              {/if}
            </div>
            <p class="mt-2 text-[14px] leading-relaxed" style="color: var(--color-ink-muted);">
              {card.caption}
            </p>

            {#if isOwn}
              <p class="mt-3 text-[13px]" style="color: var(--color-ink-faint);">
                🖌️ あなたの作品です。投票対象外。
              </p>
            {:else}
              <label class="mt-3 block">
                <span class="mb-1 block text-[12px]" style="color: var(--color-ink-subtle);">
                  {guessTarget}は誰？
                </span>
                <select
                  name={`vote-${card.artworkId}`}
                  bind:value={picks[card.artworkId]}
                  class="w-full rounded-[4px] border px-3 py-2 text-[14px]"
                  style="background: var(--color-surface-2); border-color: var(--color-hairline-strong); color: var(--color-ink);"
                >
                  <option value="">選択してください</option>
                  {#each data.choicesByCard[card.artworkId] ?? [] as c (c.participationId)}
                    <option
                      value={c.participationId}
                      disabled={takenElsewhere(card.artworkId, c.participationId)}
                    >
                      {c.displayName}{takenElsewhere(card.artworkId, c.participationId) ? "（他で選択済み）" : ""}
                    </option>
                  {/each}
                </select>
              </label>
            {/if}
          </div>
        </article>
      {/each}
    </div>

    <div
      class="sticky bottom-4 mt-8 flex items-center justify-between gap-3 p-4"
      style="background: var(--color-surface-2); border: 2px solid var(--color-hairline-strong); border-radius: var(--radius-md);"
    >
      <span class="text-[14px]" style="color: var(--color-ink-subtle);">
        {answered === total ? "すべて回答しました" : `残り ${total - answered} 作品`}
      </span>
      <button class="dd-btn dd-btn-primary" disabled={answered < total || submitting}>
        {submitting ? "送信中…" : data.hasVoted ? "投票を更新" : "投票を提出"}
      </button>
    </div>
  </form>
{/if}
