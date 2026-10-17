// Who Sold Us This Idea? The idea map, the year slider and the outcome chart.
// Ported from the how-did-we-get-here prototype. Everything is read from the idea JSON
// embedded in the page, so a new idea needs no changes here.
//
// One number drives everything: `year`. The map token, the slider, the card and the chart
// cursor all follow it. Dragging, sliding, keys and buttons only ever change `year`.

const NS = "http://www.w3.org/2000/svg";
const IDEA = JSON.parse(document.getElementById("isl-data").textContent);
const X0 = 120, X1 = 985;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const S = [...IDEA.stations].sort((a, b) => a.year - b.year);
// An idea can stretch its busy decades with a piecewise time scale: [[year, 0..1], ...].
const TS = IDEA.timeScale ?? null;
const Y0 = TS ? TS[0][0] : Math.floor(S[0].year / 10) * 10 - 4;
const Y1 = TS ? TS[TS.length - 1][0] : S[S.length - 1].year + 7; // room for the last, largest bubble
function frac(y) {
  if (!TS) return (y - Y0) / (Y1 - Y0);
  for (let i = 1; i < TS.length; i++) {
    const [ya, fa] = TS[i - 1], [yb, fb] = TS[i];
    if (y <= yb || i === TS.length - 1) return fa + ((y - ya) / (yb - ya)) * (fb - fa);
  }
}
function unfrac(f) {
  if (!TS) return Y0 + f * (Y1 - Y0);
  for (let i = 1; i < TS.length; i++) {
    const [ya, fa] = TS[i - 1], [yb, fb] = TS[i];
    if (f <= fb || i === TS.length - 1) return ya + ((f - fa) / (fb - fa)) * (yb - ya);
  }
}
const X = (y) => X0 + frac(y) * (X1 - X0);
const laneOf = (id) => IDEA.lanes.find((l) => l.id === id);
const laneColor = (id) => `var(--lane-${id}, var(--color-ink-soft))`;
// yearLabel lets a station stand for a span ("1980s") while still sitting at one point in time.
for (const s of S) { s.x = X(s.year); s.y = laneOf(s.lane).y + (s.yOff || 0); s.label = s.yearLabel ?? String(s.year); }
const byId = Object.fromEntries(S.map((s) => [s.id, s]));
const sourceUrl = (n) => IDEA.sources.find((s) => s.n === n)?.url ?? "#";
const R = IDEA.ratio;
const unit = IDEA.chart?.unit ?? "";
const badge = IDEA.chart?.badge ?? unit;
const prefix = IDEA.chart?.prefix ?? "";
const decimals = IDEA.chart?.decimals ?? 0;
// The series may be annual (cycle 1) or per election (cycle 2 or 4). Any moment reads the
// figure for its own year, or for the next election when the series is per election.
const cycle = IDEA.chart?.cycle ?? 1;
const pointAt = (y) => {
  const yr = Math.round(y);
  const target = cycle > 1 ? Math.ceil(yr / cycle) * cycle : yr;
  return R.find((r) => r.year === target) ?? null;
};
const num = (v) => v.toFixed(decimals);
const fmt = (p) => `${p.approximate ? "~" : ""}${prefix}${num(p.value)}${badge}`;
const VMAX = Math.max(...R.map((r) => r.value));
// A station's bubble grows with the outcome in its year (area tracks the value).
const bubbleR = (p) => (p ? 9 + Math.sqrt(p.value / VMAX) * (IDEA.chart?.bubbleGrow ?? 19) : 10);

const $ = (id) => document.getElementById(id);
const map = $("isl-map"), chart = $("isl-chart"), range = $("isl-range"), now = $("isl-now");
const scroller = $("isl-scroll"), card = $("isl-card"), readout = $("isl-readout");
const meterN = $("isl-meter-n"), meterCap = $("isl-meter-cap"), dotsEl = $("isl-dots");

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const decades = [];
for (let y = Math.ceil(Y0 / 20) * 20 - 10; y <= Y1; y += 20) if (y > Y0) decades.push(y);

