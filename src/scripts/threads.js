// The "threads" layout (Out of Bell Labs, The Long Manifesto). Each idea is a row; one year
// cursor moves every row, and the reader picks which row to follow. Ported from Matthew's
// prototypes. The SVG is sized from the container's real width so text stays readable on a phone.
// An idea's optional `view` sets its years; its `series` sets the chart (Bell Labs defaults).

const IDEA = JSON.parse(document.getElementById("bl-data").textContent);
const NS = "http://www.w3.org/2000/svg";
const V = IDEA.view ?? {};
const Y0 = V.from ?? 1921, Y1 = V.to ?? 2031, PADL = 16, PADR = 16;
const TICK0 = V.tickFrom ?? 1930, TICK1 = V.tickTo ?? 2020;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const el = (tag, attrs, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
const color = (t) => `var(--t-${t})`;
const laneLabel = (id) => (IDEA.lanes.find((l) => l.id === id) || {}).label || id;
const byId = Object.fromEntries(IDEA.stations.map((s) => [s.id, s]));
const T = IDEA.threads.map((t) => ({
  ...t,
  stations: IDEA.stations.filter((s) => s.thread === t.id).sort((a, b) => a.year - b.year),
}));
const src = (n) => IDEA.sources.find((s) => s.n === n);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const srcLinks = (ns) => ns.map((n) => {
  const s = src(n);
  return s ? `<a href="#bl-src-${n}" title="${esc(s.title)}">${n}</a>` : n;
}).join(", ");

let sel = 0, year = V.start ?? 1936, W = 900;
const X = (y) => PADL + ((y - Y0) / (Y1 - Y0)) * (W - PADL - PADR);

// ---- chips --------------------------------------------------------------------------------
const chips = document.getElementById("bl-chips");
T.forEach((t, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "bl-chip";
  b.innerHTML = `<i style="background:${color(t.color)}"></i>${esc(t.label)}`;
  b.onclick = () => select(i, true);
  chips.appendChild(b);
});

// ---- map ----------------------------------------------------------------------------------
const map = document.getElementById("bl-map");
const TOP = 8, ROW = 80, LINE = 40;
let M = {};
function buildMap() {
  map.textContent = "";
  W = Math.max(320, Math.round(map.parentElement.clientWidth - 24));
  const H = TOP + T.length * ROW + 26;
  map.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const step = W < 520 ? 20 : 10;
  for (let y = TICK0; y <= TICK1; y += step) {
    el("line", { x1: X(y), x2: X(y), y1: TOP, y2: H - 24, stroke: "var(--color-border)", "stroke-width": 1, "stroke-dasharray": "2 6" }, map);
    el("text", { x: X(y), y: H - 8, class: "axis", "text-anchor": "middle" }, map).textContent = y;
  }
  M = { rows: [], edges: [] };
  T.forEach((t, i) => {
    const y0 = TOP + i * ROW, ly = y0 + LINE;
    const first = t.stations[0], last = t.stations[t.stations.length - 1];
    const lab = el("text", { x: PADL, y: y0 + 10, class: "row-label", fill: color(t.color) }, map);
    lab.textContent = t.label;
    el("line", { x1: X(first.year), x2: X(last.year), y1: ly, y2: ly, stroke: "var(--color-border)", "stroke-width": 2 }, map);
    const prog = el("line", { x1: X(first.year), x2: X(first.year), y1: ly, y2: ly, stroke: color(t.color), "stroke-width": 2.5, "stroke-linecap": "round" }, map);
    const nodes = t.stations.map((s) => {
      s._x = X(s.year);
      s._y = ly;
      const g = el("g", {}, map);
      el("circle", { cx: s._x, cy: ly, r: 7, fill: "#fff", stroke: color(t.color), "stroke-width": 2.5 }, g);
      const dot = el("circle", { cx: s._x, cy: ly, r: 3.5, fill: color(t.color) }, g);
      return { s, dot };
    });
    M.rows.push({ t, prog, nodes, ly, y0 });
  });
  IDEA.edges.filter((e) => byId[e.from].thread !== byId[e.to].thread).forEach((e) => {
    const A = byId[e.from], B = byId[e.to], my = (A._y + B._y) / 2;
    const p = el("path", { d: `M${A._x},${A._y} C${A._x},${my} ${B._x},${my} ${B._x},${B._y}`, class: "edge" }, map);
    M.edges.push({ p, year: B.year });
  });
  M.tokens = M.rows.map((r) => el("circle", { r: 5, fill: color(r.t.color), stroke: "#fff", "stroke-width": 2 }, map));
  M.halo = el("circle", { r: 18, fill: "var(--accent-soft)" }, map);
  M.tok = el("circle", { r: 8, fill: "var(--accent)", stroke: "#fff", "stroke-width": 3 }, map);
  M.trail = el("line", { stroke: "var(--accent)", "stroke-width": 4, "stroke-linecap": "round", opacity: 0.45 }, map);
  map.insertBefore(M.trail, M.tokens[0]);
  M.label = el("text", { class: "node-name", "text-anchor": "middle", "font-weight": 600 }, map);
}

// ---- chart: the outcome series on the same x scale ---------------------------------------
const chart = document.getElementById("bl-chartsvg");
const SER = IDEA.series;
const P = SER.points;
// Count data (a whole number per year) is drawn as flat steps rather than a sloped line.
const STEP = SER.step ?? false;
const GRID = SER.grid ?? 5000;
const axisLabel = SER.axis ? (v) => `${v}` : (v) => `$${v / 1000}T`;
const VMAX = Math.ceil(Math.max(...P.map((p) => p.value)) / GRID) * GRID;
const CT = 14, CB = 196;
const CY = (v) => CB - (v / VMAX) * (CB - CT);
let C = {};
function buildChart() {
  chart.textContent = "";
  const H = 222;
  chart.setAttribute("viewBox", `0 0 ${W} ${H}`);
  for (let v = 0; v <= VMAX; v += GRID) {
    el("line", { x1: PADL, x2: W - PADR, y1: CY(v), y2: CY(v), stroke: "var(--color-border)", "stroke-width": 1 }, chart);
    if (v) el("text", { x: PADL, y: CY(v) - 4, class: "axis" }, chart).textContent = axisLabel(v);
  }
  const step = W < 520 ? 20 : 10;
  for (let y = TICK0; y <= TICK1; y += step) el("text", { x: X(y), y: H - 6, class: "axis", "text-anchor": "middle" }, chart).textContent = y;
  const pts = STEP
    ? P.flatMap((p, i) => [...(i ? [`${X(p.year).toFixed(1)},${CY(P[i - 1].value).toFixed(1)}`] : []), `${X(p.year).toFixed(1)},${CY(p.value).toFixed(1)}`])
    : P.map((p) => `${X(p.year).toFixed(1)},${CY(p.value).toFixed(1)}`);
  el("path", { d: `M${X(P[0].year)},${CB} L${pts.join(" L")} L${X(P[P.length - 1].year)},${CB} Z`, fill: "var(--color-ink)", opacity: 0.07 }, chart);
  el("path", { d: `M${pts.join(" L")}`, fill: "none", stroke: "var(--color-ink)", "stroke-width": 2, "stroke-linejoin": "round" }, chart);
  C.marks = el("g", {}, chart);
  C.cursor = el("line", { y1: CT - 6, y2: CB, stroke: "var(--accent)", "stroke-width": 2 }, chart);
  C.dot = el("circle", { r: 6, fill: "var(--accent)", stroke: "#fff", "stroke-width": 2 }, chart);
}
const last = P[P.length - 1];
const valAt = (y) => {
  if (y < P[0].year) return null;
  if (y >= last.year) return last.value;
  if (STEP) return P.filter((p) => p.year <= y + 0.01).pop().value;
  for (let i = 1; i < P.length; i++) if (y <= P[i].year) {
    const a = P[i - 1], b = P[i];
    return a.value + ((b.value - a.value) * (y - a.year)) / (b.year - a.year);
  }
};

// ---- render ------------------------------------------------------------------------------
let current = null;
const readout = document.getElementById("bl-readout");
function render() {
  const t = T[sel];
  M.rows.forEach((r, i) => {
    const f = r.t.stations[0], l = r.t.stations[r.t.stations.length - 1];
    const tx = X(Math.min(Math.max(year, f.year), l.year));
    r.prog.setAttribute("x2", year >= f.year ? tx : X(f.year));
    r.nodes.forEach(({ s, dot }) => dot.setAttribute("opacity", s.year <= year + 0.01 ? 1 : 0.25));
    const tk = M.tokens[i];
    tk.setAttribute("cx", tx);
    tk.setAttribute("cy", r.ly);
    tk.style.display = i !== sel && year >= f.year ? "" : "none";
    if (i === sel) {
      [M.halo, M.tok].forEach((c) => { c.setAttribute("cx", tx); c.setAttribute("cy", r.ly); c.style.opacity = year >= f.year ? 1 : 0.35; });
      M.trail.setAttribute("x1", X(f.year));
      M.trail.setAttribute("x2", year >= f.year ? tx : X(f.year));
      M.trail.setAttribute("y1", r.ly);
      M.trail.setAttribute("y2", r.ly);
    }
  });
  M.edges.forEach(({ p, year: y }) => p.classList.toggle("on", y <= year + 0.01));

  // Only the followed thread's current station gets a name on the map; more would collide.
  const rr = M.rows[sel];
  const lbl = t.stations.filter((s) => s.year <= year + 0.01).pop() || t.stations[0];
  M.label.textContent = `${lbl.year} ${lbl.short}`;
  const half = (M.label.getComputedTextLength ? M.label.getComputedTextLength() : 80) / 2 + 4;
  M.label.setAttribute("x", Math.max(PADL + half, Math.min(W - PADR - half, lbl._x)));
  M.label.setAttribute("y", rr.ly - 15);

  const reached = t.stations.filter((s) => s.year <= year + 0.01);
  const active = reached.pop() || t.stations[0];
  const key = active.id + (active.year <= year + 0.01 ? "" : "-wait");
  if (key !== current) { current = key; drawCard(active, active.year > year + 0.01); }
  map.setAttribute("aria-valuenow", Math.round(year));
  map.setAttribute("aria-valuetext", `${Math.round(year)}, ${t.label}: ${active.title}`);

  C.marks.textContent = "";
  t.stations.forEach((s) => el("circle", { cx: X(s.year), cy: CB, r: 4, fill: color(t.color), stroke: "#fff", "stroke-width": 1.5 }, C.marks));
  C.cursor.setAttribute("x1", X(year));
  C.cursor.setAttribute("x2", X(year));
  const v = valAt(year);
  if (v == null) {
    C.dot.style.display = "none";
    readout.innerHTML = `<b>&ndash;</b> ${Math.round(year)}: before the ${esc(SER.from ?? "BEA series")} begins in ${P[0].year}`;
  } else {
    C.dot.style.display = "";
    C.dot.setAttribute("cx", X(Math.min(year, last.year)));
    C.dot.setAttribute("cy", CY(v));
    const y = Math.min(Math.round(year), last.year), m = (v / P[0].value).toFixed(1);
    if (SER.readout) { readout.innerHTML = SER.readout.replace("{v}", `<b>${v}</b>`).replace("{noun}", v === 1 ? SER.one : SER.many).replace("{year}", y); return; }
    readout.innerHTML = `<b>$${(v / 1000).toFixed(1)} trillion</b> ${esc(IDEA.series.label)} in 2017 dollars, ${y}${year > last.year + 0.5 ? " (latest year)" : ""}. ${m} times ${P[0].year}.`;
  }
}

function drawCard(s, wait) {
  const t = IDEA.threads.find((x) => x.id === s.thread);
  document.getElementById("bl-card").innerHTML = `
    <div><div class="big-year">${s.year}</div><h3>${esc(s.title)}</h3>
      <p class="who">${esc(s.who)}</p><p class="where">${esc(s.where)}</p>
      <div class="tags"><span class="tag thread" style="background:${color(t.color)}">${esc(t.label)}</span><span class="tag">${esc(laneLabel(s.lane))}</span></div>
      ${wait ? `<p class="waiting">This idea has not started yet. Its first station is ${s.year}.</p>` : ""}</div>
    <dl><div><dt>What they made</dt><dd>${esc(s.what)}</dd></div>
      <div><dt>What it promised</dt><dd>${esc(s.pitch)}</dd></div>
      <div><dt>How it spread</dt><dd>${esc(s.spread)}</dd></div>
      <div><dt>Sources</dt><dd>${srcLinks(s.sources)}</dd></div></dl>`;
}

const chipEls = () => [...chips.children];
function select(i, jump) {
  sel = i;
  current = null;
  chipEls().forEach((b, k) => b.setAttribute("aria-pressed", k === i ? "true" : "false"));
  if (jump) {
    const st = T[i].stations, r = st.filter((s) => s.year <= year + 0.01).pop();
    animateTo((r || st[0]).year);
  } else render();
}

// ---- motion and input ------------------------------------------------------------------------
let anim = 0;
function animateTo(target) {
  cancelAnimationFrame(anim);
  if (reduceMotion) { year = target; render(); return; }
  const start = year, t0 = performance.now(), dur = Math.min(900, 200 + Math.abs(target - start) * 20);
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    year = start + (target - start) * e;
    render();
    if (k < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}
const stations = () => T[sel].stations;
const nearest = (y) => stations().reduce((a, b) => (Math.abs(b.year - y) < Math.abs(a.year - y) ? b : a));
const idx = () => stations().indexOf(nearest(year));
function pt(e) {
  const p = map.createSVGPoint();
  p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(map.getScreenCTM().inverse());
}
const minYear = Math.min(...IDEA.stations.map((s) => s.year));
const maxYear = Math.max(...IDEA.stations.map((s) => s.year));
const yearAt = (x) => Math.max(minYear, Math.min(maxYear, Y0 + ((x - PADL) / (W - PADL - PADR)) * (Y1 - Y0)));
let dragging = false;
map.addEventListener("pointerdown", (e) => {
  const p = pt(e), row = Math.floor((p.y - TOP) / ROW);
  if (row >= 0 && row < T.length && row !== sel) select(row, false);
  dragging = true;
  map.classList.add("drag");
  try { map.setPointerCapture(e.pointerId); } catch { /* drag still works without capture */ }
  cancelAnimationFrame(anim);
  year = yearAt(p.x);
  render();
});
map.addEventListener("pointermove", (e) => { if (dragging) { year = yearAt(pt(e).x); render(); } });
const end = () => {
  if (!dragging) return;
  dragging = false;
  map.classList.remove("drag");
  animateTo(nearest(year).year);
};
map.addEventListener("pointerup", end);
map.addEventListener("pointercancel", end);
const next = () => { const st = stations(), i = idx(); animateTo(st[Math.min(st.length - 1, st[i].year <= year + 0.01 ? i + 1 : i)].year); };
const prev = () => { const st = stations(), i = idx(); animateTo(st[Math.max(0, st[i].year >= year - 0.01 ? i - 1 : i)].year); };
document.getElementById("bl-next").onclick = next;
document.getElementById("bl-prev").onclick = prev;
map.addEventListener("keydown", (e) => {
  const go = {
    ArrowRight: next, ArrowLeft: prev,
    ArrowDown: () => select(Math.min(T.length - 1, sel + 1), true),
    ArrowUp: () => select(Math.max(0, sel - 1), true),
  }[e.key];
  if (go) { e.preventDefault(); go(); }
});

function build() { buildMap(); buildChart(); current = null; render(); }
let rt = 0;
new ResizeObserver(() => {
  clearTimeout(rt);
  rt = setTimeout(() => {
    const w = Math.max(320, Math.round(map.parentElement.clientWidth - 24));
    if (w !== W) build();
  }, 120);
}).observe(map.parentElement);
chipEls().forEach((b, k) => b.setAttribute("aria-pressed", k === sel ? "true" : "false"));
build();
