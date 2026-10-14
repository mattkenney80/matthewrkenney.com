// Build data/build/report.md from the crawl output. Flags problems; fixes nothing.
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { readJson, rel } from "./lib/util.mjs";
import { crewRole, unmappedKeyJob } from "./lib/roles.mjs";

const seedsFile = readJson(rel("pipeline/config/seeds.json"));
const people = readJson(rel("data/build/people.json"));
const films = readJson(rel("data/build/films.json"));
const collab = readJson(rel("data/build/collaborations.json"));
const meta = readJson(rel("data/build/crawl-meta.json"));
const name = (id) => people[id]?.n ?? `#${id}`;
const L = [];
const out = (s = "") => L.push(s);

const ROLES = ["cinematographer", "editor", "composer", "writer", "actor"];
const seedsBy = (list) => seedsFile[list];
const filmSpan = (ids) => {
  const ys = ids.map((i) => films[i]?.y).filter((y) => y != null);
  return ys.length ? `${Math.min(...ys)} to ${Math.max(...ys)}` : "n/a";
};

// index: person id -> other id -> role of other (as seen by this person's role) -> Set(films)
function partners(id, myRole) {
  const m = new Map(); // `${otherRole}` -> Map(otherId -> Set(films))
  for (const [a, ar, b, br, fs] of collab) {
    let other, oRole;
    if (a === id && ar === myRole) [other, oRole] = [b, br];
    else if (b === id && br === myRole) [other, oRole] = [a, ar];
    else continue;
    if (!m.has(oRole)) m.set(oRole, new Map());
    const mm = m.get(oRole);
    if (!mm.has(other)) mm.set(other, new Set());
    for (const f of fs) mm.get(other).add(f);
  }
  return m;
}
const top = (map, n = 3) =>
  map ? [...map].map(([id, s]) => [id, s.size]).sort((x, y) => y[1] - x[1] || x[0] - y[0]).slice(0, n).map(([id, c]) => `${name(id)} (${c})`).join(", ") || "none" : "none";

out("# Film Repertory: crawl report");
out();
out(`Generated ${meta.generated}. Config: ${JSON.stringify(meta.config)}`);
out();

// ---- 0. size
out("## 0. Size");
out();
const sizes = ["people", "films", "collaborations"].map((n) => {
  const buf = readFileSync(rel(`data/build/${n}.json`));
  return { n, raw: buf.length, gz: gzipSync(buf).length };
});
out("| file | raw | gzip |");
out("|---|---|---|");
for (const s of sizes) out(`| ${s.n}.json | ${(s.raw / 1e6).toFixed(2)} MB | ${(s.gz / 1e6).toFixed(2)} MB |`);
const tot = sizes.reduce((a, s) => a + s.gz, 0);
out(`| total | ${(sizes.reduce((a, s) => a + s.raw, 0) / 1e6).toFixed(2)} MB | ${(tot / 1e6).toFixed(2)} MB |`);
out();
out(`Nodes: ${meta.counts.seeds} seeds + ${meta.counts.promoted} promoted = ${meta.counts.seeds + meta.counts.promoted} full nodes. ${meta.counts.people} people and ${meta.counts.films} films appear in the data; ${meta.counts.collaborations} collaboration rows.`);
out(`Handoff says to split per person and lazy load if the build passes a couple of MB. Gzipped total is ${(tot / 1e6).toFixed(1)} MB, so this is at that line. There was no earlier build in this repo to compare against.`);
out();

// ---- 1. directors
out("## 1. Seed directors");
out();
for (const s of seedsBy("directors")) {
  const ids = meta.seedFilms[s.tmdbId] ?? [];
  const p = partners(s.tmdbId, "director");
  out(`### ${s.name}`);
  out(`${ids.length} feature films, ${filmSpan(ids)}.`);
  for (const r of ROLES) out(`- ${r}: ${top(p.get(r))}`);
  out();
}

