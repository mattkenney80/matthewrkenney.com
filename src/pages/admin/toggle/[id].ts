import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

// One-click publish/unpublish. Flips the `published` flag and returns to the list.
// Guarded by middleware (all /admin/* routes require a valid session).
export const POST: APIRoute = async ({ params }) => {
  const { DB } = env;
  await DB.prepare(
    "UPDATE articles SET published = 1 - published, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  )
    .bind(params.id)
    .run();

  return new Response(null, {
    status: 302,
    headers: { Location: "/admin" },
  });
};
