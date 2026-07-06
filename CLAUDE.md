# matthewrkenney.com

Matthew R. Kenney's personal site: writing, photography, and an experiments playground.
This is a separate project from "MK Website Ideas" (the API-playground/project-showcase
site) — different domain, different concept. Don't conflate the two.

This file is read automatically at the start of every Claude Code session. Keep it current.

## Purpose

1. Publish writing (essays, notes, short posts) easily and often.
2. A photography portfolio, built from scratch — photo series/galleries, image-forward.
3. `/experiments` — a freeform playground for one-off layouts/interactions/demos that
   shouldn't disrupt the writing or photography sections.

## Stack

- **Astro** (v7, static output) — content collections for writing + photography.
- Plain CSS with design tokens in `src/styles/global.css` (no framework).
- **No CMS/backend.** Content is authored as local markdown files, published via git push.
- **Cloudflare Pages** — static hosting. Build command `npm run build`, output dir `dist`.
  Custom domain: matthewrkenney.com (already registered/managed on Cloudflare).
- No Functions/API routes needed for the current scope — this is a fully static site.
  If that changes (e.g. a contact form, comments), follow the same "keys never touch the
  frontend" rule as the sibling project.

## Structure

```
src/
├── content.config.ts        # writing + photography collection schemas (glob loader)
├── content/
│   ├── writing/              # one .md per post
│   └── photography/           # one folder per series: index.md + colocated images
├── layouts/BaseLayout.astro   # nav, footer, <head>, imports global.css
├── styles/global.css          # design tokens + base styles
└── pages/
    ├── index.astro            # intro + recent writing + featured photo
    ├── writing/index.astro    # post list, newest first
    ├── writing/[slug].astro   # individual post
    ├── photography/index.astro
    ├── photography/[series].astro
    └── experiments/index.astro
```

### Content collection conventions

- **Writing** (`src/content/writing/*.md`): frontmatter `title`, `description?`, `date`,
  `tags[]`, `cover?` (image), `draft?` (bool, default false). Drafts are filtered out of
  all listing/build queries — check `!data.draft` when calling `getCollection`.
- **Photography** (`src/content/photography/<series-slug>/index.md`): one folder per
  series so cover/photo images can sit right next to the markdown file and resolve via
  Astro's `image()` schema helper (relative paths, e.g. `./01.jpg`). Frontmatter: `title`,
  `description?`, `date`, `cover?`, `photos[]` (each `{ src, alt, caption? }`), `draft?`.
- Adding a post = adding a markdown file. Adding a series = adding a folder with images.
  No code changes needed for either.
- The `first-light` photography entry and `hello-world` writing post are placeholders —
  solid-color PNGs stand in for real photos. Replace/delete once there's real content.

## Design direction

Minimal, text-forward for writing; image-forward for photography. Personal, a little
experimental — not a generic template. Current starting palette (in `global.css` custom
properties, easy to retune):

- Background: `#fdfdfb` (warm off-white) — Ink: `#1a1a1a` — Muted text: `#55534d`
- Border/hairline: `#e5e2da` — Accent: `#a1442a` (rust, used sparingly for hover states)
- Serif (`Iowan Old Style`/Georgia stack) for headings and post body; sans-serif
  (system UI stack) for nav/meta/UI chrome.

This palette is a placeholder starting point, not a locked-in brand system — revisit
once there's real photography to design around.

## How I want Claude to work here

- Prefer small, reviewable changes. Explain the "why" briefly, not every line.
- Adding a new experiment page = add a route under `src/pages/experiments/` and add an
  entry to the `experiments` array in `src/pages/experiments/index.astro`.
- Keep the photography section image-quality-first: reasonable lazy-loading, no
  aggressive compression, let Astro's built-in image optimization do the resizing work
  (use the `<Image>` component from `astro:assets`, not raw `<img>`, for anything sourced
  from a content collection).
- Be concise. I'm technical (senior solutions engineer); skip basic explanations unless asked.

## Status / next steps

- [x] Scaffold Astro project, content collections (writing + photography), base layout,
      global styles.
- [x] Homepage, writing index/post pages, photography gallery/series pages, barebones
      `/experiments` index.
- [x] Placeholder content (one post, one photo series with solid-color placeholder images)
      so the build/pages have something to render.
- [ ] Replace placeholder photos with real images; replace/expand the placeholder post.
- [ ] Connect GitHub repo + Cloudflare Pages for a live URL at matthewrkenney.com.
- [ ] Decide whether writing posts use `.md` or `.mdx` (MDX only needed if embedding
      components in post bodies — not wired up yet, add `@astrojs/mdx` if so).
