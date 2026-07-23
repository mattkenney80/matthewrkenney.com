import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { renderOgCard } from "../../../lib/og";
import { formatDate, type Article } from "../../../lib/articles";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { DB } = env;
  const post = await DB.prepare(
    "SELECT * FROM articles WHERE slug = ? AND published = 1"
  )
    .bind(params.slug)
    .first<Article>();

  if (!post) {
    return new Response("Not found", { status: 404 });
  }

  return renderOgCard({
    eyebrow: "Matthew R. Kenney · Writing",
    title: post.title,
    footer: formatDate(post.date),
  });
};
