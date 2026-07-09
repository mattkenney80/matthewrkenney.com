// Simple session-based authentication for admin pages

export interface Session {
  authenticated: boolean;
  expiresAt: number;
}

export async function createSession(kv: any): Promise<string> {
  const sessionId = crypto.randomUUID();
  const session: Session = {
    authenticated: true,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  await kv.put(`session:${sessionId}`, JSON.stringify(session), {
    expirationTtl: 7 * 24 * 60 * 60, // 7 days in seconds
  });

  return sessionId;
}

export async function validateSession(kv: any, sessionId: string | null): Promise<boolean> {
  if (!sessionId) return false;

  try {
    const session = await kv.get(`session:${sessionId}`);
    if (!session) return false;

    const data: Session = JSON.parse(session);
    return data.authenticated && data.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export async function deleteSession(kv: any, sessionId: string): Promise<void> {
  await kv.delete(`session:${sessionId}`);
}

export function verifyPassword(password: string, env: any): boolean {
  const adminPassword = env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.warn("WARNING: ADMIN_PASSWORD not set in environment");
    return false;
  }
  return password === adminPassword;
}
