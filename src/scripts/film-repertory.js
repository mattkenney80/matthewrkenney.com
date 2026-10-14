// Film Repertory client. Plain DOM and SVG, no charting library: the ring layout and the
// timeline are a few dozen lines of arithmetic each, and a polar layout is the whole point.
//
// Data (from pipeline/publish.mjs):
//   people.json         id -> {n name, d dept, p profile path, s seed roles | pm promoted}
//   films.json          id -> {t title, y year, po poster, rt runtime, co companies, cr [[person, role]]}
//   collaborations.json [[a, aRole, b, bRole, [film ids]]]  (at least one side is a full node)
//   owner.json          film id -> {r rating, e essay, k kids status}

const NS = "http://www.w3.org/2000/svg";
const IMG = "https://image.tmdb.org/t/p/";
const ROLE_ORDER = ["director", "cinematographer", "editor", "composer", "writer", "actor", "producer"];
const ROLE_COLOR = {
  director: "#a1442a", cinematographer: "#2e5e7e", editor: "#5d7a3a", composer: "#9a7420",
  writer: "#6a4a82", actor: "#77746b", producer: "#aaa69c",
};
const ROLE_LABEL = {
  director: "Director", cinematographer: "Cinematographer", editor: "Editor", composer: "Composer",
  writer: "Writer", actor: "Actor", producer: "Producer",
};
const DEFAULTS = { director: 1032, cinematographer: 151, writer: 3027, actor: 1037, editor: null, composer: null };
const MAX_HEAT_ROWS = 40;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (id) => document.getElementById(id);
const stage = $("fr-stage"), card = $("fr-card"), detail = $("fr-detail"), legend = $("fr-legend"), status = $("fr-status");

function svg(name, attrs = {}, parent) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}
function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
}
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

let people, films, collab, owner;
const adj = new Map();        // person -> rows they appear in
const domRole = new Map();    // person -> role they hold most often
const filmCount = new Map();  // person -> films in the dataset
const roleCount = new Map();  // person -> {role: films}

const isNode = (id) => !!(people[id]?.s || people[id]?.pm);
const nameOf = (id) => people[id]?.n ?? `#${id}`;
const yearRange = (set) => {
  const ys = [...set].map((f) => films[f]?.y).filter((y) => y != null);
  return ys.length ? [Math.min(...ys), Math.max(...ys)] : [null, null];
};
const spanText = (set) => { const [a, b] = yearRange(set); return a == null ? "" : a === b ? `${a}` : `${a} to ${b}`; };

function index() {
  for (const row of collab) {
    for (const id of [row[0], row[2]]) {
      if (!adj.has(id)) adj.set(id, []);
      adj.get(id).push(row);
    }
  }
  for (const f of Object.values(films)) {
    const seen = new Set();
    for (const [pid, role] of f.cr) {
      const rc = roleCount.get(pid) ?? roleCount.set(pid, {}).get(pid);
      rc[role] = (rc[role] ?? 0) + 1;
      seen.add(pid);
    }
    for (const pid of seen) filmCount.set(pid, (filmCount.get(pid) ?? 0) + 1);
  }
  for (const [pid, rc] of roleCount) {
    const best = Object.entries(rc).sort((a, b) => b[1] - a[1] || ROLE_ORDER.indexOf(a[0]) - ROLE_ORDER.indexOf(b[0]))[0];
    domRole.set(pid, best[0]);
  }
  // Seeds keep the role they were seeded as; the credit count only decides for promoted people.
  for (const [pid, p] of Object.entries(people)) if (p.s?.length) domRole.set(Number(pid), p.s[0]);
}

// Everyone who shares a film with pid, with the films grouped by the other person's role.
function collaboratorsOf(pid) {
  const out = new Map();
  for (const row of adj.get(pid) ?? []) {
    const [a, ar, b, br, fs] = row;
    const [other, oRole, mine] = a === pid ? [b, br, ar] : [a, ar, br];
    if (other === pid) continue;
    let c = out.get(other);
    if (!c) out.set(other, (c = { id: other, films: new Set(), roles: {} }));
    for (const f of fs) c.films.add(f);
    (c.roles[oRole] ??= new Set());
    for (const f of fs) c.roles[oRole].add(f);
    c.mine ??= new Set();
    c.mine.add(mine);
  }
  for (const c of out.values()) {
    c.role = Object.entries(c.roles).sort((x, y) => y[1].size - x[1].size || ROLE_ORDER.indexOf(x[0]) - ROLE_ORDER.indexOf(y[0]))[0][0];
  }
  return out;
}

