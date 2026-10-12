// Site-level settings backed by the `settings` D1 table (key/value rows).
// Currently used for per-section nav visibility. Robust to a missing table or
// rows: anything not explicitly turned off defaults to visible.

export type SectionKey =
  | "writing"
  | "photography"
  | "experiments"
  | "movies"
  | "emblems"
  | "bicycles";

export const SECTIONS: { key: SectionKey; label: string; href: string }[] = [
  { key: "writing", label: "Writing", href: "/writing" },
  { key: "photography", label: "Photography", href: "/photography" },
  { key: "experiments", label: "Experiments", href: "/experiments" },
  { key: "movies", label: "Movies", href: "/movies" },
  { key: "emblems", label: "Emblems", href: "/emblems" },
  { key: "bicycles", label: "Bicycle Resources", href: "/bicycles" },
];

export type NavVisibility = Record<SectionKey, boolean>;

function allVisible(): NavVisibility {
  return {
    writing: true,
    photography: true,
    experiments: true,
    movies: true,
    emblems: true,
    bicycles: true,
  };
}

// Read visibility for every section. Missing table/rows => visible.
export async function getNavVisibility(DB: any): Promise<NavVisibility> {
  const vis = allVisible();
  try {
    const { results } = await DB.prepare(
      "SELECT key, value FROM settings WHERE key LIKE 'nav_%'"
    ).all();
    for (const row of results ?? []) {
      const k = String(row.key).replace(/^nav_/, "") as SectionKey;
      if (k in vis) vis[k] = String(row.value) !== "0";
    }
  } catch {
    // settings table not present yet — treat everything as visible.
  }
  return vis;
}

export async function isSectionVisible(DB: any, key: SectionKey): Promise<boolean> {
  const vis = await getNavVisibility(DB);
  return vis[key];
}

export async function setSectionVisibility(
  DB: any,
  key: SectionKey,
  visible: boolean
): Promise<void> {
  await DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
    .bind(`nav_${key}`, visible ? "1" : "0")
    .run();
}
