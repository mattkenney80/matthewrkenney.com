// Match the owner's titles (Letterboxd, essays, kids list) to TMDB movie ids.
// Writes ids back into data/owner/*.json and prints every title that needs a look.
import { tmdb } from "./lib/tmdb.mjs";
import { norm, pool, readJson, rel, writeJson } from "./lib/util.mjs";

const year = (d) => (d ? Number(String(d).slice(0, 4)) : null);

async function resolve(title, y) {
  const data = await tmdb("/search/movie", { query: title, ...(y ? { year: y } : {}), include_adult: false });
  let c = data.results.filter((r) => [r.title, r.original_title].some((t) => norm(t) === norm(title)));
  if (y) c = c.filter((r) => Math.abs((year(r.release_date) ?? 0) - y) <= 1);
  c.sort((a, b) => b.vote_count - a.vote_count);
  if (!c.length) return { status: "none" };
  const [top, second] = c;
  const strong = c.filter((r) => r.vote_count >= 200);
  const ambiguous = !y && second && strong.length > 1 && second.vote_count * 5 > top.vote_count;
  return {
    id: top.id,
    status: ambiguous ? "review" : "ok",
    picked: `${top.title} (${year(top.release_date)})`,
    alternates: ambiguous ? c.slice(1, 4).map((r) => `${r.title} (${year(r.release_date)}) id ${r.id}`) : undefined,
  };
}

const files = [
  { name: "letterboxd", path: rel("data/owner/letterboxd.json"), list: (j) => j },
  { name: "essays", path: rel("data/owner/essays.json"), list: (j) => j },
  { name: "kids", path: rel("data/owner/kids.json"), list: (j) => j.films },
];

const problems = [];
for (const f of files) {
  const json = readJson(f.path);
  const items = f.list(json).filter((x) => !x.tvMiniseries);
  await pool(items, 6, async (item) => {
    if (item.tmdbId) return;
    const r = await resolve(item.title, item.year);
    if (r.id) item.tmdbId = r.id;
    if (r.status !== "ok") problems.push(`${f.name}: "${item.title}" ${item.year ?? ""} -> ${r.status}${r.picked ? ` picked ${r.picked}` : ""}${r.alternates ? ` | also ${r.alternates.join("; ")}` : ""}`);
    item.resolved = r.picked ?? null;
  });

  if (f.name === "essays") {
    // Cross-check the director we have on file against TMDB credits.
    await pool(items.filter((i) => i.tmdbId), 6, async (item) => {
      const cr = await tmdb(`/movie/${item.tmdbId}/credits`);
      const dirs = cr.crew.filter((c) => c.job === "Director").map((c) => c.name);
      const want = item.director.split(",").map((s) => norm(s));
      if (!want.some((w) => dirs.some((d) => norm(d) === w))) problems.push(`essays: "${item.title}" director on file "${item.director}" but TMDB says ${dirs.join(", ") || "nobody"}`);
    });
  }
  writeJson(f.path, json, true);
  const n = items.length, ok = items.filter((i) => i.tmdbId).length;
  console.log(`${f.name}: ${ok}/${n} resolved`);
}
console.log(problems.length ? "\nNeeds a look:\n" + problems.map((p) => "  " + p).join("\n") : "\nNo problems.");
