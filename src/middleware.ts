import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { readSessionCookie, verifySessionToken } from "./lib/auth";

// Guard every /admin route behind a valid signed session cookie.
// The login page itself must stay reachable so you can authenticate.
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isLogin = pathname === "/admin/login";

  if (isAdmin && !isLogin) {
    const token = readSessionCookie(context.request);
    const ok = await verifySessionToken(env, token);
    if (!ok) {
      return context.redirect("/admin/login");
    }
  }

  return next();
});
