# matthewrkenney.com

Matthew R. Kenney's personal site: writing, photography, and an experiments playground.
This is a separate project from "MK Website Ideas" (the API-playground/project-showcase
site) — different domain, different concept. Don't conflate the two.

This file is read automatically at the start of every Claude Code session. Keep it current.

## Purpose

1. Publish writing (essays, notes, short posts) via a simple CMS.
2. A photography portfolio — photo series/galleries, image-forward, click-to-full-size.
3. `/experiments` — a freeform playground for one-off layouts/interactions/demos that
   shouldn't disrupt the writing or photography sections.

## Stack

- **Astro v7**, `@astrojs/cloudflare` adapter. Default output is `static`; individual
  pages opt into on-demand (server) rendering with `export const prerender = false`.
  Photography/experiments/homepage-hero stay static; writing + admin are on-demand
  because they read from D1.
- Plain CSS with design tokens in `src/styles/global.css` (no framework).
- **Writing has a real CMS**: articles live in a Cloudflare D1 database (`matthewrkenney-articles`,
  binding `DB`), not markdown files. Published/edited via `/admin` (see below).
- **Photography stays file-based**: one content-collection folder per series/album under
  `src/content/photography/<slug>/`, images colocated with `index.md`. No CMS for this —
  adding an album means copying image files in and writing frontmatter (see conventions
  below). This was a deliberate choice: photo sets are bulk/infrequent, articles are
  frequent — different authoring cadences, different mechanisms.
- **Deployed as a Cloudflare Worker with static assets** (not Cloudflare Pages — the
  current `@astrojs/cloudflare` adapter targets Workers only; Pages Functions/`wrangler
  pages deploy` is the legacy path and was migrated off of). Deploy with:
  ```
  npm run build && npx wrangler deploy
  ```
  Config lives in `wrangler.jsonc` (worker name `matthewrkenney-com`, `assets` binding
  pointing at `./dist`, `d1_databases` binding `DB`).
- **Cloudflare bindings access**: `import { env } from "cloudflare:workers"` then
  `const { DB } = env;` — NOT `Astro.locals.runtime.env` (that was removed as of the
  Astro version this project is on; using it throws at runtime, not build time, so it's
  easy to miss until you actually hit the page).

### Deployment details

- Repo: github.com/mattkenney80/matthewrkenney.com (public). Not Git-connected for
  auto-deploy — deploys are manual (`wrangler deploy`) after `npm run build`. Connecting
  GitHub for push-to-deploy was attempted once and abandoned (see below); still an open
  option if revisited.
- Live at matthewrkenney.com and www.matthewrkenney.com. DNS: root (`@`) and `www` are
  CNAME records in the `matthewrkenney.com` zone. **These currently point at the OLD
  Cloudflare Pages project's `.pages.dev` target** — the domain cutover to the new Worker
  deployment (`matthewrkenney-com.matthew-kenney80.workers.dev`) has NOT been finished.
  Until that cutover happens, the custom domain may be serving a stale/different version
  than the workers.dev URL. Check current DNS records before assuming which one is live.
