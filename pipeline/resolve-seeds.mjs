// Step 1 of the pipeline: turn seed names into TMDB person ids.
// Only entries whose tmdbId is still null are looked up, so it is safe to re-run.
// Every match is printed so a wrong person can be caught before any crawl.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmdb } from "./lib/tmdb.mjs";

const SEEDS = fileURLToPath(new URL("./config/seeds.json", import.meta.url));
const GROUPS = {
  directors: "Directing",
  actors: "Acting",
  writers: "Writing",
  cinematographers: "Camera",
};

// "Alfonso Cuaron" must match TMDB's "Alfonso Cuarón".
const norm = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const knownFor = (p) => p.known_for?.[0]?.title ?? p.known_for?.[0]?.name ?? "n/a";

async function resolve(name, expected) {
  const { results = [] } = await tmdb("/search/person", { query: name, include_adult: "false" });
  if (!results.length) return { status: "notfound" };

  const exact = results.filter((r) => norm(r.name) === norm(name));
  const pool = exact.length ? exact : results.slice(0, 1);
  const inDept = pool.filter((r) => r.known_for_department === expected);
  const ranked = (inDept.length ? inDept : pool).sort((a, b) => b.popularity - a.popularity);
  const pick = ranked[0];

  // Review when the name is not an exact match, or two real people share it.
  const status = !exact.length || ranked.length > 1 ? "review" : "ok";
  return {
    status,
    pick,
    alternates: ranked.slice(1, 4).map((r) => ({
      id: r.id, department: r.known_for_department, knownFor: knownFor(r),
    })),
    deptMatches: pick.known_for_department === expected,
  };
}

const seeds = JSON.parse(await readFile(SEEDS, "utf8"));
const tally = { ok: 0, review: 0, notfound: 0, skipped: 0 };
const flagged = [];

for (const [group, expected] of Object.entries(GROUPS)) {
  console.log(`\n${group.toUpperCase()} (expecting ${expected})`);
  for (const entry of seeds[group]) {
    if (entry.tmdbId !== null) { tally.skipped++; continue; }
    const r = await resolve(entry.name, expected);
    tally[r.status]++;

    if (r.status === "notfound") {
      console.log(`  ${"NOT FOUND".padEnd(8)} ${entry.name}`);
      flagged.push(`${entry.name}: no TMDB results`);
      continue;
    }
    entry.tmdbId = r.pick.id;
    entry.matched = {
      name: r.pick.name,
      department: r.pick.known_for_department,
      knownFor: knownFor(r.pick),
      status: r.status,
      ...(r.alternates.length ? { alternates: r.alternates } : {}),
    };
    const dept = r.deptMatches ? "" : `  [dept: ${r.pick.known_for_department}]`;
    console.log(
      `  ${r.status === "ok" ? "ok" : "REVIEW"}`.padEnd(10) +
      `${entry.name.padEnd(24)} id ${String(r.pick.id).padEnd(8)} ${knownFor(r.pick)}${dept}`,
    );
    if (r.status === "review") {
      flagged.push(`${entry.name} -> picked ${r.pick.name} (${r.pick.id}); alternates: ` +
        (r.alternates.map((a) => `${a.id} ${a.department} "${a.knownFor}"`).join(" | ") || "none, name differs"));
    }
    await new Promise((res) => setTimeout(res, 120));
  }
}

await writeFile(SEEDS, JSON.stringify(seeds, null, 2) + "\n");
console.log(`\nresolved: ${tally.ok} ok, ${tally.review} need review, ${tally.notfound} not found, ${tally.skipped} already had ids`);
if (flagged.length) { console.log("\nNEEDS YOUR EYES:"); flagged.forEach((f) => console.log("  - " + f)); }
