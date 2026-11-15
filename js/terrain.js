import { GARDENS, ISLAND_RX, ISLAND_RZ, closestTrail, lerp, mulberry32, smoothstep } from './layout.js';

const rand = mulberry32(0x51ed15);
const perm = new Uint8Array(512);
const base = new Uint8Array(256);
for (let i = 0; i < 256; i++) base[i] = i;
for (let i = 255; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  const tmp = base[i];
  base[i] = base[j];
  base[j] = tmp;
}
for (let i = 0; i < 512; i++) perm[i] = base[i & 255];

function hash(ix, iz) {
  return perm[(ix & 255) + perm[iz & 255]] / 255;
}

function valueNoise(x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash(x0, z0);
  const b = hash(x0 + 1, z0);
  const c = hash(x0, z0 + 1);
  const d = hash(x0 + 1, z0 + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

function fbm(x, z) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < 4; i++) {
    sum += amp * valueNoise(x * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.05;
  }
  return sum / norm;
}

export function islandMask(x, z) {
  const n = (valueNoise(x * 0.045, z * 0.045) - 0.5) * 0.16;
  const d = Math.hypot(x / ISLAND_RX, z / ISLAND_RZ) + n;
  return smoothstep(1.05, 0.72, d);
}

function hill(x, z) {
  let h = (fbm(x * 0.016, z * 0.016) - 0.42) * 9.2;
  h += (fbm(x * 0.047 + 12, z * 0.047) - 0.5) * 2.1;
  const ld = Math.hypot(x * 0.85, z + 50);
  h += Math.exp(-(ld * ld) / 380) * 6.2;
  const wd = Math.hypot(x + 50, (z - 28) * 0.85);
  h += Math.exp(-(wd * wd) / 260) * 3.4;
  const cove = Math.hypot(x - 18, z - 48);
  h -= Math.exp(-(cove * cove) / 180) * 1.1;
  return h;
}

const trailY = new Map();
function vertexTrailHeight(x, z) {
  const key = `${x},${z}`;
  if (trailY.has(key)) return trailY.get(key);
  let h = hill(x, z) * Math.max(0.15, islandMask(x, z));
  for (const g of GARDENS) {
    const d = Math.hypot(x - g.x, z - g.z);
    if (d < g.r + 6) {
      const w = smoothstep(g.r + 6, g.r, d);
      h = lerp(h, g.ground, w);
    }
  }
  h = Math.max(h, 0.35);
  trailY.set(key, h);
  return h;
}

export function sampleHeight(x, z) {
  const mask = islandMask(x, z);
  let h = hill(x, z) * (0.25 + 0.75 * mask);

  for (const g of GARDENS) {
    const d = Math.hypot(x - g.x, z - g.z);
    const outer = g.r + 5.5;
    if (d < outer) {
      const w = smoothstep(outer, Math.max(0, g.r - 1.4), d);
      h = lerp(h, g.ground, w);
    }
  }

  const near = closestTrail(x, z);
  if (near && near.dist < 4.6) {
    const y0 = vertexTrailHeight(near.ax, near.az);
    const y1 = vertexTrailHeight(near.bx, near.bz);
    const ty = Math.max(lerp(y0, y1, near.t), 0.95);
    const w = smoothstep(4.6, 1.5, near.dist);
    h = lerp(h, ty, w);
    if (near.dist < 2.2) h = Math.max(h, 0.9);
  }

  if (z > 40 && mask > 0.4) {
    const shelf = 0.62 + smoothstep(70, 46, z) * 0.35;
    h = Math.max(h, shelf * smoothstep(0.4, 0.7, mask));
  }

  if (mask < 0.62) {
    const shore = mask / 0.62;
    const beach = lerp(-1.35, Math.min(h, 0.85), shore);
    h = lerp(beach, h, smoothstep(0.25, 0.62, mask));
  }
  if (mask < 0.08) h = Math.min(h, -1.15);
  return h;
}

export function sampleColor(x, z, h) {
  const hx = sampleHeight(x + 0.8, z) - sampleHeight(x - 0.8, z);
  const hz = sampleHeight(x, z + 0.8) - sampleHeight(x, z - 0.8);
  const slope = Math.hypot(hx, hz);

  const sand = [0.78, 0.64, 0.42];
  const grass = [0.33, 0.56, 0.24];
  const meadow = [0.72, 0.46, 0.18];
  const moss = [0.22, 0.42, 0.28];
  const rock = [0.48, 0.44, 0.4];
  const pink = [0.84, 0.4, 0.52];
  const path = [0.72, 0.6, 0.44];
  const soil = [0.45, 0.32, 0.2];

  const n = fbm(x * 0.07 + 3, z * 0.07);
  let c = grass.map((v, i) => lerp(v, meadow[i], smoothstep(0.42, 0.68, n)));
  if (n < 0.38) c = c.map((v, i) => lerp(v, moss[i], (0.38 - n) * 1.6));

  const blossom = fbm(x * 0.12 + 20, z * 0.12);
  if (blossom > 0.55 && h > 0.5 && h < 6.5) {
    const w = Math.min(1, (blossom - 0.55) * 2.4);
    c = c.map((v, i) => lerp(v, pink[i], w * 0.82));
  }

  if (h < 0.7) c = c.map((v, i) => lerp(sand[i], v, smoothstep(0.15, 0.7, h)));
  if (slope > 1.15) c = c.map((v, i) => lerp(v, rock[i], Math.min(1, (slope - 1.15) * 0.55)));
  if (h > 6.2) c = c.map((v, i) => lerp(v, rock[i], smoothstep(6.2, 9.2, h)));

  const garden = GARDENS.find((g) => Math.hypot(x - g.x, z - g.z) < g.r - 0.8);
  if (garden) {
    const fr = [(garden.floor >> 16 & 255) / 255, (garden.floor >> 8 & 255) / 255, (garden.floor & 255) / 255];
    c = c.map((v, i) => lerp(v, fr[i], 0.72));
  }

  const trail = closestTrail(x, z);
  if (trail && trail.dist < 2.4 && !garden) {
    const w = smoothstep(2.4, 0.3, trail.dist);
    c = c.map((v, i) => lerp(v, path[i], w * 0.88));
    c = c.map((v, i) => lerp(v, soil[i], (1 - w) * 0.05));
  }

  const speckle = valueNoise(x * 1.7, z * 1.7);
  const mul = 0.94 + speckle * 0.1;
  return c.map((v) => Math.min(1, Math.max(0, v * mul)));
}

export { fbm, valueNoise };