// ---- map ----------------------------------------------------------------------------------
for (const l of IDEA.lanes) {
  el("line", { x1: X0 - 6, x2: X1, y1: l.y, y2: l.y, stroke: "var(--color-border)", "stroke-width": 1 }, map);
  el("text", { x: 8, y: l.y + 4, class: "lane-label", fill: laneColor(l.id) }, map).textContent = l.label;
}
for (const y of decades) {
  el("line", { x1: X(y), x2: X(y), y1: 24, y2: 418, stroke: "var(--color-border)", "stroke-width": 1, "stroke-dasharray": "2 6" }, map);
  el("text", { x: X(y), y: 434, class: "node-year", "text-anchor": "middle" }, map).textContent = y;
}
const edgeEls = IDEA.edges.map((e) => {
  const A = byId[e.from], B = byId[e.to], mx = (A.x + B.x) / 2;
  const p = el("path", { d: `M${A.x},${A.y} C${mx},${A.y} ${mx},${B.y} ${B.x},${B.y}`, class: `edge ${e.kind}` }, map);
  return { p, year: B.year };
});
const trail = el("polyline", { points: "", fill: "none", stroke: "var(--idea)", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.35 }, map);
const numbers = [];
const nodeEls = S.map((s) => {
  const p = pointAt(s.year);
  const r = bubbleR(p);
  const g = el("g", { class: `station${p ? "" : " no-data"}${p?.approximate ? " est" : ""}` }, map);
  el("circle", { cx: s.x, cy: s.y, r: r + 4, class: "halo" }, g);
  const bub = el("circle", { cx: s.x, cy: s.y, r, class: "bubble", stroke: laneColor(s.lane) }, g);
  numbers.push({ g, x: s.x, y: s.y, r, text: p ? fmt(p) : "?" });
  const up = s.lab === "above";
  el("text", { x: s.x, y: up ? s.y - r - 18 : s.y + r + 28, class: "node-year", "text-anchor": "middle" }, g).textContent = s.label;
  el("text", { x: s.x, y: up ? s.y - r - 6 : s.y + r + 14, class: "node-name", "text-anchor": "middle" }, g).textContent = s.short;
  const tip = el("title", {}, g);
  tip.textContent = p ? `${s.label}: ${p.approximate ? "about " : ""}${prefix}${num(p.value)}${unit}${p.year !== s.year ? ` (${p.year})` : ""}` : `${s.label}: before the data begins in ${R[0].year}`;
  g.addEventListener("click", () => animateTo(s.year));
  return { g, bub, s };
});
const token = el("g", { class: "token" }, map);
el("circle", { r: 20, fill: "var(--idea-soft)" }, token);
const tokenCore = el("circle", { r: 6, fill: "var(--idea)", stroke: "#fff", "stroke-width": 2.5 }, token);
const tokenLabel = el("text", { y: -26, "text-anchor": "middle", class: "lane-label", fill: "var(--idea)" }, token);
tokenLabel.textContent = "the idea";

// Bubble numbers sit above the token so the idea never hides the figure it is passing.
const numLayer = el("g", { "pointer-events": "none" }, map);
for (const n of numbers) {
  const t = el("text", { x: n.x, y: n.y + 4, class: `bubble-n${n.text === "?" ? " nd" : ""}`, "text-anchor": "middle", "font-size": n.r >= 18 ? 12 : 10 }, numLayer);
  t.textContent = n.text;
  n.el = t;
}

