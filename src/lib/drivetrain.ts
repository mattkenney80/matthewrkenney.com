// Geometry for the 1-by drivetrain on /experiments/crank.
//
// Shared by the page's frontmatter (so the SVG paints before JavaScript) and its client
// script (which redraws the chain and derailleur while shifting). Every sprocket uses the
// same chain pitch, so a cog's radius is proportional to its tooth count, just like a real one.

export const TAU = Math.PI * 2;
export const U = 2.2; // pitch radius per tooth, in SVG units
export const PITCH = TAU * U; // one chain link
export const RING_TEETH = 32;
// A 12-speed 10-51 cassette, gear 1 (easiest, biggest cog) to gear 12 (hardest).
export const CASSETTE = [51, 45, 39, 33, 28, 24, 21, 18, 16, 14, 12, 10];
export const DEFAULT_GEAR = 5; // index into CASSETTE: gear 6, the 24-tooth cog
export const RING = { x: 140, y: 208 };
export const HUB = { x: 402, y: 170 };
export const ARM = 100;
export const PULLEY_R = 12;
export const PULLEY_TEETH = 11;
export const CAGE = 62; // distance between the two jockey wheels
export const MOUNT = { x: 462, y: 176 }; // where the derailleur hangs from the frame

export const f = (n: number) => n.toFixed(2);
export const rOf = (teeth: number) => teeth * U;
export const RING_R = rOf(RING_TEETH);
const R_MAX = rOf(CASSETTE[0]);
const R_MIN = rOf(CASSETTE[CASSETTE.length - 1]);

type Pt = { x: number; y: number };
type Wheel = Pt & { r: number; dir: 1 | -1 }; // dir 1 turns clockwise on screen

// A toothed outline: one trapezoid per tooth, joined along the root circle.
export function teethPath(cx: number, cy: number, n: number, root: number, tip: number) {
  const pitch = TAU / n;
  const at = (r: number, a: number) => `${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`;
  const parts: string[] = [];
  for (let k = 0; k < n; k++) {
    const a = k * pitch;
    parts.push(
      `${k === 0 ? "M" : "L"}${at(root, a - 0.42 * pitch)}`,
      `L${at(tip, a - 0.16 * pitch)}`,
      `L${at(tip, a + 0.16 * pitch)}`,
      `L${at(root, a + 0.42 * pitch)}`
    );
  }
  return parts.join(" ") + " Z";
}

