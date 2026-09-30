/**
 * World generation for the 3D valley. Pure numbers in, typed arrays out: no three.js, no DOM.
 * That lets it run in a Web Worker (lib/world.worker.ts) and, if workers are unavailable,
 * on the main thread one piece per frame. Either way the scene streams in instead of freezing the page.
 */

/* ---- deterministic noise (the terrain shader has a GLSL twin) ---- */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (x: number, z: number) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
export function vnoise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, oct = 5) {
  let v = 0, a = 0.5;
  for (let i = 0; i < oct; i++) {
    v += a * vnoise(x, y);
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const ss = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const riverX = (z: number) => 2 + 6 * Math.sin(0.05 * z + 0.6) + 0.04 * z;

export function heightAt(x: number, z: number) {
  const d = Math.abs(x - riverX(z));
  let h = -1 + 1.3 * ss(3.2, 5.2, d);
  h += ss(5, 35, d) * 2.4 * (0.6 + 0.8 * vnoise(x * 0.05, z * 0.05));
  h += (vnoise(x * 0.15 + 3, z * 0.15) - 0.5) * 0.7 * ss(5, 10, d);
  const far = Math.min(100, Math.max(0, -z - 25));
  h += far * far * 0.0026 * (0.5 + vnoise(x * 0.03 + 5, z * 0.03)) * ss(5, 16, d); // not under the river, or the boat sinks
  h += Math.max(0, Math.abs(x) - 45) * 0.28;
  return h;
}

/** Bake a noise field into an 8-bit map once, so shaders do a lookup instead of fbm per pixel. */
function bake(w: number, h: number, f: (u: number, v: number) => number) {
  const data = new Uint8Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) data[j * w + i] = Math.round(clamp(f((i + 0.5) / w, (j + 0.5) / h)) * 255);
  return data;
}

export const RIDGES = [
  { z: -415, w: 1600, c: "#b3c3e8", c2: "#c3cdee", base: 30, amp: 48, freq: 0.011, seed: 3.1, snow: 44, patch: 0.3 },
  { z: -325, w: 1200, c: "#8fa7da", c2: "#9aaedb", base: 18, amp: 34, freq: 0.017, seed: 8.7, snow: 40, patch: 0.3 },
  { z: -255, w: 900, c: "#6c89c2", c2: "#7b8f9e", base: 10, amp: 20, freq: 0.025, seed: 1.9, snow: 1e4, patch: 0.5 },
  { z: -200, w: 650, c: "#b8663a", c2: "#8a7c3c", base: 5, amp: 12, freq: 0.035, seed: 5.3, snow: 1e4, patch: 1 },
];

/* ---- slices along the river: the unit of streaming, culling and level of detail ---- */
export const ZMIN = -200;
export const NCH = 12;
export const CHZ = 240 / NCH;
export const chunkOf = (z: number) => Math.min(NCH - 1, Math.max(0, Math.floor((z - ZMIN) / CHZ)));

type Sphere = [number, number, number, number];
export type ChunkPiece = {
  k: "chunk";
  ci: number;
  canopy: null | { total: number; center: Float32Array; dir: Float32Array; par: Float32Array; col: Float32Array; sphere: Sphere };
  /** x, y, z, height, width per trunk */
  trunks: null | { n: number; data: Float32Array };
  grass: null | { n: number; off: Float32Array; par: Float32Array; sphere: Sphere };
};
export type Piece =
  | { k: "cloud"; w: number; h: number; data: Uint8Array }
  | { k: "ridge"; i: number; w: number; data: Uint8Array }
  | ChunkPiece;

export function transfers(p: Piece): ArrayBuffer[] {
  if (p.k !== "chunk") return [p.data.buffer as ArrayBuffer];
  const out: ArrayBuffer[] = [];
  const own = (a: Float32Array) => a.buffer as ArrayBuffer;
  if (p.canopy) out.push(own(p.canopy.center), own(p.canopy.dir), own(p.canopy.par), own(p.canopy.col));
  if (p.trunks) out.push(own(p.trunks.data));
  if (p.grass) out.push(own(p.grass.off), own(p.grass.par));
  return out;
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); // sRGB -> linear, like THREE.Color
const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [lin(((n >> 16) & 255) / 255), lin(((n >> 8) & 255) / 255), lin((n & 255) / 255)];
};

