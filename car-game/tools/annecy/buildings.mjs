/**
 * Buildings of the Annecy circuit: real roof shapes measured in the IGN surface model at 1 m,
 * and a facade style from the OpenStreetMap tags and the district.
 *
 * Roof: inside the footprint's minimum-area rectangle (long axis u, short axis v), the measured
 * heights above the ground are fitted with four models — flat, gable with the ridge along u,
 * gable with the ridge along v, hip — by least squares (outliers such as overhanging trees
 * dropped and the fit redone); the best one gives the eave height, the rise and the ridge
 * direction.
 */

/** Buildings kept by the build (centroid within this distance of the route), m. */
export const BUILDING_RADIUS = 260;

export const ROOF = { FLAT: 0, GABLE: 1, HIP: 2 };
export const STYLE = { HOUSE: 0, APARTMENTS: 1, SHOPS: 2, OLD_TOWN: 3, CHALET: 4, STONE: 5, INDUSTRIAL: 6 };

/** Convex hull (monotone chain) of [x, y] points. */
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up = [];
  for (let k = p.length - 1; k >= 0; k--) {
    const q = p[k];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/** Minimum-area enclosing rectangle: centre, half-length along u, half-width along v, angle of u. */
export function minRect(pts) {
  const h = hull(pts);
  let best = null;
  for (let k = 0; k < h.length; k++) {
    const [ax, ay] = h[k];
    const [bx, by] = h[(k + 1) % h.length];
    const ang = Math.atan2(by - ay, bx - ax);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const [x, y] of h) {
      const u = x * c + y * s;
      const v = -x * s + y * c;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) {
      const uc = (u0 + u1) / 2;
      const vc = (v0 + v1) / 2;
      best = { area, cx: uc * c - vc * s, cy: uc * s + vc * c, hl: (u1 - u0) / 2, hw: (v1 - v0) / 2, angle: ang };
    }
  }
  // Long axis first.
  if (best.hw > best.hl) best = { ...best, hl: best.hw, hw: best.hl, angle: best.angle + Math.PI / 2 };
  return best;
}

export function polygonArea(pts) {
  let a = 0;
  for (let k = 0; k < pts.length; k++) {
    const [ax, ay] = pts[k];
    const [bx, by] = pts[(k + 1) % pts.length];
    a += ax * by - bx * ay;
  }
  return Math.abs(a) / 2;
}

