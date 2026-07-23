// Stateless signed-cookie authentication for the admin panel.
// No KV / session store needed: the cookie is an HMAC-signed expiry stamp that
// the server re-verifies on every request. Sole-admin, single password.

const COOKIE_NAME = "admin_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Secret used to sign session cookies. Prefer a dedicated SESSION_SECRET; fall
// back to ADMIN_PASSWORD so the site still works if only the password is set.
function getSecret(env: any): string {
  return env?.SESSION_SECRET || env?.ADMIN_PASSWORD || "";
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Length-independent constant-time-ish string compare.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function verifyPassword(password: string, env: any): boolean {
  const adminPassword = env?.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.warn("WARNING: ADMIN_PASSWORD not set in environment");
    return false;
  }
  return safeEqual(password, adminPassword);
}

// Build a signed token of the form "<expiryMs>.<hmacHex>".
export async function createSessionToken(env: any): Promise<string> {
  const payload = String(Date.now() + SESSION_TTL_SECONDS * 1000);
  const sig = await hmacHex(getSecret(env), payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(
  env: any,
  token: string | null | undefined
): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expiry = Number(payload);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  const expected = await hmacHex(getSecret(env), payload);
  return safeEqual(sig, expected);
}

export function sessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function readSessionCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  return match ? match[1] : null;
}
