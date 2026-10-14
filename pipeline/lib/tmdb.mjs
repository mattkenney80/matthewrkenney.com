// Minimal TMDB v3 client. Reads TMDB_API_KEY from the repo's gitignored .env.
// The key is only ever sent to api.themoviedb.org and is never logged.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const envPath = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);

const KEY = process.env.TMDB_API_KEY;
if (!KEY) {
  console.error("TMDB_API_KEY is not set. Copy .env.example to .env and add your key.");
  process.exit(1);
}

export async function tmdb(path, params = {}, attempt = 0) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("api_key", KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url);
  if (res.status === 429 && attempt < 4) {
    await sleep((Number(res.headers.get("retry-after")) || 1) * 1000);
    return tmdb(path, params, attempt + 1);
  }
  // Report the path only, never the URL, so the key cannot leak into output.
  if (!res.ok) throw new Error(`TMDB responded ${res.status} for ${path}`);
  return res.json();
}