// ---- owner layer ------------------------------------------------------------------------------
let ownerOn = false;
const ownerBadge = (fid) => owner[fid] ?? null;
function ownerText(fid) {
  const o = ownerBadge(fid);
  if (!ownerOn || !o) return "";
  const bits = [];
  if (o.r != null) bits.push(`${"★".repeat(o.r)} rated`);
  if (o.e) bits.push("essay");
  if (o.k) bits.push(o.k === "watched" ? "watched with the boys" : o.k === "hold" ? "on hold for the boys" : "queued for the boys");
  return bits.join(" · ");
}

// ---- state and URL -----------------------------------------------------------------------------
const state = { v: "c", p: 1032, ring: 2, hm: "actors" };
const VIEWS = { c: "Constellation", r: "Career River", h: "Heatmap" };
function readUrl() {
  const q = new URLSearchParams(location.search);
  if (VIEWS[q.get("v")]) state.v = q.get("v");
  const p = Number(q.get("p"));
  if (p && people[p] && isNode(p)) state.p = p;
  const r = Number(q.get("ring"));
  if ([1, 2, 3].includes(r)) state.ring = r;
  if (["actors", "crew", "writers", "dps"].includes(q.get("hm"))) state.hm = q.get("hm");
}
function writeUrl(push) {
  const q = new URLSearchParams();
  q.set("v", state.v);
  if (state.v !== "h") q.set("p", state.p);
  if (state.v === "c") q.set("ring", state.ring);
  if (state.v === "h") q.set("hm", state.hm);
  const url = `${location.pathname}?${q}`;
  push ? history.pushState(null, "", url) : history.replaceState(null, "", url);
}
function go(patch, push = true) {
  Object.assign(state, patch);
  writeUrl(push);
  render();
}

// ---- hover card -----------------------------------------------------------------------------------
function showCard(anchor, content) {
  card.replaceChildren(...content);
  card.hidden = false;
  const box = stage.getBoundingClientRect(), a = anchor.getBoundingClientRect(), host = card.offsetParent.getBoundingClientRect();
  let x = a.left - host.left + a.width + 10, y = a.top - host.top - 6;
  if (x + card.offsetWidth > host.width) x = a.left - host.left - card.offsetWidth - 10;
  if (x < 0) x = 4;
  y = Math.max(0, Math.min(y, box.bottom - host.top - card.offsetHeight));
  card.style.left = `${x}px`;
  card.style.top = `${y}px`;
}
const hideCard = () => { card.hidden = true; };
function personCard(id, lines, filmIds) {
  const p = people[id];
  const kids = [
    p?.p ? h("img", { src: `${IMG}w92${p.p}`, alt: "", loading: "lazy" }) : h("span"),
    h("b", {}, nameOf(id)),
    h("span", { class: "fr-sub2" }, ...lines.map((l, i) => (i ? [h("br"), l] : l))),
  ];
  if (filmIds?.length) kids.push(h("ul", {}, filmIds.slice(0, 4).map((f) => h("li", {}, `${films[f].t} (${films[f].y ?? "?"})`)), filmIds.length > 4 ? h("li", {}, `and ${filmIds.length - 4} more`) : null));
  return kids;
}
const byYear = (a, b) => (films[a].y ?? 0) - (films[b].y ?? 0) || films[a].t.localeCompare(films[b].t);

