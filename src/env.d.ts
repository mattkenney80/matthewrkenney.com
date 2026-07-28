// Secrets set via `wrangler secret put` — not present in the generated
// worker-configuration.d.ts, so declare them here where regeneration won't clobber them.
interface Env {
  STRAVA_CLIENT_ID?: string;
  STRAVA_CLIENT_SECRET?: string;
  STRAVA_REFRESH_TOKEN?: string;
}

declare namespace Cloudflare {
  interface Env {
    STRAVA_CLIENT_ID?: string;
    STRAVA_CLIENT_SECRET?: string;
    STRAVA_REFRESH_TOKEN?: string;
  }
}
