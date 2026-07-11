# matthewrkenney.com — Technical Spec Sheet

A personal site for writing, photography, and experiments. Built to be fast, cheap
(effectively $0/month), and maintainable by one person with Claude Code as the
development environment.

Live at **https://matthewrkenney.com** (www redirects to apex).

---

## Architecture at a Glance

```
Browser
   │
   ▼
Cloudflare edge (matthewrkenney.com/*)
   │
   ▼
Cloudflare Worker  ←  single deployed unit (wrangler deploy)
   ├── Static assets (ASSETS binding → dist/, built by Astro)
   ├── Server-rendered routes (articles, galleries, admin)
   ├── D1 database  ── articles, page_stats          (binding: DB)
   ├── KV namespace ── admin sessions                (binding: SESSION)
   └── Images       ── on-the-fly image optimization (binding: IMAGES)
```

Two kinds of content, stored two different ways:

| Content | Storage | Publish path | Why |
|---|---|---|---|
| **Articles** (writing) | D1 (SQLite at the edge) | SQL migration or admin UI — **no rebuild needed** | Edit/publish instantly from anywhere |
| **Photo collections** | Git repo (`src/content/photography/`) | Commit + `astro build` + deploy | Photos go through Astro's image pipeline (resizing, formats, lazy loading) |

---

## Technology Stack

### Core
| Layer | Technology | Version |
|---|---|---|
| Framework | Astro (server output) | 7.x |
| Adapter | @astrojs/cloudflare | 14.x |
| Language | TypeScript | — |
| Runtime | Cloudflare Workers | — |
| Database | Cloudflare D1 (serverless SQLite) | — |
| Sessions/cache | Cloudflare KV | — |
| Markdown | marked | 18.x |
| OG images | workers-og (dynamic social cards) | — |
| Deploy CLI | Wrangler | 4.x |
| Node | ≥ 22.12 | — |

### No frontend framework
Public pages ship **zero JavaScript** except one small vanilla-JS lightbox for photo
galleries. No React/Vue/Tailwind — hand-written CSS (~600 lines) with design tokens.

---

## Project Structure

```
matthewrkenney.com/
├── src/
│   ├── pages/
│   │   ├── index.astro                # Homepage: recent writing + featured photos
│   │   ├── about.astro
│   │   ├── writing/
│   │   │   ├── index.astro            # Article list (from D1)
│   │   │   └── [slug].astro           # Article page (D1 body → marked → HTML)
│   │   ├── photography/
│   │   │   ├── index.astro            # Collection cards
│   │   │   └── [series].astro         # Gallery: intro prose + photos + lightbox
│   │   ├── experiments/index.astro
│   │   ├── admin/                     # Auth-gated CMS (create/edit articles)
│   │   │   ├── login.astro            # Password → KV session
│   │   │   ├── logout.ts
│   │   │   └── new.astro
│   │   ├── admin-stats.astro          # View counter (noindex, auth-gated)
│   │   └── og/                        # Dynamic Open Graph images
│   ├── content/
│   │   └── photography/<series>/      # index.md (frontmatter + intro) + photos
│   ├── layouts/BaseLayout.astro       # Nav, footer, meta/OG tags, robots
│   ├── components/
│   │   ├── Lightbox.astro             # Fullscreen viewer, keyboard/touch nav
│   │   └── ArticleForm.astro
│   ├── lib/
│   │   ├── auth.ts                    # createSession / validateSession / deleteSession
│   │   ├── articles.ts                # Parameterized D1 queries
│   │   └── og.ts
│   └── styles/global.css              # Design tokens + all styling
├── public/
│   ├── images/articles/               # Photos embedded in article bodies
│   └── _headers                       # Security headers (CSP, HSTS, etc.)
├── migrations/                        # Numbered D1 migrations (0001…)
├── wrangler.jsonc                     # Bindings: DB, SESSION, IMAGES, ASSETS + routes
└── astro.config.mjs
```

---

## Key Design Decisions

1. **Articles in D1, not markdown files.** Publishing or editing an article is a
   database write — live in seconds, no build step. The article body is markdown,
   rendered server-side with `marked` on each request.

2. **Photos as content collections.** Astro's image pipeline generates responsive,
   optimized variants at build time (800px grid images, ≤2400px lightbox images,
   full-res downloads at 95% quality).

3. **Single-column photo galleries.** Personal photo sets skew landscape; a masonry
   grid squeezes wide photos into slots. One full-width column shows each photo at
   real size. `height: auto` everywhere so aspect ratios survive small screens.

4. **Session auth, not basic auth.** Login sets a UUID session in KV (7-day TTL)
   and an `HttpOnly; Secure; SameSite=Strict` cookie. Admin pages validate the
   session server-side before rendering; they're also `noindex, nofollow`.

5. **Security headers at the edge** (`public/_headers`): CSP, HSTS,
   `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, restrictive
   Permissions-Policy. All SQL is parameterized.

6. **Typography-first design.** Fraunces (serif) throughout, warm off-white
   background (`#fdfdfb`), near-black ink, hairline borders, ~34rem measure for
   prose. Minimal chrome; the content is the interface.

---

## Data Model (D1)

```sql
articles (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE,          -- /writing/<slug>
  title TEXT,
  description TEXT,
  tags TEXT,                 -- comma-separated
  date TEXT,
  body TEXT,                 -- markdown, may embed images from /images/articles/
  published INTEGER,         -- 0 = draft
  created_at, updated_at
)

page_stats (
  page_name TEXT PRIMARY KEY,
  view_count INTEGER,
  created_at, updated_at
)
```

---

## Workflows

**Publish/edit an article (no rebuild):**
```bash
npx wrangler d1 execute matthewrkenney-articles --file ./migrations/000N_xxx.sql --local
npx wrangler d1 execute matthewrkenney-articles --file ./migrations/000N_xxx.sql --remote
```
…or through `/admin/new` in the browser after logging in.

**Add photos to a collection (rebuild required):**
1. Drop JPEGs into `src/content/photography/<series>/` (convert HEIC first:
   `sips -s format jpeg in.HEIC --out out.jpg`)
2. Add entries to the `photos:` list in that series' `index.md`
3. `npm run build && npx wrangler deploy`

**Local development:**
```bash
npm run dev        # Astro dev server with emulated D1/KV
```

**Secrets:** local values in `.dev.vars` (gitignored); production via
`npx wrangler secret put ADMIN_PASSWORD`.

---

## Performance & Cost

- Static-first rendering; server routes only where content is dynamic
- Images lazy-loaded, sized variants, edge-cached; `_astro/*` assets immutable
- Typical page load measured ~50ms on broadband
- Runs entirely on Cloudflare free tiers: Workers (100k req/day), D1, KV
