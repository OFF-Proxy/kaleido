<script lang="ts">
  import { enhance } from "$app/forms";
  import { PHASE_META } from "$lib/domain/phase.js";
  import type { PageData, ActionData } from "./$types.js";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let imageData = $state("");
  let fileName = $state("");
  let processing = $state(false);
  let sizeKB = $state(0);

  const isEgaraate = $derived(data.project?.gameType === "egaraate");
  const canSubmit = $derived(data.project?.phase === "ArtworkSubmission");

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    processing = true;
    try {
      let quality = 0.85;
      let maxDim = 1100;
      let url = await downscale(file, maxDim, quality);
      // data URL が大きすぎる間は縮めていく（D1 保存のため）
      while (url.length > 1_200_000 && (quality > 0.5 || maxDim > 640)) {
        if (quality > 0.5) quality -= 0.1;
        else maxDim = Math.round(maxDim * 0.85);
        url = await downscale(file, maxDim, quality);
      }
      imageData = url;
      fileName = file.name;
      sizeKB = Math.round(url.length / 1024);
    } finally {
      processing = false;
    }
  }

  function downscale(
    file: File,
    maxDim: number,
    quality: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("no ctx"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(objUrl);
        // JPEG 再エンコードで Exif など位置情報も落ちる（匿名性・プライバシー）
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        reject(new Error("load failed"));
      };
      img.src = objUrl;
    });
  }
</script>

<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
  <span class="banner">
    <span class="dd-eyebrow" style="color: #fff;">SUBMIT</span>
    <span style="font-family: var(--font-display); font-size: 18px;">作品を提出</span>
  </span>
  {#if data.project}
    <span class="text-[14px]" style="color: var(--color-ink-subtle);">
      {data.project.title} ・ {data.project.theme}
    </span>
  {/if}
</div>

{#if !data.me}
  <div class="dd-card mt-8 p-6 text-[14px]" style="color: var(--color-ink-subtle);">
    参加者として認識できませんでした。主催から届いた<strong>招待リンク</strong>から参加してください。
  </div>
{:else if !data.project}
  <div class="dd-card mt-8 p-6 text-[14px]" style="color: var(--color-ink-subtle);">
    企画が見つかりませんでした。
  </div>
{:else if !isEgaraate}
  <div class="dd-card mt-8 p-6 text-[14px]" style="color: var(--color-ink-subtle);">
    このページは「絵柄当て」用の作品提出フォームです。この企画は誰デザのため、
    <a href="/dashboard" style="color: var(--color-shock);">ダッシュボード</a>から進めてください。
  </div>
{:else if form?.success}
  <div class="dd-card mt-8 p-6">
    <div class="text-[16px] font-extrabold" style="color: var(--color-success);">
      ✓ 作品を提出しました！
    </div>
    <p class="mt-2 text-[13px]" style="color: var(--color-ink-subtle);">
      締切までは何度でも差し替えできます。投票がはじまるまでお待ちください。
    </p>
    <a href="/submit" class="dd-btn dd-btn-secondary mt-4 inline-block" style="padding: 6px 14px; font-size: 13px;">
      提出内容を差し替える
    </a>
  </div>
{:else if !canSubmit}
  <div class="dd-card mt-8 p-6 text-[14px]" style="color: var(--color-ink-subtle);">
    現在は作品提出フェーズではありません（現在: <strong>{data.project ? PHASE_META[data.project.phase].label : ""}</strong>）。
    提出フェーズになると、ここから自分の作品を出せます。
  </div>
{:else}
  <p class="mt-6 text-[14px]" style="color: var(--color-ink-subtle);">
    あなたの<strong style="color: var(--color-ink);">絵柄</strong>で作品を1枚提出しましょう。
    投票では、他の人があなたの絵柄を手がかりに「誰が描いたか」を当てます。
    {#if data.submitted}
      <span style="color: var(--color-shock);">（提出済み。差し替えできます）</span>
    {/if}
  </p>

  {#if form?.message}
    <div class="mt-4 p-3 text-[14px] font-bold" style="background: color-mix(in srgb, var(--color-danger) 14%, var(--color-surface-1)); border: 2px solid var(--color-danger); border-radius: var(--radius-md); color: var(--color-ink);">
      {form.message}
    </div>
  {/if}

  <form method="POST" use:enhance class="mt-6 grid max-w-xl gap-5">
    <input type="hidden" name="image" value={imageData} />

    <div>
      <span class="mb-1 block text-[13px] font-bold">作品画像 <span style="color: var(--color-danger);">*</span></span>
      <input
        type="file"
        accept="image/*"
        onchange={onFile}
        class="block w-full text-[13px]"
        style="color: var(--color-ink-subtle);"
      />
      <span class="mt-1 block text-[12px]" style="color: var(--color-ink-faint);">
        アップロード時に自動で縮小し、位置情報（Exif）も取り除きます。
      </span>
    </div>

    {#if processing}
      <div class="text-[13px]" style="color: var(--color-ink-subtle);">画像を処理中…</div>
    {/if}

    {#if imageData}
      <div class="dd-card p-3">
        <img src={imageData} alt="プレビュー" class="mx-auto max-h-72 rounded" />
        <div class="mt-2 text-center text-[12px]" style="color: var(--color-ink-faint);">
          {fileName}（約 {sizeKB}KB）
        </div>
      </div>
    {/if}

    <label>
      <span class="mb-1 block text-[13px] font-bold">ひとこと（任意）</span>
      <textarea
        name="caption"
        rows="2"
        maxlength="200"
        placeholder="タイトルや設定など（作者名は書かないでね）"
        class="w-full px-3 py-2 text-[14px]"
        style="background: var(--color-surface-2); border: 1px solid var(--color-hairline-strong); color: var(--color-ink); border-radius: 4px;"
      ></textarea>
    </label>

    <div>
      <button
        class="dd-btn dd-btn-primary"
        disabled={!imageData || processing}
      >
        {data.submitted ? "この内容で差し替える" : "作品を提出する"}
      </button>
    </div>
  </form>
{/if}
