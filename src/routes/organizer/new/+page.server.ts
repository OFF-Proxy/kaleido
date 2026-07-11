import { fail, redirect } from "@sveltejs/kit";
import { repository } from "$lib/server/index.js";
import type { Actions } from "./$types.js";

const str = (v: FormDataEntryValue | null): string | undefined => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : undefined;
};

export const actions: Actions = {
  default: async ({ request }) => {
    const f = await request.formData();
    const title = String(f.get("title") ?? "").trim();
    if (!title) {
      return fail(400, { message: "タイトルは必須です。" });
    }
    const participantNames = String(f.get("participants") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const id = await repository.createProject({
      title,
      theme: String(f.get("theme") ?? ""),
      description: String(f.get("description") ?? ""),
      isPublic: f.get("isPublic") === "on",
      excludeArtistGuess: f.get("excludeArtistGuess") === "on",
      deadlines: {
        design: str(f.get("deadline_design")),
        artwork: str(f.get("deadline_artwork")),
        voting: str(f.get("deadline_voting")),
      },
      participantNames,
    });

    redirect(303, `/organizer/${id}`);
  },
};