// ---- 2. unmapped jobs
out("## 2. Crew jobs that looked like a key role but did not map");
out();
const counts = new Map();
const filmIdsOfDirectors = new Set(seedsBy("directors").flatMap((s) => meta.seedFilms[s.tmdbId] ?? []));
for (const fid of filmIdsOfDirectors) {
  let m;
  try { m = readJson(rel("data/raw/movie", `${fid}.json`)); } catch { continue; }
  for (const c of m.credits.crew) {
    if (unmappedKeyJob(c)) {
      const k = `${c.department} / ${c.job}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
}
out(`Counted over the ${filmIdsOfDirectors.size} films of the seed directors. Filter: job text mentions a key role word, minus assistant, associate, co-, supervisor, coordinator and similar.`);
out();
const ranked = [...counts].sort((a, b) => b[1] - a[1]);
out("| department / job | credits |");
out("|---|---|");
for (const [k, c] of ranked.slice(0, 30)) out(`| ${k} | ${c} |`);
if (!ranked.length) out("| none | 0 |");
out();
const mappedOdd = ["Composer", "Screenstory", "Teleplay", "Book", "Short Story", "Characters", "Adaptation"];
out(`Mapped to a role by a judgment call, worth a glance: ${mappedOdd.join(", ")} (all treated as writer, except Composer).`);
out();

// ---- 3. year / type leaks
out("## 3. Null years and type leaks");
out();
const nullYear = Object.entries(films).filter(([, f]) => f.y == null);
out(`Films in the build with no release year: ${nullYear.length}.`);
for (const [id, f] of nullYear.slice(0, 20)) out(`- ${f.t} (id ${id})`);
out();
const byWhy = {};
for (const d of meta.dropped) (byWhy[d.why] ??= []).push(d);
out(`Dropped when TMDB details showed the film is not a released feature: ${meta.dropped.length}.`);
for (const [why, list] of Object.entries(byWhy)) out(`- ${why}: ${list.length}. ${list.slice(0, 12).map((d) => `${d.title}${d.year ? ` (${d.year})` : ""}`).join("; ")}${list.length > 12 ? "; ..." : ""}`);
out();
out("Credits excluded before fetching details (documentary or TV movie genre, video release, or fewer than " + meta.config.minVoteCount + " TMDB votes), seeds only:");
out();
out("| seed | documentary | tv movie | video | low votes |");
out("|---|---|---|---|---|");
for (const list of ["directors", "actors", "writers", "cinematographers"]) {
  for (const s of seedsBy(list)) {
    const e = meta.exclusions[s.tmdbId];
    if (e && (e.documentary || e.tvMovie || e.video || e.lowVotes)) out(`| ${s.name} (${list.slice(0, -1)}) | ${e.documentary} | ${e.tvMovie} | ${e.video} | ${e.lowVotes} |`);
  }
}
out();

// ---- 4. ambiguous seeds
out("## 4. Seed name matches with more than one plausible candidate");
out();
let amb = 0;
for (const list of ["directors", "actors", "writers", "cinematographers"]) {
  for (const s of seedsBy(list)) {
    if (s.matched?.status === "review") {
      amb++;
      out(`- ${s.name}: used id ${s.tmdbId} (${s.matched.knownFor}). Alternates: ${(s.matched.alternates ?? []).map((a) => `${a.id} ${a.department} ${a.knownFor}`).join("; ")}`);
    }
  }
}
if (!amb) out("None.");
out();

// ---- 5. DPs and writers
out("## 5. Cinematographer and writer seeds");
out();
for (const [list, role, label] of [["cinematographers", "cinematographer", "Cinematographers"], ["writers", "writer", "Writers"]]) {
  out(`### ${label}`);
  out();
  for (const s of seedsBy(list)) {
    const ids = meta.seedFilms[s.tmdbId] ?? [];
    const p = partners(s.tmdbId, role);
    out(`- **${s.name}**: ${ids.length} feature films, ${filmSpan(ids)}. Top directors: ${top(p.get("director"))}`);
  }
  out();
}

// ---- 6. expectations vs TMDB
out("## 6. Does TMDB agree with the reasoning behind each pick?");
out();
const idOf = (n) => [...seedsFile.cinematographers, ...seedsFile.writers].find((s) => s.name === n)?.tmdbId;
const directorsOf = (fid) => (films[fid]?.cr ?? []).filter(([, r]) => r === "director").map(([p]) => name(p));
const expect = [
  ["Roger Deakins", "titles", ["Fargo", "No Country for Old Men"]],
  ["Roger Deakins", "director", ["Denis Villeneuve"]],
  ["Emmanuel Lubezki", "titles", ["Children of Men", "Birdman or (The Unexpected Virtue of Ignorance)"]],
  ["Robert Richardson", "director", ["Martin Scorsese", "Quentin Tarantino"]],
  ["Hoyte van Hoytema", "director", ["Christopher Nolan"]],
  ["Darius Khondji", "titles", ["Se7en", "Uncut Gems"]],
  ["Robert Elswit", "director", ["Paul Thomas Anderson"]],
  ["Robert Elswit", "titles", ["Michael Clayton", "Nightcrawler"]],
  ["Michael Chapman", "titles", ["Taxi Driver"]],
  ["Dion Beebe", "titles", ["Collateral"]],
  ["Adam Stone", "director", ["Jeff Nichols"]],
  ["Stephen King", "titles", ["It", "Stand by Me", "The Mist"]],
];
const lc = (s) => s.toLowerCase();
for (const [who, kind, wants] of expect) {
  const ids = meta.seedFilms[idOf(who)] ?? [];
  for (const w of wants) {
    const hit = kind === "titles" ? ids.filter((i) => lc(films[i]?.t ?? "") === lc(w)) : ids.filter((i) => directorsOf(i).includes(w));
    const detail = kind === "titles" ? hit.map((i) => `${films[i].t} (${films[i].y})`).join(", ") : `${hit.length} films, e.g. ${hit.slice(0, 3).map((i) => films[i].t).join("; ")}`;
    out(`- ${hit.length ? "OK" : "MISMATCH"}: ${who} ${kind === "titles" ? "on" : "with director"} ${w}${hit.length ? ` -> ${detail}` : " -> not in TMDB credits within this dataset"}`);
  }
}
out();

// ---- 7. owner data
out("## 7. Owner titles");
out();
const owner = {
  letterboxd: readJson(rel("data/owner/letterboxd.json")),
  essays: readJson(rel("data/owner/essays.json")),
  kids: readJson(rel("data/owner/kids.json")).films,
};
const inGraph = new Set(Object.keys(films).map(Number));
for (const [k, list] of Object.entries(owner)) {
  const res = list.filter((x) => x.tmdbId);
  const live = res.filter((x) => inGraph.has(x.tmdbId));
  out(`- ${k}: ${res.length}/${list.length} resolved to a TMDB id; ${live.length} of those are films in the graph (the rest badge nothing until a seed reaches them).`);
}
out("- Good Time is recorded as 5 stars (owner answer, 2026-10-13). Letterboxd's 3 is kept in `letterboxdRating`.");
out();

writeFileSync(rel("data/build/report.md"), L.join("\n") + "\n");
console.log(L.join("\n"));
