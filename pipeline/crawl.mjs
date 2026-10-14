// Crawl TMDB for the seed roster plus one hop of collaborators and write data/build/*.json.
// Raw responses are cached in data/raw (gitignored), so a re-run only fetches what is new.
import { tmdb } from "./lib/tmdb.mjs";
import { cached, pool, readJson, rel, writeJson } from "./lib/util.mjs";
import { crewRole } from "./lib/roles.mjs";

const seedsFile = readJson(rel("pipeline/config/seeds.json"));
const X = { minVoteCount: 25, actorMaxOrder: 15, promotedFilmCap: 25, maxPromoted: 400, ...seedsFile.expansion };
const CONC = 10;
const SKIP_GENRES = new Set([99, 10770]); // documentary, TV movie

// ---- seeds ----------------------------------------------------------------
const TYPE_OF = { directors: "director", actors: "actor", writers: "writer", cinematographers: "cinematographer" };
const seeds = new Map();
for (const [list, type] of Object.entries(TYPE_OF)) {
  for (const s of seedsFile[list]) {
    const cur = seeds.get(s.tmdbId) ?? { id: s.tmdbId, name: s.name, types: new Set() };
    cur.types.add(type);
    seeds.set(s.tmdbId, cur);
  }
}
console.log(`${seeds.size} seeds`);

// ---- selection of a person's films by role -------------------------------------
const baseOk = (c) => !c.video && (c.vote_count ?? 0) >= X.minVoteCount && !(c.genre_ids ?? []).some((g) => SKIP_GENRES.has(g));
function pick(credits, role) {
  if (role === "actor") return credits.cast.filter((c) => !/\b(self|archive)\b/i.test(c.character ?? "") && (c.order ?? 99) <= X.actorMaxOrder);
  return credits.crew.filter((c) => (role === "writer" ? c.department === "Writing" : crewRole(c) === role));
}

const exclusions = {}; // per person id: counts of credits dropped by the feature filter
function select(personId, credits, roles) {
  const kept = new Map();
  const ex = (exclusions[personId] ??= { lowVotes: 0, documentary: 0, tvMovie: 0, video: 0 });
  for (const role of roles) {
    for (const c of pick(credits, role)) {
      if (c.video) ex.video++;
      else if ((c.genre_ids ?? []).includes(99)) ex.documentary++;
      else if ((c.genre_ids ?? []).includes(10770)) ex.tvMovie++;
      else if ((c.vote_count ?? 0) < X.minVoteCount) ex.lowVotes++;
      else kept.set(c.id, c);
    }
  }
  return [...kept.values()];
}

// ---- phase 1: seed filmographies ---------------------------------------------------
const personCredits = (id) => cached("person", id, () => tmdb(`/person/${id}/movie_credits`));
const seedList = [...seeds.values()];
const seedFilms = new Map(); // seed id -> Set(film id)
await pool(seedList, CONC, async (s) => {
  const credits = await personCredits(s.id);
  const films = select(s.id, credits, s.types);
  seedFilms.set(s.id, new Set(films.map((f) => f.id)));
});
const allFilmIds = new Set([...seedFilms.values()].flatMap((s) => [...s]));
console.log(`phase 1: ${allFilmIds.size} unique candidate films from seeds`);

// ---- phase 2: film details + credits ------------------------------------------------
let fetched = 0;
const movie = (id) =>
  cached("movie", id, async () => {
    const m = await tmdb(`/movie/${id}`, { append_to_response: "credits" });
    if (++fetched % 250 === 0) console.log(`  ...${fetched} films fetched`);
    return m;
  });
async function loadFilms(ids) {
  const out = new Map();
  await pool([...ids], CONC, async (id) => out.set(id, await movie(id)));
  return out;
}
const films = await loadFilms(allFilmIds);

