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
const Y0 = Math.floor(S[0].year / 10) * 10 - 4;
const Y1 = S[S.length - 1].year + 4;
const X = (y) => X0 + ((y - Y0) / (Y1 - Y0)) * (X1 - X0);
const laneOf = (id) => IDEA.lanes.find((l) => l.id === id);
const laneColor = (id) => `var(--lane-${id}, var(--color-ink-soft))`;
for (const s of S) { s.x = X(s.year); s.y = laneOf(s.lane).y + (s.yOff || 0); }
const byId = Object.fromEntries(S.map((s) => [s.id, s]));
const sourceUrl = (n) => IDEA.sources.find((s) => s.n === n)?.url ?? "#";

const $ = (id) => document.getElementById(id);
const map = $("isl-map"), chart = $("isl-chart"), range = $("isl-range"), now = $("isl-now");
const scroller = $("isl-scroll"), card = $("isl-card"), readout = $("isl-readout");

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
  el("line", { x1: X(y), x2: X(y), y1: 24, y2: 390, stroke: "var(--color-border)", "stroke-width": 1, "stroke-dasharray": "2 6" }, map);
  el("text", { x: X(y), y: 404, class: "node-year", "text-anchor": "middle" }, map).textContent = y;
}
const edgeEls = IDEA.edges.map((e) => {
  const A = byId[e.from], B = byId[e.to], mx = (A.x + B.x) / 2;
  const p = el("path", { d: `M${A.x},${A.y} C${mx},${A.y} ${mx},${B.y} ${B.x},${B.y}`, class: `edge ${e.kind}` }, map);
  return { p, year: B.year };
});
const trail = el("polyline", { points: "", fill: "none", stroke: "var(--idea)", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.35 }, map);
const nodeEls = S.map((s) => {
  const g = el("g", { class: "station" }, map);
  el("circle", { cx: s.x, cy: s.y, r: 11, fill: "#fff", stroke: laneColor(s.lane), "stroke-width": 2.5 }, g);
  const dot = el("circle", { cx: s.x, cy: s.y, r: 5, fill: laneColor(s.lane), opacity: 0.25 }, g);
  const up = s.lab === "above";
  el("text", { x: s.x, y: up ? s.y - 28 : s.y + 40, class: "node-year", "text-anchor": "middle" }, g).textContent = s.year;
  el("text", { x: s.x, y: up ? s.y - 16 : s.y + 26, class: "node-name", "text-anchor": "middle" }, g).textContent = s.short;
  g.addEventListener("click", () => animateTo(s.year));
  return { g, dot, s };
});
const token = el("g", {}, map);
el("circle", { r: 22, fill: "var(--idea-soft)" }, token);
el("circle", { r: 10, fill: "var(--idea)", stroke: "#fff", "stroke-width": 3 }, token);
el("text", { y: -28, "text-anchor": "middle", class: "lane-label", fill: "var(--idea)" }, token).textContent = "the idea";

// ---- chart --------------------------------------------------------------------------------
const R = IDEA.ratio;
const unit = IDEA.chart?.unit ?? "";
const CY0 = 200, CY1 = 20;
const top = Math.max(...R.map((r) => r.value));
const stepV = top > 200 ? 100 : top > 50 ? 20 : 10;
const RMAX = Math.ceil((top * 1.05) / stepV) * stepV;
const CY = (v) => CY0 - (v / RMAX) * (CY0 - CY1);
for (let v = 0; v <= RMAX; v += stepV) {
  el("line", { x1: X0, x2: X1, y1: CY(v), y2: CY(v), stroke: "var(--color-border)", "stroke-width": 1 }, chart);
  el("text", { x: X0 - 10, y: CY(v) + 4, class: "axis", "text-anchor": "end" }, chart).textContent = v + unit;
}
for (const y of decades) el("text", { x: X(y), y: 226, class: "axis", "text-anchor": "middle" }, chart).textContent = y;
for (let i = 1; i < R.length; i++) {
  const gap = R[i].year - R[i - 1].year > 5;
  el("line", {
    x1: X(R[i - 1].year), y1: CY(R[i - 1].value), x2: X(R[i].year), y2: CY(R[i].value),
    stroke: "var(--color-ink)", "stroke-width": 2, "stroke-dasharray": gap ? "3 5" : "none", opacity: gap ? 0.55 : 1,
  }, chart);
}
for (const r of R) el("circle", { cx: X(r.year), cy: CY(r.value), r: 4.5, fill: r.approximate ? "#fff" : "var(--color-ink)", stroke: "var(--color-ink)", "stroke-width": 2 }, chart);
const cursor = el("line", { y1: CY1 - 8, y2: CY0, stroke: "var(--idea)", "stroke-width": 2 }, chart);
const cursorDot = el("circle", { r: 6, fill: "var(--idea)" }, chart);
const ratioAt = (y) => {
  if (y < R[0].year) return null;
  if (y >= R[R.length - 1].year) return R[R.length - 1].value;
  for (let i = 1; i < R.length; i++) if (y <= R[i].year) {
    const a = R[i - 1], b = R[i];
    return a.value + ((b.value - a.value) * (y - a.year)) / (b.year - a.year);
  }
};
const exact = (y) => R.find((r) => Math.abs(r.year - y) < 0.05);

// ---- card ----------------------------------------------------------------------------------
function drawCard(s) {
  const left = h("div");
  left.append(h("div", "big-year", s.year), h("h3", null, s.title), h("p", "who", s.who), h("p", "where", s.where));
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
  const pts = S.filter((s) => s.year <= year).map((s) => `${s.x},${s.y}`);
  pts.push(`${tx},${ty}`);
  trail.setAttribute("points", pts.join(" "));
  for (const { g, dot, s } of nodeEls) {
    const on = s.year <= year + 0.01;
    g.classList.toggle("on", on);
    dot.setAttribute("opacity", on ? 1 : 0.25);
  }
  for (const { p, year: y } of edgeEls) p.classList.toggle("on", y <= year + 0.01);

  const active = S.filter((s) => s.year <= year + 0.01).pop() || S[0];
  if (active !== current) { current = active; drawCard(active); }
  now.textContent = `${active.year} · ${active.short}`;
  range.value = String(year);
  range.setAttribute("aria-valuetext", `${active.year}, ${active.title}`);

  cursor.setAttribute("x1", X(year));
  cursor.setAttribute("x2", X(year));
  const r = ratioAt(year);
  readout.replaceChildren();
  if (r == null) {
    cursorDot.setAttribute("opacity", 0);
    readout.append(h("b", null, "–"), `${Math.round(year)}: before the data begins in ${R[0].year}`);
  } else {
    cursorDot.setAttribute("opacity", 1);
    cursorDot.setAttribute("cx", X(year));
    cursorDot.setAttribute("cy", CY(r));
    const e = exact(year);
    readout.append(h("b", null, `${e && !e.approximate ? "" : "about "}${Math.round(r)}${unit}`), `${IDEA.chart?.label ?? ""}, ${Math.round(year)}`);
  }

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
  return Math.max(S[0].year, Math.min(S[S.length - 1].year, Y0 + ((p.x - X0) / (X1 - X0)) * (Y1 - Y0)));
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
