// Copy the committed data/build output into public/film-repertory for the site, and derive
// the small owner overlay (ratings, essays, kids status only; never kids' notes or grades).
import { copyFileSync, mkdirSync } from "node:fs";
import { readJson, rel, writeJson } from "./lib/util.mjs";

const out = rel("public/film-repertory");
mkdirSync(out, { recursive: true });
for (const f of ["people", "films", "collaborations"]) copyFileSync(rel(`data/build/${f}.json`), `${out}/${f}.json`);

const owner = {};
const slot = (id) => (owner[id] ??= {});
for (const f of readJson(rel("data/owner/letterboxd.json"))) if (f.tmdbId && f.rating != null) slot(f.tmdbId).r = f.rating;
for (const f of readJson(rel("data/owner/essays.json"))) if (f.tmdbId) slot(f.tmdbId).e = { note: f.note, url: f.essayUrl, doc: !!f.documentary };
for (const f of readJson(rel("data/owner/kids.json")).films) if (f.tmdbId && !f.tvMiniseries) slot(f.tmdbId).k = f.status;
writeJson(`${out}/owner.json`, owner);
console.log(`published to public/film-repertory (${Object.keys(owner).length} owner films)`);