function sphereOf(pts: ArrayLike<number>, stride: number, count: number, pad: number): Sphere {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = pts[i * stride], y = pts[i * stride + 1], z = pts[i * stride + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  return [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 + pad];
}

type Blob = { x: number; y: number; z: number; s: number; c: [number, number, number] };
type Trunk = { x: number; y: number; z: number; h: number; w: number };

/** Everything the scene streams in, in the order it should appear: sky bits first, then river slices nearest the start first. */
export function* pieces(hi: boolean): Generator<Piece> {
  yield { k: "cloud", w: hi ? 1024 : 512, h: hi ? 192 : 96, data: bake(hi ? 1024 : 512, hi ? 192 : 96, (u, v) => fbm(u * 12.4, v * 2.4 - 0.08, hi ? 5 : 4)) };
  for (let i = 0; i < RIDGES.length; i++) {
    const r = RIDGES[i];
    const w = hi ? 2048 : 1024;
    yield { k: "ridge", i, w, data: bake(w, 1, (u) => fbm((u - 0.5) * r.w * r.freq + r.seed, r.seed * 0.37)) };
  }

  // ---- maple trees
  const r = rng(7);
  const autumn = ["#ee6b2b", "#f58e36", "#d8432b", "#f4b13f", "#e25a2c"].map(rgb);
  const ever = ["#557c3d", "#476f39"].map(rgb);
  const blobs: Blob[] = [];
  const trunks: Trunk[] = [];
  const addTree = (x: number, z: number, s: number, full: boolean) => {
    const h = heightAt(x, z);
    const th = (1.3 + r() * 0.8) * s;
    trunks.push({ x, y: h - 0.3, z, h: th + 0.3 + 0.5 * s, w: 0.18 * s });
    const pal = r() < 0.14 ? ever : autumn;
    const tc = pal[Math.floor(r() * pal.length)];
    blobs.push({ x, y: h + th + 0.9 * s, z, s: 1.35 * s, c: tc });
    if (full) {
      blobs.push({ x: x + 0.9 * s, y: h + th + 0.5 * s, z: z + 0.4 * s, s: 1.0 * s, c: tc });
      blobs.push({ x: x - 0.8 * s, y: h + th + 0.6 * s, z: z - 0.3 * s, s: 1.05 * s, c: tc });
    }
    blobs.push({ x: x + 0.15 * s, y: h + th + 1.9 * s, z, s: 0.95 * s, c: tc });
  };
  for (let n = 0, tries = 0; n < (hi ? 380 : 200) && tries < 80000; tries++) {
    const x = -70 + r() * 140, z = -160 + r() * 160;
    const d = Math.abs(x - riverX(z));
    if (d < 6.5 || (z > -12 && x < 0) || (z > -8 && d > 14)) continue; // keep the meadow under the headline clear
    if (r() > (0.25 + 0.75 * (1 - ss(6, 22, d))) * (0.4 + vnoise(x * 0.07, z * 0.07))) continue;
    addTree(x, z, 0.7 + r() * 0.5, true);
    n++;
  }
  for (let n = 0, tries = 0; n < (hi ? 900 : 480) && tries < 80000; tries++) {
    const x = -95 + r() * 190, z = -190 + r() * 165;
    if (Math.abs(x - riverX(z)) < 7 || r() > 0.3 + vnoise(x * 0.05, z * 0.05)) continue;
    addTree(x, z, 1.5 + r() * 0.9, false);
    n++;
  }
  const blobBuckets: Blob[][] = Array.from({ length: NCH }, () => []);
  const trunkBuckets: Trunk[][] = Array.from({ length: NCH }, () => []);
  for (const b of blobs) blobBuckets[chunkOf(b.z)].push(b);
  for (const t of trunks) trunkBuckets[chunkOf(t.z)].push(t);

  // ---- meadow grass points
  const GRASS = hi ? 36000 : 14000;
  const gOff: number[][] = Array.from({ length: NCH }, () => []);
  const gPar: number[][] = Array.from({ length: NCH }, () => []);
  const gr = rng(3);
  for (let n = 0; n < GRASS; n++) {
    const z = -140 + gr() * 174;
    const side = gr() < 0.5 ? -1 : 1;
    const x = riverX(z) + side * (5.4 + gr() * gr() * 20);
    const t = vnoise(x * 0.15, z * 0.15);
    const c = chunkOf(z);
    gOff[c].push(x, heightAt(x, z) - 0.05, z);
    gPar[c].push(0.45 + gr() * 0.55 + t * 0.25, gr() * Math.PI, gr(), t);
  }

  // ---- one piece per slice, nearest the boat's start first
  const CARDS = hi ? 40 : 22; // crowns are leaf cards only, so they need many
  const cr = rng(13);
  for (let ci = NCH - 1; ci >= 0; ci--) {
    const bl = blobBuckets[ci];
    let canopy: ChunkPiece["canopy"] = null;
    if (bl.length) {
      const n0 = bl.length * CARDS;
      const center = new Float32Array(n0 * 3), dir = new Float32Array(n0 * 4);
      const par = new Float32Array(n0 * 4), col = new Float32Array(n0 * 3);
      // card-major order: trimming instanceCount thins every crown evenly instead of stripping far ones bare
      for (let j = 0, n = 0; j < CARDS; j++)
        for (const b of bl) {
          let vx = cr() * 2 - 1, vy = (cr() * 2 - 1) * 0.85 + 0.2, vz = cr() * 2 - 1;
          const len = Math.hypot(vx, vy, vz) || 1;
          vx /= len; vy /= len; vz /= len;
          const c3 = n * 3, c4 = n * 4;
          center[c3] = b.x; center[c3 + 1] = b.y; center[c3 + 2] = b.z;
          dir[c4] = vx; dir[c4 + 1] = vy; dir[c4 + 2] = vz;
          // baked ambient occlusion: cards deep inside the crown or facing down are darker
          const rad = (0.2 + 0.85 * Math.cbrt(cr())) / 1.05;
          const up = clamp((vy + 0.5) / 1.35);
          const ao = (0.55 + 0.45 * up * up * (3 - 2 * up)) * (0.7 + 0.3 * rad) * 1.06;
          dir[c4 + 3] = b.s * rad * 1.05;
          par[c4] = b.s * (0.75 + cr() * 0.45);
          par[c4 + 1] = cr() * Math.PI * 2;
          par[c4 + 2] = ao * (0.96 + cr() * 0.08);
          par[c4 + 3] = cr();
          const lum = 1 + (cr() - 0.5) * 0.08, hue = (cr() - 0.5) * 0.06;
          col[c3] = b.c[0] * lum * (1 + hue);
          col[c3 + 1] = b.c[1] * lum;
          col[c3 + 2] = b.c[2] * lum * (1 - hue);
          n++;
        }
      canopy = { total: n0, center, dir, par, col, sphere: sphereOf(center, 3, bl.length, 6) }; // crowns are ~3 wide, plus sway
    }

    const tl = trunkBuckets[ci];
    const trunkPiece: ChunkPiece["trunks"] = tl.length
      ? { n: tl.length, data: Float32Array.from(tl.flatMap((t) => [t.x, t.y, t.z, t.h, t.w])) }
      : null;

    const n1 = gOff[ci].length / 3;
    const grassPiece: ChunkPiece["grass"] = n1
      ? { n: n1, off: new Float32Array(gOff[ci]), par: new Float32Array(gPar[ci]), sphere: sphereOf(gOff[ci], 3, n1, 4) }
      : null;

    yield { k: "chunk", ci, canopy, trunks: trunkPiece, grass: grassPiece };
  }
}