- **Bot Fight Mode is OFF** for the `matthewrkenney.com` zone (was on by default, caused a
  JS-challenge page for non-browser requests like `curl` — turned off since a personal
  site doesn't need it).
- Attempting to connect Cloudflare Pages/Workers to GitHub via the dashboard's OAuth popup
  flow reliably hangs in browser automation (GitHub authorization step unreachable; direct
  navigation to github.com is also blocked by a Chrome-extension domain allowlist). If
  automating Cloudflare↔GitHub linkage again, expect this and fall back to
  `wrangler login` (stays on cloudflare.com, works fine) + direct-upload/`wrangler deploy`.

## Structure

```
src/
├── content.config.ts          # photography collection schema (glob loader; writing is DB-backed, no collection)
├── content/
│   └── photography/           # one folder per series: index.md + colocated images
├── lib/articles.ts             # Article type, slugify, formatDate, articleTags — shared by writing + admin pages
├── components/
│   ├── ArticleForm.astro       # shared create/edit form for admin
│   └── Lightbox.astro          # full-size photo viewer, paired with .photo-trigger buttons
├── layouts/BaseLayout.astro    # nav, footer, <head>, imports global.css
├── styles/global.css           # design tokens + base styles (admin UI + gallery/lightbox styles live here too)
└── pages/
    ├── index.astro             # intro + recent writing (from D1) + featured photo (from collection)
    ├── writing/index.astro     # SSR, published articles from D1, newest first
    ├── writing/[slug].astro    # SSR, single article from D1, renders body with `marked`
    ├── photography/index.astro # static, album covers
    ├── photography/[series].astro  # static, masonry grid + Lightbox
    ├── experiments/index.astro
    └── admin/
        ├── index.astro         # SSR, list all articles (draft + published), delete
        ├── new.astro            # SSR, create form
        ├── edit/[id].astro      # SSR, edit form
        └── delete/[id].astro    # POST-only, deletes + redirects
```

### Writing / CMS conventions (D1-backed)

- `articles` table: `id, slug (unique), title, description, tags (comma-separated string),
  date (YYYY-MM-DD text), body (markdown text), published (0/1), created_at, updated_at`.
  Schema/migrations in `migrations/0001_articles.sql`.
- Local dev DB and production DB are separate — `wrangler d1 migrations apply
  matthewrkenney-articles --local` vs `--remote`. Both need migrating when the schema
  changes.
- `/admin` is **not** auth-gated yet at the app level — the plan was Cloudflare Access
  (dashboard-configured, zero app code) to gate the `/admin/*` path, but that dashboard
  step hasn't been done. Treat `/admin` as currently open to anyone who finds the URL
  until Access (or equivalent) is configured — flag this if asked to touch auth.
- Markdown body is rendered with `marked` at request time (`src/pages/writing/[slug].astro`
  and `index.astro`). No sanitization is applied — acceptable only because `/admin` is
  meant to be single-owner; revisit if that access model changes.
- To publish/edit/delete content programmatically (e.g. bulk import), you can POST
  directly to `/admin/new`, `/admin/edit/[id]`, `/admin/delete/[id]` with form-encoded
  data — that's how bulk edits have been done in this project so far (via `curl
  --data-urlencode`), rather than hand-writing SQL INSERTs (avoids manual SQL-escaping of
  apostrophes/quotes in prose).

### Photography conventions (file-based, not DB)

- `src/content/photography/<series-slug>/index.md`: one folder per series/album so
  images sit next to the markdown and resolve via Astro's `image()` schema helper
  (relative paths, e.g. `./photo1.jpg`). Frontmatter: `title`, `description?`, `date`,
  `cover?`, `photos[]` (each `{ src, alt, caption? }`), `draft?`.
- For albums with many photos (dozens+), hand-writing frontmatter is impractical — generate
  it with a small script (list the directory, emit YAML) rather than transcribing by hand.
  See git history for the `bicycle-crimes` album for an example approach.
- **Full-size viewing**: `photography/[series].astro` computes three renders per photo via
  `getImage()`: a grid thumbnail (800w), a lightbox "view" size (capped at min(native, 2400)
  to avoid upscaling small source images), and a "download full size" version at the
  photo's true native width, `format: "jpg"`, `quality: 95` (explicit format — otherwise
  Astro's default output format is webp, not ideal for a "download the original quality"
  link). All three go through Astro's `/_image` on-demand endpoint — **images are NOT
  pre-resized at build time**; the build just copies originals into `_astro/` and emits
  `/_image?href=...` URLs that get transformed on first request (edge-cached after). This
  is why builds stay fast even with 100+ full-resolution photos in a collection.
- `Lightbox.astro` pairs with any `button.photo-trigger` carrying `data-full` / `data-download`
  / `data-alt` / `data-caption` attributes — click opens it, arrow keys/buttons navigate,
  Esc/click-outside closes, download link in the corner points at the native-resolution
  render.
- Photo source files are committed to the repo (in `src/content/photography/`) — this
  makes the repo large (100s of MB once a few albums exist) but keeps the build
  self-contained. No R2/external storage wired up currently.

## Design direction

Minimal, text-forward for writing; image-forward for photography — masonry-style photo
grids, generous whitespace, distraction-free full-screen lightbox, cover images cropped to
a 3:2 frame on the album index. Personal, a little experimental — not a generic template.
Palette (in `global.css` custom properties, easy to retune):

- Background: `#fdfdfb` (warm off-white) — Ink: `#1a1a1a` — Muted text: `#55534d`
- Border/hairline: `#e5e2da` — Accent: `#a1442a` (rust, used sparingly for hover states)
- Serif (`Iowan Old Style`/Georgia stack) for headings and post body; sans-serif
  (system UI stack) for nav/meta/UI chrome/admin.
- Lightbox backdrop is a deliberate exception to the light theme — near-black, standard
  convention for photo viewing so images pop.

## How I want Claude to work here

- Prefer small, reviewable changes. Explain the "why" briefly, not every line.
- Adding a new experiment page = add a route under `src/pages/experiments/` and add an
  entry to the `experiments` array in `src/pages/experiments/index.astro`.
- Be concise. I'm technical (senior solutions engineer); skip basic explanations unless asked.
- When adding a photography album, ask about/confirm the cover image choice if it's not
  obvious — there's no admin UI to change it later, unlike articles.

## Status / next steps

- [x] Astro site, Cloudflare Worker deployment, custom domain DNS records created.
- [x] Writing CMS: D1-backed articles, `/admin` create/edit/delete/list, markdown
      rendering, first real post published ("Sebastian").
- [x] Photography: masonry gallery + full-size lightbox + download-original link;
      "Bicycle Crimes" album (131 photos) published as the first real album.
- [ ] **Domain cutover incomplete**: matthewrkenney.com DNS still points at the old
      Pages project, not the current Worker deployment. Needs fixing.
- [ ] `/admin` has no auth gate yet (Cloudflare Access was the plan, dashboard-only step,
      not done).
- [ ] Optionally connect GitHub to Cloudflare for auto-deploy-on-push (currently manual).
- [ ] Decide whether writing posts ever need MDX (component embeds) — currently plain
      markdown via `marked` is sufficient.
