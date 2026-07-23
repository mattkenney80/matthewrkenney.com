import type { APIRoute } from "astro";
import { renderOgCard } from "../../lib/og";

export const prerender = false;

export const GET: APIRoute = async () => {
  return renderOgCard({
    eyebrow: "Matthew R. Kenney",
    title: "Writing, photography, and experiments in AI.",
  });
};
