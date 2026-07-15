// GET /api/strava — full cycling history from Strava, with human-readable
// starting locations.
//
// OAuth2: exchanges a stored long-lived refresh token for a short-lived access
// token server-side, then pages through the athlete's entire activity history.
// Client secret and tokens are read from Cloudflare secrets (env) and NEVER
// reach the browser. Strava no longer populates location_city/state for this
// athlete — only start_latlng (GPS) is reliable — so activities are grouped
// into start-location clusters and each cluster's centroid is reverse-geocoded
// via Nominatim/OpenStreetMap (free, no key) into a place name like "Hoboken,
// New Jersey". Geocoding only the handful of cluster centroids (not all
// activities) keeps this far under Nominatim's ~1 req/sec usage policy. The
// combined, labeled history is cached via caches.default with a long TTL —
// full history changes slowly (only new rides append), and re-fetching +
// re-geocoding on every request would burn through both Strava's rate limits
// (200 req / 15 min, 2000 req / day) and Nominatim's. See README for how to
// obtain Strava credentials.

interface Env {
  STRAVA_CLIENT_ID?: string;
  STRAVA_CLIENT_SECRET?: string;
  STRAVA_REFRESH_TOKEN?: string;
}

const TTL_SECONDS = 12 * 60 * 60; // 12h — full history changes slowly
const PER_PAGE = 200; // Strava's max per page
const MAX_PAGES = 20; // bounds worst case at 4,000 activities

const json = (body: unknown, maxAge: number, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": maxAge > 0 ? `public, max-age=${maxAge}` : "no-store",
    },
  });

const configured = (env: Env) =>
  !!(env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET && env.STRAVA_REFRESH_TOKEN);

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

// Trim Strava's verbose activity to what the page needs, attaching the
// human-readable starting place resolved by labelByLocation().
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

const CLUSTER_PRECISION = 2; // ≈ 1.1 km buckets
const MIN_CLUSTER_SIZE = 5; // groups smaller than this fold into "Other locations"
const GEOCODE_DELAY_MS = 1100; // stay under Nominatim's ~1 req/sec usage policy

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Group activities that start near each other into clusters with a centroid,
// large enough to be worth naming individually.
function clusterByStart(
  acts: any[],
): { centroid: [number, number]; activities: any[] }[] {
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

// Resolve a human-readable starting place per activity by reverse-geocoding
// only the cluster centroids (a handful of requests, not one per activity).
// Geocoded spots outside the US are flagged "(virtual ride)" — Strava/Zwift
// occasionally assigns indoor/trainer rides bogus overseas GPS coordinates,
// and a real-world cluster of rides abroad would be rare enough to show up as
// its own small "Other locations" entry rather than a named cluster.
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

// Page through the athlete's full activity history, stopping at the first
// short/empty page (Strava returns fewer than per_page on the last page).
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  if (!configured(env)) {
    return json(
      {
        error: "not_configured",
        detail:
          "Missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_REFRESH_TOKEN. Add them to .dev.vars (local) or via `wrangler pages secret put` (prod). See README.",
      },
      0,
      503,
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
    const res = json(body, TTL_SECONDS);
    context.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (err) {
    return json({ error: "upstream_failed", detail: String(err) }, 0, 502);
  }
};