// A fetched film is a "feature" if it survives the details-level checks.
const dropped = []; // {id, title, year, why}
const isFeature = (m) => {
  const why = (m.genres ?? []).some((g) => g.id === 99) ? "documentary"
    : (m.genres ?? []).some((g) => g.id === 10770) ? "tv movie"
    : m.runtime && m.runtime < 40 ? "short"
    : m.status && m.status !== "Released" ? `status ${m.status}` : null;
  if (why) dropped.push({ id: m.id, title: m.title, year: (m.release_date || "").slice(0, 4) || null, why });
  return !why;
};
const feature = new Map([...films].filter(([, m]) => isFeature(m)));
for (const [, set] of seedFilms) for (const id of [...set]) if (!feature.has(id)) set.delete(id);
console.log(`phase 2: ${feature.size} feature films (${dropped.length} dropped at details level)`);

// ---- credits per film ------------------------------------------------------------------
const people = new Map(); // id -> {name, dept, profile}
function creditsOf(m) {
  const out = new Map(); // person id -> Set(roles)
  const add = (c, role) => {
    if (!out.has(c.id)) out.set(c.id, new Set());
    out.get(c.id).add(role);
    if (!people.has(c.id)) people.set(c.id, { n: c.name, d: c.known_for_department ?? null, p: c.profile_path ?? null });
    else if (!people.get(c.id).p && c.profile_path) people.get(c.id).p = c.profile_path;
  };
  for (const c of m.credits.cast) if (c.order < 10) add(c, "actor");
  for (const c of m.credits.crew) { const r = crewRole(c); if (r) add(c, r); }
  return out;
}
const filmCredits = new Map();
const rebuildCredits = () => { for (const [id, m] of feature) if (!filmCredits.has(id)) filmCredits.set(id, creditsOf(m)); };
rebuildCredits();

// ---- phase 3: promote collaborators with >= minShared films with a seed ---------------
const PROMO_ROLES = new Set(["director", "cinematographer", "editor", "composer", "writer", "actor"]);
const pair = new Map(); // `${seed}:${person}` -> {n, roles:Set}
for (const [sid, set] of seedFilms) {
  for (const fid of set) {
    for (const [pid, roles] of filmCredits.get(fid)) {
      if (pid === sid || seeds.has(pid)) continue;
      const k = `${sid}:${pid}`;
      const e = pair.get(k) ?? { sid, pid, n: 0, roles: new Set() };
      e.n++;
      for (const r of roles) if (PROMO_ROLES.has(r)) e.roles.add(r);
      pair.set(k, e);
    }
  }
}
const cand = new Map(); // person -> {best, total, roles}
for (const e of pair.values()) {
  if (!e.roles.size) continue;
  const c = cand.get(e.pid) ?? { pid: e.pid, best: 0, total: 0, roles: new Set() };
  c.best = Math.max(c.best, e.n); c.total += e.n;
  for (const r of e.roles) c.roles.add(r);
  cand.set(e.pid, c);
}
const eligible = [...cand.values()].filter((c) => c.best >= X.minSharedFilmsToPromote).sort((a, b) => b.total - a.total || a.pid - b.pid);
const promoted = eligible.slice(0, X.maxPromoted);
console.log(`phase 3: ${eligible.length} collaborators qualify, promoting ${promoted.length}`);

const promotedFilms = new Map(); // promoted id -> Set(film ids)
const newIds = new Set();
await pool(promoted, CONC, async (c) => {
  const credits = await personCredits(c.pid);
  const chosen = select(c.pid, credits, [...c.roles])
    .sort((a, b) => b.vote_count - a.vote_count)
    .slice(0, X.promotedFilmCap);
  promotedFilms.set(c.pid, new Set(chosen.map((f) => f.id)));
  for (const f of chosen) if (!feature.has(f.id)) newIds.add(f.id);
});
console.log(`phase 3: ${newIds.size} additional candidate films from promoted people`);
const more = await loadFilms(newIds);
for (const [id, m] of more) if (isFeature(m)) feature.set(id, m);
for (const set of promotedFilms.values()) for (const id of [...set]) if (!feature.has(id)) set.delete(id);
rebuildCredits();
console.log(`total feature films: ${feature.size}`);