export function pointInPolygon(x, y, pts) {
  let inside = false;
  for (let k = 0, m = pts.length - 1; k < pts.length; m = k++) {
    const [ax, ay] = pts[k];
    const [bx, by] = pts[m];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

/** Least squares h ≈ e + r·f (two unknowns). */
function fit2(samples, f) {
  let n = 0;
  let sf = 0;
  let sh = 0;
  let sff = 0;
  let sfh = 0;
  for (const s of samples) {
    const x = f(s);
    n++;
    sf += x;
    sh += s.h;
    sff += x * x;
    sfh += x * s.h;
  }
  const det = n * sff - sf * sf;
  if (n < 6 || Math.abs(det) < 1e-9) return null;
  const r = (n * sfh - sf * sh) / det;
  const e = (sh - r * sf) / n;
  let err = 0;
  for (const s of samples) err += (s.h - e - r * f(s)) ** 2;
  return { e, r, rmse: Math.sqrt(err / n) };
}

/**
 * Roof from height samples {u, v, h} (rectangle frame, h above the building's base).
 * Returns { type, eave, rise, ridgeAlongU } or null when there is too little data.
 */
export function fitRoof(samples, rect) {
  if (samples.length < 12) return null;
  const { hl, hw } = rect;
  const models = [
    { type: ROOF.FLAT, along: true, f: () => 0 },
    { type: ROOF.GABLE, along: true, f: (s) => 1 - Math.min(1, Math.abs(s.v) / hw) },
    { type: ROOF.GABLE, along: false, f: (s) => 1 - Math.min(1, Math.abs(s.u) / hl) },
    { type: ROOF.HIP, along: true, f: (s) => Math.max(0, Math.min(hw - Math.abs(s.v), hl - Math.abs(s.u))) / hw },
  ];
  let best = null;
  for (const m of models) {
    let set = samples;
    let res = null;
    for (let pass = 0; pass < 2; pass++) {
      if (m.type === ROOF.FLAT) {
        const hs = set.map((s) => s.h).sort((a, b) => a - b);
        const e = hs[Math.floor(hs.length / 2)];
        let err = 0;
        for (const s of set) err += (s.h - e) ** 2;
        res = { e, r: 0, rmse: Math.sqrt(err / set.length) };
      } else res = fit2(set, m.f);
      if (!res) break;
      // Drop outliers (trees over the roof, chimneys, MNS blur at the edges) and refit.
      const keep = set.filter((s) => Math.abs(s.h - res.e - res.r * m.f(s)) < Math.max(1.2, 2 * res.rmse));
      if (keep.length < 10 || keep.length === set.length) break;
      set = keep;
    }
    if (!res) continue;
    // Sloped roofs must really slope (rise 0.8–9 m); prefer flat when it is about as good.
    if (m.type !== ROOF.FLAT && (res.r < 0.8 || res.r > 9)) continue;
    const score = res.rmse * (m.type === ROOF.FLAT ? 0.85 : 1);
    if (!best || score < best.score) best = { score, type: m.type, eave: res.e, rise: res.r, ridgeAlongU: m.along };
  }
  return best;
}

const OLD_TOWN = { X: 0, Y: 0, r: 0 };
/** District of the old town (Vieille Ville around the Thiou canals), Lambert-93. */
export function setOldTown(X, Y, r) {
  OLD_TOWN.X = X;
  OLD_TOWN.Y = Y;
  OLD_TOWN.r = r;
}

/** Facade style from the OSM tags, size and place. */
export function styleOf(tags, area, H, X, Y, rnd) {
  const b = tags.building;
  const name = tags.name ?? '';
  if (/church|chapel|cathedral|castle|basilica|monastery/.test(b) || tags.amenity === 'place_of_worship' || tags.historic === 'castle' || /Château|Palais de l.Île|Basilique|Église|Cathédrale/i.test(name)) return STYLE.STONE;
  if (/industrial|warehouse|garage|garages|shed|roof|hangar|service|transformer_tower|carport|greenhouse/.test(b)) return STYLE.INDUSTRIAL;
  if (Math.hypot(X - OLD_TOWN.X, Y - OLD_TOWN.Y) < OLD_TOWN.r && H < 24) return STYLE.OLD_TOWN;
  if (/commercial|retail|office|hotel|supermarket|kiosk/.test(b) || tags.shop || tags.amenity === 'restaurant') return STYLE.SHOPS;
  if (/apartments|residential|dormitory/.test(b) || (area > 380 && H > 9) || H > 13) return STYLE.APARTMENTS;
  if (/house|detached|semidetached_house|farm|bungalow|cabin|hut|yes/.test(b) && H < 12) return rnd < 0.28 ? STYLE.CHALET : STYLE.HOUSE;
  return STYLE.HOUSE;
}

/** Wall colours by style (sRGB): Annecy's plasters, the old town's ochres and pinks. */
export const WALLS = {
  [STYLE.HOUSE]: [0xeee8dc, 0xe9dcc0, 0xe3cf9f, 0xf2efe8, 0xd9cdb8, 0xe6d3b8, 0xe8e2d0],
  [STYLE.APARTMENTS]: [0xe9e6df, 0xdcd6cb, 0xcfc9bd, 0xeee9dd, 0xd8cbb3, 0xc9c4ba],
  [STYLE.SHOPS]: [0xe5e2dc, 0xd6d2ca, 0xcac6bf, 0xe9dfcf],
  [STYLE.OLD_TOWN]: [0xd9a55e, 0xe6c46c, 0xe0a27e, 0xd59a96, 0xb9c3a6, 0xc97d58, 0xe8d39a, 0xd7b48a],
  [STYLE.CHALET]: [0xeee6d6, 0xe7dccb, 0xf1ece2],
  [STYLE.STONE]: [0xb9b2a4, 0xc4bcad, 0xa9a397],
  [STYLE.INDUSTRIAL]: [0xb8bcbf, 0xc9c6bd, 0xa7aeb3, 0xd2cfc6],
};