// ---- constellation ----------------------------------------------------------------------------------
function constellation() {
  const pid = state.p;
  const collabs = [...collaboratorsOf(pid).values()];
  const selfRole = domRole.get(pid);
  const order = selfRole === "director" ? ROLE_ORDER : ["director", ...ROLE_ORDER.filter((r) => r !== "director")];
  const rings = [[], [], []];
  for (const c of collabs) {
    const n = c.films.size;
    rings[n >= 3 ? 0 : n === 2 ? 1 : 2].push(c);
  }
  const shown = rings.slice(0, state.ring);
  const radii = state.ring === 1 ? [210] : state.ring === 2 ? [140, 275] : [105, 205, 320];
  const CAP = 220;
  const W = 800, C = W / 2;
  const root = svg("svg", { viewBox: `0 0 ${W} ${W}`, role: "group", "aria-label": `${nameOf(pid)} and collaborators by number of shared films`, class: "fr-fade" });
  const labels = ["3 or more films", "2 films", "1 film"];
  let hidden = 0;

  shown.forEach((ring, ri) => {
    const r = radii[ri];
    svg("circle", { cx: C, cy: C, r, class: "fr-guide" }, root);
    const t = svg("text", { x: C, y: C - r - 4, "text-anchor": "middle", class: "fr-small fr-muted", style: "paint-order:stroke;stroke:var(--color-bg);stroke-width:3px" }, root);
    t.textContent = labels[ri];
    ring.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || b.films.size - a.films.size || nameOf(a.id).localeCompare(nameOf(b.id)));
    let list = ring;
    if (ring.length > CAP) {
      const keep = new Set([...ring].sort((a, b) => (filmCount.get(b.id) ?? 0) - (filmCount.get(a.id) ?? 0)).slice(0, CAP));
      list = ring.filter((c) => keep.has(c));
      hidden += ring.length - CAP;
    }
    const labelAll = list.length <= 36;
    list.forEach((c, i) => {
      const ang = -Math.PI / 2 + ((i + 0.5) / list.length) * Math.PI * 2;
      c.x = C + r * Math.cos(ang); c.y = C + r * Math.sin(ang); c.ang = ang; c.ring = ri;
      c.show = true;
    });
    ring.labelAll = labelAll;
    ring.list = list;
  });

  // edges first so nodes sit on top
  for (const ring of shown) for (const c of ring.list) {
    svg("line", { x1: C, y1: C, x2: c.x, y2: c.y, stroke: ROLE_COLOR[c.role], "stroke-opacity": 0.35, "stroke-width": Math.min(5, 0.4 + c.films.size * 0.55) }, root);
  }
  for (const ring of shown) {
    const labelled = new Set(ring.labelAll ? ring.list : [...ring.list].sort((a, b) => b.films.size - a.films.size || (filmCount.get(b.id) ?? 0) - (filmCount.get(a.id) ?? 0)).slice(0, ring.list[0]?.ring === 0 ? 40 : 18));
    for (const c of ring.list) {
      const clickable = isNode(c.id);
      const g = svg("g", { class: `fr-node${clickable ? " is-click" : ""}`, tabindex: 0, role: clickable ? "button" : "img", "aria-label": `${nameOf(c.id)}, ${ROLE_LABEL[c.role]}, ${c.films.size} films together` }, root);
      const rad = Math.min(11, 3.2 + Math.sqrt(filmCount.get(c.id) ?? 1) * 0.9);
      svg("circle", { cx: c.x, cy: c.y, r: rad, fill: ROLE_COLOR[c.role], stroke: "var(--color-bg)", "stroke-width": 1.2 }, g);
      if (labelled.has(c)) {
        const right = Math.cos(c.ang) >= 0;
        const lx = c.x + Math.cos(c.ang) * (rad + 4);
        const ly = c.y + Math.sin(c.ang) * (rad + 4);
        const t = svg("text", { x: lx, y: ly + 3, "text-anchor": right ? "start" : "end", class: "fr-small" }, g);
        t.textContent = nameOf(c.id);
      }
      const show = () => {
        const [y0, y1] = yearRange(c.films);
        showCard(g, personCard(c.id, [
          ROLE_LABEL[c.role],
          `${c.films.size} ${c.films.size === 1 ? "film" : "films"} together${y0 ? `, ${y0 === y1 ? y0 : `${y0} to ${y1}`}` : ""}`,
          clickable ? "Click to center" : "Not expanded in this dataset",
        ], [...c.films].sort(byYear)));
      };
      g.addEventListener("mouseenter", show);
      g.addEventListener("focus", show);
      g.addEventListener("mouseleave", hideCard);
      g.addEventListener("blur", hideCard);
      if (clickable) {
        g.addEventListener("click", () => go({ p: c.id }));
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go({ p: c.id }); } });
      }
    }
  }
  // center
  const cg = svg("g", {}, root);
  svg("circle", { cx: C, cy: C, r: 17, fill: "var(--color-ink)" }, cg);
  const ct = svg("text", { x: C, y: C + 33, "text-anchor": "middle", style: "font-size:13px;font-weight:600" }, cg);
  ct.textContent = nameOf(pid);

  stage.replaceChildren(root);
  const total = collabs.length;
  const extra = rings.slice(state.ring).reduce((n, r) => n + r.length, 0);
  status.textContent = `${nameOf(pid)}: ${total} collaborators in the dataset${extra ? `, ${extra} more with fewer shared films not shown` : ""}${hidden ? `, ${hidden} least-credited hidden to keep the ring legible` : ""}.`;
  const used = [...new Set(collabs.map((c) => c.role))].sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
  legend.replaceChildren(...used.map((r) => h("span", {}, h("i", { style: `background:${ROLE_COLOR[r]}` }), ROLE_LABEL[r])), h("span", {}, "Dot size: films in the dataset. Line weight: films together."));
  detail.replaceChildren();
}