// ---- build outputs -------------------------------------------------------------------------
const nodeIds = new Set([...seeds.keys(), ...promoted.map((p) => p.pid)]);
const nodeFilms = new Map([...seedFilms, ...promotedFilms]);
const yearOf = (m) => (m.release_date ? Number(m.release_date.slice(0, 4)) : null);

// collaborations: [aId, aRole, bId, bRole, [filmIds]] with a < b; at least one side is a node,
// and actor/actor or producer/producer pairs are skipped (see DECISIONS.md).
const SKIP_PAIR = new Set(["actor", "producer"]);
const collab = new Map();
for (const [fid, credits] of filmCredits) {
  const inFilm = [...credits];
  for (const [nid] of inFilm) {
    if (!nodeIds.has(nid)) continue;
    for (const [oid, oroles] of inFilm) {
      if (oid === nid || (nodeIds.has(oid) && oid < nid)) continue;
      for (const nr of credits.get(nid)) for (const or of oroles) {
        if (SKIP_PAIR.has(nr) && SKIP_PAIR.has(or)) continue;
        const [a, ar, b, br] = nid < oid ? [nid, nr, oid, or] : [oid, or, nid, nr];
        const k = `${a}|${ar}|${b}|${br}`;
        if (!collab.has(k)) collab.set(k, [a, ar, b, br, []]);
        collab.get(k)[4].push(fid);
      }
    }
  }
}
const collaborations = [...collab.values()].sort((x, y) => x[0] - y[0] || x[2] - y[2]);

const usedPeople = new Set(collaborations.flatMap((c) => [c[0], c[2]]));
for (const id of nodeIds) usedPeople.add(id);
const peopleOut = {};
for (const id of [...usedPeople].sort((a, b) => a - b)) {
  const p = people.get(id);
  peopleOut[id] = { n: p?.n ?? seeds.get(id)?.name ?? String(id), d: p?.d ?? null, p: p?.p ?? null, ...(seeds.has(id) ? { s: [...seeds.get(id).types] } : { pm: 1 }) };
}

const usedFilms = new Set(collaborations.flatMap((c) => c[4]));
const filmsOut = {};
for (const [id, m] of [...feature].sort((a, b) => a[0] - b[0])) {
  if (!usedFilms.has(id)) continue;
  const cr = filmCredits.get(id);
  filmsOut[id] = {
    t: m.title, y: yearOf(m), po: m.poster_path, rt: m.runtime || null,
    co: (m.production_companies ?? []).map((c) => c.name),
    cr: [...cr].flatMap(([pid, roles]) => [...roles].map((r) => [pid, r])),
  };
}

writeJson(rel("data/build/people.json"), peopleOut);
writeJson(rel("data/build/films.json"), filmsOut);
writeJson(rel("data/build/collaborations.json"), collaborations);
writeJson(rel("data/build/crawl-meta.json"), {
  generated: new Date().toISOString(),
  config: X,
  counts: { seeds: seeds.size, promoted: promoted.length, people: Object.keys(peopleOut).length, films: Object.keys(filmsOut).length, collaborations: collaborations.length },
  seedFilms: Object.fromEntries([...seedFilms].map(([k, v]) => [k, [...v]])),
  promotedFilms: Object.fromEntries([...promotedFilms].map(([k, v]) => [k, [...v]])),
  promotedList: promoted.map((p) => ({ id: p.pid, best: p.best, total: p.total, roles: [...p.roles] })),
  exclusions,
  dropped,
}, true);
console.log("counts", JSON.stringify({ people: Object.keys(peopleOut).length, films: Object.keys(filmsOut).length, collaborations: collaborations.length }));
