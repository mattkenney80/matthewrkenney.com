import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const rel = (...p) => join(ROOT, ...p);

export const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
export function writeJson(p, v, pretty = false) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, pretty ? JSON.stringify(v, null, 2) + "\n" : JSON.stringify(v));
}

// Run fn over items with a fixed number of workers. Results keep input order.
export async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

// Disk cache for raw TMDB responses (data/raw is gitignored).
export async function cached(kind, key, fetcher) {
  const file = rel("data/raw", kind, `${key}.json`);
  if (existsSync(file)) return readJson(file);
  const value = await fetcher();
  writeJson(file, value);
  return value;
}