// ---- career river -------------------------------------------------------------------------------------
function river() {
  const pid = state.p;
  const ownRole = domRole.get(pid);
  const own = Object.entries(films).filter(([, f]) => f.cr.some(([p, r]) => p === pid && r === ownRole)).map(([id]) => Number(id)).sort(byYear);
  const idx = new Map(own.map((f, i) => [f, i]));
  const ownSet = new Set(own);
  const [y0, y1] = yearRange(own);
  if (y0 == null) { stage.replaceChildren(h("p", {}, "No dated films for this person.")); return; }

  const cs = [...collaboratorsOf(pid).values()];
  const lanes = [];
  const aboveOrder = ownRole === "director" ? ["cinematographer", "editor", "composer", "writer", "producer"] : ["director", ...ROLE_ORDER.filter((r) => r !== "director" && r !== "actor" && r !== ownRole)];
  const caps = { director: 12, cinematographer: 8, editor: 6, composer: 6, writer: 6, producer: 5, actor: 14 };
  for (const role of [...aboveOrder, "actor"]) {
    const list = cs
      .map((c) => ({ ...c, shared: new Set([...(c.roles[role] ?? [])].filter((f) => ownSet.has(f))) }))
      .filter((c) => c.shared.size >= 2)
      .sort((a, b) => b.shared.size - a.shared.size || nameOf(a.id).localeCompare(nameOf(b.id)))
      .slice(0, caps[role]);
    if (list.length) lanes.push({ role, list });
  }

  const W = 960, L = 170, R = 20, PW = W - L - R, ROW = 16;
  const x = (y) => L + ((y - (y0 - 1)) / (y1 - y0 + 2)) * PW;
  // film x positions, nudging films of the same year apart
  const sameYear = {};
  const fx = new Map();
  for (const f of own) { const y = films[f].y; const k = (sameYear[y] = (sameYear[y] ?? -1) + 1); fx.set(f, x(y + k * 0.2)); }

  const above = lanes.filter((l) => l.role !== "actor");
  const below = lanes.find((l) => l.role === "actor");
  let y = 14;
  const root = svg("svg", { viewBox: "0 0 960 10", role: "group", "aria-label": `Career timeline for ${nameOf(pid)}`, class: "fr-fade" });
  root.style.minWidth = "720px";
  const bands = [];

  function lane(l) {
    const t = svg("text", { x: 0, y: y + 3, class: "fr-small fr-muted", style: "letter-spacing:0.06em;text-transform:uppercase" }, root);
    t.textContent = l.role === "actor" ? "Recurring actors" : ROLE_LABEL[l.role] + "s";
    y += 10;
    for (const c of l.list) {
      const lab = svg("text", { x: L - 8, y: y + 10, "text-anchor": "end", class: "fr-small", style: isNode(c.id) ? "cursor:pointer" : "" }, root);
      lab.textContent = `${nameOf(c.id)} (${c.shared.size})`;
      if (isNode(c.id)) lab.addEventListener("click", () => go({ p: c.id }));
      const ids = [...c.shared].sort((a, b) => idx.get(a) - idx.get(b));
      const runs = [];
      for (const f of ids) {
        const last = runs[runs.length - 1];
        if (last && idx.get(f) === idx.get(last[last.length - 1]) + 1) last.push(f); else runs.push([f]);
      }
      const g = svg("g", { "data-films": ids.join(",") }, root);
      runs.forEach((run, i) => {
        const xa = fx.get(run[0]) - 3, xb = Math.max(fx.get(run[run.length - 1]) + 3, xa + 7);
        const r = svg("rect", { x: xa, y: y + 3, width: xb - xa, height: 9, fill: ROLE_COLOR[l.role] }, g);
        const ys = run.map((f) => films[f].y);
        svg("title", {}, r).textContent = `${nameOf(c.id)}: ${run.length} ${run.length === 1 ? "film" : "films"}, ${Math.min(...ys)}${Math.max(...ys) !== Math.min(...ys) ? ` to ${Math.max(...ys)}` : ""}`;
        if (run.length >= 3 && xb - xa > 26) { const n = svg("text", { x: xa + 4, y: y + 10.5, class: "fr-small", style: "fill:#fff", "pointer-events": "none" }, g); n.textContent = `×${run.length}`; }
        if (i > 0) {
          const prevEnd = fx.get(runs[i - 1][runs[i - 1].length - 1]) + 3;
          svg("line", { x1: prevEnd, y1: y + 7.5, x2: xa, y2: y + 7.5, stroke: ROLE_COLOR[l.role], "stroke-dasharray": "2 3", "stroke-opacity": 0.6 }, g);
          const gy0 = films[runs[i - 1][runs[i - 1].length - 1]].y, gy1 = films[run[0]].y;
          if (gy1 - gy0 >= 6 && xa - prevEnd > 40) { const gt = svg("text", { x: (prevEnd + xa) / 2, y: y + 5, "text-anchor": "middle", class: "fr-small fr-muted" }, g); gt.textContent = `${gy0 + 1} to ${gy1 - 1}`; }
        }
      });
      bands.push(g);
      y += ROW;
    }
    y += 6;
  }
  above.forEach(lane);

  // axis, film ticks and owner marks
  const axisY = y + 6;
  svg("line", { x1: L, y1: axisY, x2: W - R, y2: axisY, stroke: "var(--color-ink)" }, root);
  const step = y1 - y0 > 40 ? 10 : 5;
  for (let yr = Math.ceil(y0 / step) * step; yr <= y1; yr += step) {
    svg("line", { x1: x(yr), y1: axisY, x2: x(yr), y2: axisY + 4, stroke: "var(--color-ink-soft)" }, root);
    const t = svg("text", { x: x(yr), y: axisY + 15, "text-anchor": "middle", class: "fr-small fr-muted" }, root);
    t.textContent = yr;
  }
  const companyCounts = {};
  for (const f of own) { const c = films[f].co[0]; if (c) companyCounts[c] = (companyCounts[c] ?? 0) + 1; }
  const topCos = Object.entries(companyCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n);
  const coColor = ["#2e5e7e", "#a1442a", "#5d7a3a", "#9a7420", "#6a4a82", "#3f7f78"];
  const stripY = axisY + 22;
  for (const f of own) {
    const fi = films[f], px = fx.get(f);
    const g = svg("g", { class: "fr-node", tabindex: 0, role: "img", "aria-label": `${fi.t}, ${fi.y}` }, root);
    svg("rect", { x: px - 6, y: axisY - 8, width: 12, height: 40, fill: "transparent" }, g);
    svg("line", { x1: px, y1: axisY - 6, x2: px, y2: axisY + 6, stroke: "var(--color-ink)", "stroke-width": 1.5 }, g);
    const ci = topCos.indexOf(fi.co[0]);
    svg("rect", { x: px - 3.5, y: stripY, width: 7, height: 7, fill: ci >= 0 ? coColor[ci] : "#cfcbc0" }, g);
    if (ownerOn && owner[f]) {
      const o = owner[f];
      if (o.e) svg("circle", { cx: px, cy: axisY, r: 7, fill: "none", stroke: "var(--color-accent)", "stroke-width": 1.5 }, g);
      if (o.r != null) { const s = svg("text", { x: px, y: stripY + 20, "text-anchor": "middle", class: "fr-small", style: "fill:var(--color-accent)" }, g); s.textContent = `★${o.r}`; }
      if (o.k) svg("rect", { x: px - 3, y: stripY + 24, width: 6, height: 6, fill: "none", stroke: "var(--color-ink)" }, g);
    }
    const show = () => {
      for (const b of bands) b.classList.toggle("fr-dim", !b.dataset.films.split(",").includes(String(f)));
      const kids = [
        fi.po ? h("img", { src: `${IMG}w92${fi.po}`, alt: "" }) : h("span"),
        h("b", {}, `${fi.t} (${fi.y ?? "?"})`),
        h("span", { class: "fr-sub2" }, fi.co.slice(0, 2).join(", ") || "Studio unknown", ownerText(f) ? [h("br"), ownerText(f)] : null, ownerText(f) && owner[f]?.e ? [h("br"), owner[f].e.note] : null),
      ];
      showCard(g, kids);
    };
    const hide = () => { for (const b of bands) b.classList.remove("fr-dim"); hideCard(); };
    g.addEventListener("mouseenter", show); g.addEventListener("focus", show);
    g.addEventListener("mouseleave", hide); g.addEventListener("blur", hide);
  }
  const sl = svg("text", { x: L - 8, y: stripY + 7, "text-anchor": "end", class: "fr-small fr-muted" }, root);
  sl.textContent = "First studio listed";
  y = stripY + (ownerOn ? 40 : 16);

  if (below) lane(below);

  root.setAttribute("viewBox", `0 0 ${W} ${y + 10}`);
  stage.replaceChildren(root);
  status.textContent = `${nameOf(pid)} as ${ROLE_LABEL[ownRole].toLowerCase()}: ${own.length} films, ${y0} to ${y1}. Bands show collaborators with two or more shared films; a dashed line is a break in the partnership.`;
  legend.replaceChildren(
    ...[...new Set(lanes.map((l) => l.role))].map((r) => h("span", {}, h("i", { style: `background:${ROLE_COLOR[r]}` }), ROLE_LABEL[r])),
    ...topCos.map((n, i) => h("span", {}, h("i", { style: `background:${coColor[i]}` }), n)),
  );
  detail.replaceChildren();
}