// ---- chart --------------------------------------------------------------------------------
// The chart can zoom to the years the data covers; its cursor hides outside them.
const CX0 = IDEA.chart?.xFrom ?? Y0;
const XC = (y) => X0 + ((y - CX0) / (Y1 - CX0)) * (X1 - X0);
const chartTicks = [];
const tickStep = Y1 - CX0 > 60 ? 20 : Y1 - CX0 > 30 ? 10 : 4;
for (let y = Math.ceil(CX0 / tickStep) * tickStep; y <= Y1 - 2; y += tickStep) chartTicks.push(y);
const CY0 = 200, CY1 = 20;
const top = Math.max(...R.map((r) => r.value));
const stepV = IDEA.chart?.step ?? (top > 200 ? 100 : top > 50 ? 20 : 10);
const RMAX = Math.ceil((top * 1.05) / stepV) * stepV;
const CY = (v) => CY0 - (v / RMAX) * (CY0 - CY1);
for (let v = 0; v <= RMAX + 1e-9; v += stepV) {
  el("line", { x1: X0, x2: X1, y1: CY(v), y2: CY(v), stroke: "var(--color-border)", "stroke-width": 1 }, chart);
  el("text", { x: X0 - 10, y: CY(v) + 4, class: "axis", "text-anchor": "end" }, chart).textContent = `${prefix}${+v.toFixed(2)}${unit}`;
}
for (const y of chartTicks) el("text", { x: XC(y), y: 226, class: "axis", "text-anchor": "middle" }, chart).textContent = y;
for (let i = 1; i < R.length; i++) {
  const a = R[i - 1], b = R[i], est = a.approximate || b.approximate || b.year - a.year > Math.max(5, cycle);
  el("line", {
    x1: XC(a.year), y1: CY(a.value), x2: XC(b.year), y2: CY(b.value),
    stroke: "var(--color-ink)", "stroke-width": 2, "stroke-dasharray": est ? "3 4" : "none", opacity: est ? 0.5 : 1,
  }, chart);
}
for (const r of R) el("circle", { cx: XC(r.year), cy: CY(r.value), r: 2.8, fill: r.approximate ? "#fff" : "var(--color-ink)", stroke: "var(--color-ink)", "stroke-width": 1.4 }, chart);
const cursor = el("line", { y1: CY1 - 8, y2: CY0, stroke: "var(--idea)", "stroke-width": 2 }, chart);
const cursorDot = el("circle", { r: 6, fill: "var(--idea)" }, chart);
// ---- meter: one square per unit of the outcome (a worker's pay, $100 million, ...) --------
const dotUnit = IDEA.chart?.dotUnit ?? 1;
const DOTS = IDEA.chart?.dots ?? Math.ceil(VMAX / dotUnit / 10) * 10;
const dots = Array.from({ length: DOTS }, () => dotsEl.appendChild(document.createElement("i")));
let lit = -1;
function drawMeter(y) {
  const p = pointAt(y);
  const n = p ? Math.round(p.value / dotUnit) : 0;
  if (n !== lit) {
    for (let i = 0; i < DOTS; i++) dots[i].className = i < n ? "on" : "";
    lit = n;
  }
  meterN.textContent = p ? fmt(p) : "?";
  meterN.classList.toggle("est", !!p?.approximate);
  const tpl = IDEA.chart?.meter ?? "{year}: {n}";
  meterCap.textContent = p
    ? tpl.replace("{year}", String(p.year))
        .replace("{n}", `${p.approximate ? "about " : ""}${num(p.value)}`)
        .replace("{v}", `${p.approximate ? "about " : ""}${prefix}${num(p.value)}${badge}`) + (p.approximate ? ` ${IDEA.chart?.estimateNote ?? "This year is an estimate."}` : "")
    : `${Math.round(y)}: no data yet. The series starts in ${R[0].year} at ${fmt(R[0])}.`;
}

// ---- card ----------------------------------------------------------------------------------
function drawCard(s) {
  const left = h("div");
  left.append(h("div", "big-year", s.label), h("h3", null, s.title), h("p", "who", s.who), h("p", "where", s.where));
  const chip = h("span", "chip", laneOf(s.lane).label);
  chip.style.background = laneColor(s.lane);
  left.append(chip);
  const dl = h("dl");
  for (const [label, text] of [["What they made", s.what], ["What they sold", s.pitch], ["How it spread", s.spread]]) {
    const d = h("div");
    d.append(h("dt", null, label), h("dd", null, text));
    dl.append(d);
  }
  const src = h("div"), dd = h("dd");
  src.append(h("dt", null, "Sources"), dd);
  s.sources.forEach((n, i) => {
    const a = h("a", null, String(n));
    a.href = `#src-${n}`;
    a.title = IDEA.sources.find((x) => x.n === n)?.title ?? "";
    if (i) dd.append(", ");
    dd.append(a);
  });
  dl.append(src);
  card.replaceChildren(left, dl);
}

// ---- state ---------------------------------------------------------------------------------
let year = S[0].year, current = null, anim = 0;

function posAt(y) {
  if (y <= S[0].year) return [S[0].x, S[0].y];
  for (let i = 1; i < S.length; i++) {
    if (y <= S[i].year) {
      const a = S[i - 1], b = S[i], t = (y - a.year) / (b.year - a.year);
      return [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t];
    }
  }
  const l = S[S.length - 1];
  return [l.x, l.y];
}

