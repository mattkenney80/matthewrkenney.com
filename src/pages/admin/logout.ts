import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { deleteSession } from "../../lib/auth";

export const POST: APIRoute = async (context) => {
  const { SESSION } = env;
  const cookie = context.request.headers.get("cookie");
  const sessionId = cookie?.split("admin_session=")[1]?.split(";")[0];

  if (sessionId) {
    await deleteSession(SESSION, sessionId);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/admin/login",
      "Set-Cookie": "admin_session=; Path=/; HttpOnly; Max-Age=0",
    },
  });
};