export const circlePath = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)},${f(cy)} a${f(r)},${f(r)} 0 1 0 ${f(2 * r)},0 a${f(r)},${f(r)} 0 1 0 ${f(-2 * r)},0 Z`;

export const sprocketPath = (cx: number, cy: number, teeth: number) =>
  teethPath(cx, cy, teeth, rOf(teeth) - 2.6, rOf(teeth) + 2.8);

// Radius of the cog under the chain at a fractional gear position (used mid-shift).
export function cogRadius(pos: number) {
  const lo = Math.max(0, Math.min(CASSETTE.length - 1, Math.floor(pos)));
  const hi = Math.min(CASSETTE.length - 1, lo + 1);
  const t = pos - lo;
  return rOf(CASSETTE[lo]) * (1 - t) + rOf(CASSETTE[hi]) * t;
}

// The derailleur follows the cog: the upper jockey wheel tucks under it, and the cage
// swings forward on big cogs (it needs more chain) and back on small ones.
export function derailleurAt(rc: number) {
  const t = (R_MAX - rc) / (R_MAX - R_MIN); // 0 on the biggest cog, 1 on the smallest
  const upper = { x: HUB.x + 0.16 * rc + 10, y: HUB.y + rc + 24 };
  const a = ((-32 + 54 * t) * Math.PI) / 180;
  const lower = { x: upper.x + CAGE * Math.sin(a), y: upper.y + CAGE * Math.cos(a) };
  const knuckle = { x: upper.x + 6, y: upper.y - 24 };
  return { upper, lower, knuckle };
}

// Tangent from wheel A to wheel B that leaves A, and arrives at B, in each wheel's direction
// of rotation. Tries all four tangents and keeps the one the chain would actually follow.
function tangent(A: Wheel, B: Wheel) {
  const dx = B.x - A.x, dy = B.y - A.y;
  const L = Math.hypot(dx, dy), base = Math.atan2(dy, dx);
  const vel = (C: Wheel, P: Pt) => {
    const ex = P.x - C.x, ey = P.y - C.y, l = Math.hypot(ex, ey) || 1;
    return C.dir > 0 ? [-ey / l, ex / l] : [ey / l, -ex / l];
  };
  let best = { p1: A as Pt, p2: B as Pt }, score = -Infinity;
  for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
    const r1 = s1 * A.r, r2 = s2 * B.r, c = (r2 - r1) / L;
    if (Math.abs(c) > 1) continue;
    for (const pm of [1, -1]) {
      const ang = base + pm * Math.acos(c), nx = Math.cos(ang), ny = Math.sin(ang);
      const p1 = { x: A.x - r1 * nx, y: A.y - r1 * ny }, p2 = { x: B.x - r2 * nx, y: B.y - r2 * ny };
      const tx = p2.x - p1.x, ty = p2.y - p1.y, tl = Math.hypot(tx, ty) || 1;
      const va = vel(A, p1), vb = vel(B, p2);
      const s = (va[0] * tx + va[1] * ty) / tl + (vb[0] * tx + vb[1] * ty) / tl;
      if (s > score) { score = s; best = { p1, p2 }; }
    }
  }
  return best;
}

// The full chain loop: chainring, cog, upper jockey (wrapped on its front, the S-bend),
// lower jockey, and back to the chainring.
export function chainPath(rc: number) {
  const { upper, lower } = derailleurAt(rc);
  const wheels: Wheel[] = [
    { ...RING, r: RING_R, dir: 1 },
    { ...HUB, r: rc, dir: 1 },
    { ...upper, r: PULLEY_R, dir: -1 },
    { ...lower, r: PULLEY_R, dir: 1 },
  ];
  const legs = wheels.map((w, i) => tangent(w, wheels[(i + 1) % wheels.length]));
  const arc = (w: Wheel, from: Pt, to: Pt) => {
    const a0 = Math.atan2(from.y - w.y, from.x - w.x), a1 = Math.atan2(to.y - w.y, to.x - w.x);
    const sweep = w.dir > 0 ? (((a1 - a0) % TAU) + TAU) % TAU : (((a0 - a1) % TAU) + TAU) % TAU;
    return `A${f(w.r)} ${f(w.r)} 0 ${sweep > Math.PI ? 1 : 0} ${w.dir > 0 ? 1 : 0} ${f(to.x)},${f(to.y)}`;
  };
  let d = `M${f(legs[0].p1.x)},${f(legs[0].p1.y)}`;
  for (let i = 0; i < wheels.length; i++) {
    const next = (i + 1) % wheels.length;
    d += ` L${f(legs[i].p2.x)},${f(legs[i].p2.y)} ${arc(wheels[next], legs[i].p2, legs[next].p1)}`;
  }
  return d + " Z";
}

// The cage: a stadium shape around both jockey wheels.
export function cagePath(a: Pt, b: Pt, w: number) {
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l, ny = dx / l;
  const P = (p: Pt, s: number) => `${f(p.x + nx * w * s)},${f(p.y + ny * w * s)}`;
  return `M${P(a, 1)} L${P(b, 1)} A${w} ${w} 0 0 0 ${P(b, -1)} L${P(a, -1)} A${w} ${w} 0 0 0 ${P(a, 1)} Z`;
}

// The parallelogram: two links from the mount to the knuckle above the upper jockey.
export function linksPath(k: Pt) {
  const dx = k.x - MOUNT.x, dy = k.y - MOUNT.y, l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * 7, ny = (dx / l) * 7;
  return `M${f(MOUNT.x + nx)},${f(MOUNT.y + ny)} L${f(k.x + nx)},${f(k.y + ny)} ` +
    `M${f(MOUNT.x - nx)},${f(MOUNT.y - ny)} L${f(k.x - nx)},${f(k.y - ny)}`;
}