function render() {
  const [tx, ty] = posAt(year);
  token.setAttribute("transform", `translate(${tx},${ty})`);
  // Parked on a station, the bubble itself is the idea; hide the dot so the figure reads.
  const parked = S.some((s) => Math.abs(s.year - year) < 0.35);
  tokenCore.setAttribute("opacity", parked ? 0 : 1);
  tokenLabel.setAttribute("opacity", parked ? 0 : 1);
  const pts = S.filter((s) => s.year <= year).map((s) => `${s.x},${s.y}`);
  pts.push(`${tx},${ty}`);
  trail.setAttribute("points", pts.join(" "));
  for (const { g, s } of nodeEls) g.classList.toggle("on", s.year <= year + 0.01);
  for (const n of numbers) n.el.classList.toggle("on", n.g.classList.contains("on"));
  for (const { p, year: y } of edgeEls) p.classList.toggle("on", y <= year + 0.01);

  const active = S.filter((s) => s.year <= year + 0.01).pop() || S[0];
  if (active !== current) {
    nodeEls.forEach(({ g, s }) => g.classList.toggle("is-current", s === active));
    current = active;
    drawCard(active);
  }
  now.textContent = `${active.label} · ${active.short}`;
  range.value = String(year);
  range.setAttribute("aria-valuetext", `${active.label}, ${active.title}`);

  const inChart = year >= CX0;
  cursor.setAttribute("opacity", inChart ? 1 : 0);
  cursor.setAttribute("x1", XC(Math.max(year, CX0)));
  cursor.setAttribute("x2", XC(Math.max(year, CX0)));
  const pt = pointAt(year);
  readout.replaceChildren();
  if (!pt) {
    cursorDot.setAttribute("opacity", 0);
    readout.append(h("b", null, "–"), `${Math.round(year)}: before the data begins in ${R[0].year}`);
  } else {
    cursorDot.setAttribute("opacity", 1);
    cursorDot.setAttribute("cx", XC(pt.year));
    cursorDot.setAttribute("cy", CY(pt.value));
    readout.append(h("b", null, `${pt.approximate ? "about " : ""}${prefix}${num(pt.value)}${unit}`), `${IDEA.chart?.label ?? ""}, ${pt.year}`);
  }
  drawMeter(year);

  // On narrow screens the map scrolls sideways; keep the idea in view.
  if (scroller.scrollWidth > scroller.clientWidth + 4) {
    const px = (tx / 1000) * map.getBoundingClientRect().width;
    const left = scroller.scrollLeft, w = scroller.clientWidth;
    if (px < left + 40 || px > left + w - 40) scroller.scrollLeft = px - w / 2;
  }
}

function animateTo(target) {
  cancelAnimationFrame(anim);
  if (reduceMotion) { year = target; render(); return; }
  const start = year, t0 = performance.now(), dur = Math.min(900, 200 + Math.abs(target - start) * 25);
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    year = start + (target - start) * e;
    render();
    if (k < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}
const nearest = (y) => S.reduce((a, b) => (Math.abs(b.year - y) < Math.abs(a.year - y) ? b : a));
const idx = () => S.indexOf(nearest(year));
const next = () => animateTo(S[Math.min(S.length - 1, idx() + 1)].year);
const prev = () => animateTo(S[Math.max(0, idx() - 1)].year);

// ---- input ---------------------------------------------------------------------------------
// Dragging the token works with a mouse or pen. On touch the map scrolls sideways instead,
// and the slider underneath does the moving.
function svgYear(evt) {
  const pt = map.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  const p = pt.matrixTransform(map.getScreenCTM().inverse());
  return Math.max(S[0].year, Math.min(S[S.length - 1].year, unfrac((p.x - X0) / (X1 - X0))));
}
let dragging = false;
map.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch" || e.target.closest(".station")) return;
  dragging = true;
  map.classList.add("drag");
  try { map.setPointerCapture(e.pointerId); } catch { /* drag still works */ }
  cancelAnimationFrame(anim);
  year = svgYear(e);
  render();
});
map.addEventListener("pointermove", (e) => { if (dragging) { year = svgYear(e); render(); } });
const end = () => {
  if (!dragging) return;
  dragging = false;
  map.classList.remove("drag");
  animateTo(nearest(year).year);
};
map.addEventListener("pointerup", end);
map.addEventListener("pointercancel", end);

range.addEventListener("input", () => { cancelAnimationFrame(anim); year = Number(range.value); render(); });
range.addEventListener("change", () => animateTo(nearest(Number(range.value)).year));
// Arrow keys on the slider jump station to station rather than by a tenth of a year.
range.addEventListener("keydown", (e) => {
  const go = { ArrowRight: next, ArrowUp: next, ArrowLeft: prev, ArrowDown: prev, Home: () => animateTo(S[0].year), End: () => animateTo(S[S.length - 1].year) }[e.key];
  if (go) { e.preventDefault(); go(); }
});
$("isl-next").addEventListener("click", next);
$("isl-prev").addEventListener("click", prev);

render();