// ---- heatmap ------------------------------------------------------------------------------------------------
const heat = { rows: { director: null, cinematographer: null } };
function nodesWithRole(role) {
  return Object.keys(people).map(Number).filter((id) => isNode(id) && domRole.get(id) === role).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
}
function seedsWithRole(role) {
  return nodesWithRole(role).filter((id) => people[id].s?.includes(role));
}
function heatmap() {
  const tab = state.hm;
  const rowRole = tab === "dps" ? "cinematographer" : "director";
  const colRoles = tab === "actors" ? ["actor"] : tab === "crew" ? ["cinematographer", "editor", "composer"] : tab === "writers" ? ["writer"] : ["director"];
  const candidates = nodesWithRole(rowRole);
  heat.rows[rowRole] ??= new Set(seedsWithRole(rowRole));
  const rows = candidates.filter((id) => heat.rows[rowRole].has(id));

  const cell = new Map(); // col -> Map(row -> Set films)
  for (const r of rows) {
    for (const [a, ar, b, br, fs] of adj.get(r) ?? []) {
      const [other, oRole, mine] = a === r ? [b, br, ar] : [a, ar, br];
      if (mine !== rowRole || !colRoles.includes(oRole) || other === r) continue;
      if (!cell.has(other)) cell.set(other, new Map());
      const m = cell.get(other);
      if (!m.has(r)) m.set(r, new Set());
      for (const f of fs) m.get(r).add(f);
    }
  }
  const total = (m) => [...m.values()].reduce((n, s) => n + s.size, 0);
  const cols = [...cell].filter(([, m]) => total(m) >= 2).sort((a, b) => total(b[1]) - total(a[1]) || nameOf(a[0]).localeCompare(nameOf(b[0]))).slice(0, 30);
  const max = Math.max(1, ...cols.flatMap(([, m]) => [...m.values()].map((s) => s.size)));

  const sub = h("div", { class: "fr-sub", role: "tablist", "aria-label": "Column type" },
    ...[["actors", "Actors"], ["crew", "Crew"], ["writers", "Writers"], ["dps", "DPs by director"]].map(([k, label]) =>
      h("button", { role: "tab", "aria-selected": String(k === tab), onclick: () => go({ hm: k }) }, label)));

  const picker = h("details", { class: "fr-rows" },
    h("summary", {}, `Rows shown: ${rows.length} of ${candidates.length} ${rowRole === "director" ? "directors" : "cinematographers"} (up to ${MAX_HEAT_ROWS})`),
    h("div", {}, candidates.map((id) => h("label", {}, h("input", {
      type: "checkbox", checked: heat.rows[rowRole].has(id),
      disabled: !heat.rows[rowRole].has(id) && heat.rows[rowRole].size >= MAX_HEAT_ROWS,
      onchange: (e) => { e.target.checked ? heat.rows[rowRole].add(id) : heat.rows[rowRole].delete(id); heatmap(); const d = document.querySelector(".fr-rows"); if (d) d.open = true; },
    }), " ", nameOf(id)))));

  const thead = h("tr", {}, h("th"), ...cols.map(([cid]) => h("th", {}, h("button", {
    class: "fr-link", title: `${nameOf(cid)}, ${ROLE_LABEL[domRole.get(cid)] ?? ""}`,
    onclick: () => { if (isNode(cid)) go({ v: tab === "dps" ? "r" : "c", p: cid }); },
  }, nameOf(cid)))));
  const body = rows.map((r) => h("tr", {}, h("th", {}, h("button", { class: "fr-link", onclick: () => go({ v: "c", p: r }) }, nameOf(r))),
    ...cols.map(([cid, m]) => {
      const s = m.get(r);
      if (!s) return h("td");
      const a = 0.18 + 0.82 * (s.size / max);
      return h("td", {}, h("button", {
        class: s.size / max > 0.45 ? "on" : "", style: `background:rgba(161,68,42,${a.toFixed(2)})`,
        "aria-label": `${nameOf(r)} and ${nameOf(cid)}: ${s.size} films`,
        onclick: () => showShared(r, cid, s),
      }, String(s.size)));
    })));
  const wrap = h("div", { class: "fr-hm" }, h("table", {}, h("thead", {}, thead), h("tbody", {}, body)));
  stage.replaceChildren(sub, picker, rows.length ? wrap : h("p", { class: "meta" }, "No rows selected."));
  stage.classList.add("fr-fade");
  status.textContent = `${rows.length} ${rowRole === "director" ? "directors" : "cinematographers"} by the ${cols.length} people they share the most films with. Click a cell to see the films.`;
  legend.replaceChildren(h("span", {}, "Shade: films together. Click a row name to open its constellation; click a column name to open the constellation, or the career river when the column is a director."));
  detail.replaceChildren();
}
function showShared(r, c, set) {
  const ids = [...set].sort(byYear);
  detail.replaceChildren(
    h("h2", {}, `${nameOf(r)} and ${nameOf(c)}: ${ids.length} films`),
    h("ul", {}, ids.map((f) => {
      const fi = films[f], ot = ownerText(f);
      return h("li", {}, fi.po ? h("img", { src: `${IMG}w92${fi.po}`, alt: "", loading: "lazy" }) : h("span"),
        h("div", {}, h("b", {}, fi.t), h("br"), h("span", { class: "fr-sub2" }, `${fi.y ?? "?"}`, ot ? [h("br"), ot] : null),
          ownerOn && owner[f]?.e ? [h("br"), h("a", { href: owner[f].e.url }, "Read my note")] : null));
    })),
  );
  detail.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
}

