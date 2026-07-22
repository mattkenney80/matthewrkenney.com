import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  STRAVA_CLIENT_ID?: string;
  STRAVA_CLIENT_SECRET?: string;
  STRAVA_REFRESH_TOKEN?: string;
}

const TTL_SECONDS = 12 * 60 * 60;
const PER_PAGE = 200;
const MAX_PAGES = 20;
const CLUSTER_PRECISION = 2;
const MIN_CLUSTER_SIZE = 5;
const GEOCODE_DELAY_MS = 1100;

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

async function accessToken(env: Env): Promise<string> {
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

async function fetchAllActivities(token: string): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=${PER_PAGE}&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!r.ok) throw new Error(`Strava activities failed (${r.status})`);
    const list = (await r.json()) as any[];
    all.push(...list);
    if (list.length < PER_PAGE) break;
  }
  return all;
}

function clusterByStart(acts: any[]): { centroid: [number, number]; activities: any[] }[] {
  const groups = new Map<string, any[]>();
  for (const a of acts) {
    const ll = a.start_latlng;
    if (!Array.isArray(ll) || ll.length !== 2) continue;
    const key = ll.map((n: number) => n.toFixed(CLUSTER_PRECISION)).join(",");
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(a);
  }
  return [...groups.values()]
    .filter((g) => g.length >= MIN_CLUSTER_SIZE)
    .sort((a, b) => b.length - a.length)
    .map((activities) => {
      const lat = activities.reduce((s, a) => s + a.start_latlng[0], 0) / activities.length;
      const lon = activities.reduce((s, a) => s + a.start_latlng[1], 0) / activities.length;
      return { centroid: [lat, lon] as [number, number], activities };
    });
}

async function reverseGeocode(lat: number, lon: number): Promise<{ label: string; countryCode: string | null } | null> {
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

async function labelByLocation(activities: any[]): Promise<Map<number, string>> {
  const labels = new Map<number, string>();
  const clusters = clusterByStart(activities);
  for (const [i, cluster] of clusters.entries()) {
    if (i > 0) await sleep(GEOCODE_DELAY_MS);
    const [lat, lon] = cluster.centroid;
    const resolved = await reverseGeocode(lat, lon);
    const base = resolved?.label ?? `Unnamed area ${i + 1}`;
    const label =
      resolved?.countryCode && resolved.countryCode !== "US" ? `${base} (virtual ride)` : base;
    for (const a of cluster.activities) labels.set(a.id, label);
  }
  return labels;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET || !env.STRAVA_REFRESH_TOKEN) {
    return new Response(
      JSON.stringify({
        error: "not_configured",
        detail: "Missing Strava credentials",
      }),
      { status: 503, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/strava", request.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const token = await accessToken(env);
    const list = await fetchAllActivities(token);
    const labels = await labelByLocation(list);

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
        "cache-control": `public, max-age=${TTL_SECONDS}`,
      },
    });
    context.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "upstream_failed", detail: String(err) }),
      {
        status: 502,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    );
  }
};
