import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const TTL_SECONDS = 12 * 60 * 60;
const PER_PAGE = 200;
const MAX_PAGES = 20;
const CLUSTER_PRECISION = 2;
const MIN_CLUSTER_SIZE = 5;
const GEOCODE_DELAY_MS = 1100;
// New places looked up per request. Nominatim allows one request per second and
// Workers cap subrequests per invocation, so a cold start with many unseen
// places fills in over a few requests instead of one very long one.
const MAX_NEW_GEOCODES = 20;
// A response that still has unresolved places is cached only briefly, so the
// next request picks up where this one stopped.
const PARTIAL_TTL_SECONDS = 60;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const slim = (a: any, locationLabel: string) => ({
  id: a.id,
  name: a.name,
  type: a.sport_type ?? a.type,
  distanceMi: Math.round((a.distance / 1609.34) * 10) / 10,
  movingTimeS: a.moving_time,
  elevationGainM: Math.round(a.total_elevation_gain ?? 0),
  avgSpeedMph: a.average_speed
    ? Math.round(a.average_speed * 2.23694 * 10) / 10
    : null,
  startDate: a.start_date_local,
  locationLabel,
  polyline: a.map?.summary_polyline ?? null,
  kudos: a.kudos_count ?? 0,
});

async function accessToken(): Promise<string> {
  const r = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: env.STRAVA_REFRESH_TOKEN,
    }),
  });
  if (!r.ok) throw new Error(`Strava token exchange failed (${r.status})`);
  const j = (await r.json()) as { access_token?: string };
  if (!j.access_token) throw new Error("No access_token in Strava response");
  return j.access_token;
}

// Pages are fetched a few at a time rather than strictly one after another:
// Strava's pages are large (full summary polylines), so the sequential round
// trips were the biggest slice of a cold start once geocoding was cached.
const PAGE_BATCH = 4;

async function fetchPage(token: string, page: number): Promise<any[]> {
  const r = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=${PER_PAGE}&page=${page}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) throw new Error(`Strava activities failed (${r.status})`);
  return (await r.json()) as any[];
}

async function fetchAllActivities(token: string): Promise<any[]> {
  const all: any[] = [];
  for (let first = 1; first <= MAX_PAGES; first += PAGE_BATCH) {
    const count = Math.min(PAGE_BATCH, MAX_PAGES - first + 1);
    const pages = await Promise.all(
      Array.from({ length: count }, (_, i) => fetchPage(token, first + i)),
    );
    let finished = false;
    for (const list of pages) {
      all.push(...list);
      if (list.length < PER_PAGE) {
        finished = true;
        break;
      }
    }
    if (finished) break;
  }
  return all;
}

type Cluster = { key: string; centroid: [number, number]; activities: any[] };

function clusterByStart(acts: any[]): Cluster[] {
  const groups = new Map<string, any[]>();
  for (const a of acts) {
    const ll = a.start_latlng;
    if (!Array.isArray(ll) || ll.length !== 2) continue;
    const key = ll.map((n: number) => n.toFixed(CLUSTER_PRECISION)).join(",");
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = [];
      groups.set(key, bucket);
    }
    bucket.push(a);
  }
  return [...groups.values()]
    .filter((g) => g.length >= MIN_CLUSTER_SIZE)
    .sort((a, b) => b.length - a.length)
    .map((activities) => {
      const lat = activities.reduce((s, a) => s + a.start_latlng[0], 0) / activities.length;
      const lon = activities.reduce((s, a) => s + a.start_latlng[1], 0) / activities.length;
      const key = activities[0].start_latlng
        .map((n: number) => n.toFixed(CLUSTER_PRECISION))
        .join(",");
      return { key, centroid: [lat, lon] as [number, number], activities };
    });
}

async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<{ label: string; countryCode: string | null } | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
  const r = await fetch(url, {
    headers: {
      "User-Agent": "matthewrkenney-experiments (personal site; low-volume reverse geocoding)",
    },
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { address?: Record<string, string>; display_name?: string };
  const addr = j.address ?? {};
  const place = addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? addr.county;
  const region = addr.state ?? addr.country;
  const label = [place, region].filter(Boolean).join(", ") || j.display_name;
  if (!label) return null;
  return { label, countryCode: addr.country_code ? addr.country_code.toUpperCase() : null };
}

type CachedPlace = { label: string; country: string | null };

async function loadGeocodeCache(): Promise<Map<string, CachedPlace>> {
  const out = new Map<string, CachedPlace>();
  try {
    const { results } = await env.DB.prepare("SELECT cell, label, country FROM geocode_cache").all();
    for (const r of (results ?? []) as any[]) out.set(r.cell, { label: r.label, country: r.country });
  } catch {
    // table not created yet: behave as an empty cache
  }
  return out;
}

async function saveGeocodeCache(rows: { cell: string; label: string; country: string | null }[]) {
  if (!rows.length) return;
  try {
    await env.DB.batch(
      rows.map((r) =>
        env.DB.prepare(
          "INSERT OR REPLACE INTO geocode_cache (cell, label, country) VALUES (?, ?, ?)",
        ).bind(r.cell, r.label, r.country),
      ),
    );
  } catch (err) {
    console.error("geocode cache write failed", err);
  }
}

async function labelByLocation(
  activities: any[],
): Promise<{ labels: Map<number, string>; complete: boolean }> {
  const labels = new Map<number, string>();
  const clusters = clusterByStart(activities);
  const cache = await loadGeocodeCache();
  const fresh: { cell: string; label: string; country: string | null }[] = [];
  let lookedUp = 0;
  let complete = true;

  for (const cluster of clusters) {
    let place = cache.get(cluster.key);
    if (!place) {
      if (lookedUp >= MAX_NEW_GEOCODES) {
        complete = false;
        continue;
      }
      if (lookedUp > 0) await sleep(GEOCODE_DELAY_MS);
      lookedUp++;
      const [lat, lon] = cluster.centroid;
      const resolved = await reverseGeocode(lat, lon);
      if (!resolved) {
        complete = false; // try again next time rather than caching a failure
        continue;
      }
      place = { label: resolved.label, country: resolved.countryCode };
      cache.set(cluster.key, place);
      fresh.push({ cell: cluster.key, ...place });
    }
    const label =
      place.country && place.country !== "US" ? `${place.label} (virtual ride)` : place.label;
    for (const a of cluster.activities) labels.set(a.id, label);
  }

  await saveGeocodeCache(fresh);
  return { labels, complete };
}

export const GET: APIRoute = async ({ request }) => {
  if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET || !env.STRAVA_REFRESH_TOKEN) {
    return new Response(
      JSON.stringify({ error: "not_configured", detail: "Missing Strava credentials" }),
      { status: 503, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }

  const cache = caches.default;
  // v3: bumped after geocoding moved to the D1 cache and page fetches went parallel.
  const cacheKey = new Request(new URL("/api/strava?cache=v3", request.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const token = await accessToken();
    const list = await fetchAllActivities(token);
    const { labels, complete } = await labelByLocation(list);

    const body = {
      count: list.length,
      activities: list.map((a) =>
        slim(
          a,
          labels.get(a.id) ??
            (Array.isArray(a.start_latlng) ? "Other locations" : "Unknown location"),
        ),
      ),
    };

    const res = new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": `public, max-age=${complete ? TTL_SECONDS : PARTIAL_TTL_SECONDS}`,
        "x-geocode": complete ? "complete" : "partial",
      },
    });
    await cache.put(cacheKey, res.clone());
    return res;
  } catch (err) {
    return new Response(JSON.stringify({ error: "upstream_failed", detail: String(err) }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};