// ---- wiring --------------------------------------------------------------------------------------------------
function render() {
  hideCard();
  document.querySelectorAll(".fr-tabs [data-view]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === state.v)));
  $("fr-pick").style.display = state.v === "h" ? "none" : "";
  $("fr-ringWrap").style.display = state.v === "c" ? "" : "none";
  $("fr-ring").value = String(state.ring);
  const role = domRole.get(state.p);
  if (state.v !== "h") {
    $("fr-roleSel").value = role in DEFAULTS ? role : "director";
    $("fr-person").value = nameOf(state.p);
  }
  if (state.v === "c") constellation(); else if (state.v === "r") river(); else heatmap();
  document.title = `${state.v === "h" ? "Film Repertory" : nameOf(state.p)} · Film Repertory · Matthew R. Kenney`;
}
// Typeahead: empty box lists everyone in the chosen role; typing searches every full node.
function setupSearch() {
  const inp = $("fr-person"), box = $("fr-sugg");
  let items = [], active = -1;
  const close = () => { box.hidden = true; inp.setAttribute("aria-expanded", "false"); active = -1; };
  const choose = (id) => { close(); inp.blur(); go({ p: id }); };
  function paint() {
    box.replaceChildren(...items.map((id, i) => {
      const li = h("li", { role: "option", "aria-selected": String(i === active) }, h("span", {}, nameOf(id)), h("small", {}, ROLE_LABEL[domRole.get(id)] ?? ""));
      li.addEventListener("mousedown", (e) => { e.preventDefault(); choose(id); });
      return li;
    }));
    box.hidden = !items.length;
    inp.setAttribute("aria-expanded", String(!box.hidden));
    box.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }
  function update(browse) {
    const q = inp.value.trim().toLowerCase();
    if (browse || !q) items = nodesWithRole($("fr-roleSel").value);
    else {
      const all = Object.keys(people).map(Number).filter((id) => isNode(id) && nameOf(id).toLowerCase().includes(q));
      all.sort((x, y) => (nameOf(y).toLowerCase().startsWith(q) - nameOf(x).toLowerCase().startsWith(q)) || nameOf(x).localeCompare(nameOf(y)));
      items = all.slice(0, 40);
    }
    active = -1;
    paint();
  }
  inp.addEventListener("focus", () => inp.select());
  inp.addEventListener("input", () => update(false));
  inp.addEventListener("blur", () => { close(); inp.value = nameOf(state.p); });
  inp.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (box.hidden) update(true);
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      paint();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items.length) choose(items[Math.max(active, 0)]);
    } else if (e.key === "Escape") { close(); inp.blur(); }
  });
}

function bind() {
  document.querySelectorAll(".fr-tabs [data-view]").forEach((b) => b.addEventListener("click", () => go({ v: b.dataset.view })));
  $("fr-ring").addEventListener("change", (e) => go({ ring: Number(e.target.value) }));
  $("fr-roleSel").addEventListener("change", (e) => {
    const pick = DEFAULTS[e.target.value] ?? nodesWithRole(e.target.value)[0];
    if (pick) go({ p: pick });
  });
  setupSearch();
  const own = $("fr-owner");
  own.checked = ownerOn = lsGet("fr-owner") === "1";
  own.addEventListener("change", () => { ownerOn = own.checked; lsSet("fr-owner", ownerOn ? "1" : "0"); render(); });
  addEventListener("popstate", () => { readUrl(); render(); });
}

async function main() {
  try {
    const get = (n) => fetch(`/film-repertory/${n}.json`).then((r) => { if (!r.ok) throw new Error(n); return r.json(); });
    [people, films, collab, owner] = await Promise.all(["people", "films", "collaborations", "owner"].map(get));
  } catch (e) {
    status.textContent = "The credits data did not load. Try reloading the page.";
    return;
  }
  index();
  readUrl();
  bind();
  writeUrl(false);
  render();
}
main();
