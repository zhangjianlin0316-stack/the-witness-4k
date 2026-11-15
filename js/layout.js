// Island plan. +Z is south, -Z is north. Gardens are walled clearings;
// doors sit on the circle, snapped from the authored approach point.

export const GARDENS = [
  { id: 'dawn', x: 0, z: 32, r: 11.6, ground: 1.62, door: [0, 48], wall: 0xd9c7a6, floor: 0xe6d5b2, accent: 0x8a5a32, dress: 'dawn' },
  { id: 'orchard', x: 34, z: 20, r: 12.2, ground: 2.2, door: [20, 28], wall: 0xcbb892, floor: 0xc5d392, accent: 0x3d6a42, dress: 'orchard' },
  { id: 'ink', x: 38, z: -12, r: 12.0, ground: 2.45, door: [24, -4], wall: 0x3a3a3a, floor: 0xe7e3db, accent: 0x161616, dress: 'ink' },
  { id: 'mason', x: -36, z: 6, r: 12.2, ground: 2.55, door: [-22, 12], wall: 0xc2ae93, floor: 0xddcfb8, accent: 0x8a7058, dress: 'mason' },
  { id: 'star', x: -10, z: -28, r: 12.0, ground: 4.55, door: [-6, -14], wall: 0x3c4a66, floor: 0x243244, accent: 0xe2b43a, dress: 'star' },
  { id: 'mirror', x: 24, z: -34, r: 12.0, ground: 3.35, door: [10, -26], wall: 0xd5d8df, floor: 0xd5e0ea, accent: 0x9aa3ad, dress: 'mirror' },
  { id: 'light', x: 0, z: -52, r: 10.6, ground: 5.85, door: [0, -40], wall: 0xf3ead6, floor: 0xf1e2c6, accent: 0xb08d4a, dress: 'light' },
];

export const TRAILS = [
  [[0, 66], [0, 56], [0, 46], [0, 32]],
  [[0, 32], [10, 30], [20, 28], [34, 20]],
  [[34, 20], [38, 6], [38, -12]],
  [[38, -12], [24, -4], [8, -2], [-8, 4], [-22, 12], [-36, 6]],
  [[-36, 6], [-28, -6], [-16, -14], [-10, -28]],
  [[-10, -28], [2, -24], [10, -26], [24, -34]],
  [[24, -34], [14, -42], [0, -40], [0, -52]],
  [[0, 48], [-16, 40], [-28, 34], [-40, 30]],
];

export const SPAWN = { x: 0.4, z: 54.5, yaw: 0, pitch: -0.06 };
export const WINDMILL = { x: -40, z: 30 };
export const ISLAND_RX = 62;
export const ISLAND_RZ = 70;

for (const g of GARDENS) {
  const dx = g.door[0] - g.x;
  const dz = g.door[1] - g.z;
  const len = Math.hypot(dx, dz) || 1;
  g.doorAngle = Math.atan2(dx, dz);
  g.doorX = g.x + (dx / len) * g.r;
  g.doorZ = g.z + (dz / len) * g.r;
}

export function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0 || 1)));
  return t * t * (3 - 2 * t);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function gardenAt(x, z, pad = 0) {
  let best = null;
  let bestD = Infinity;
  for (const g of GARDENS) {
    const d = Math.hypot(x - g.x, z - g.z);
    if (d < g.r + pad && d < bestD) {
      best = g;
      bestD = d;
    }
  }
  return best;
}

export function closestTrail(x, z) {
  let best = null;
  for (const trail of TRAILS) {
    for (let i = 1; i < trail.length; i++) {
      const ax = trail[i - 1][0];
      const az = trail[i - 1][1];
      const bx = trail[i][0];
      const bz = trail[i][1];
      const abx = bx - ax;
      const abz = bz - az;
      const len2 = abx * abx + abz * abz || 1;
      let t = ((x - ax) * abx + (z - az) * abz) / len2;
      t = Math.min(1, Math.max(0, t));
      const px = ax + abx * t;
      const pz = az + abz * t;
      const dist = Math.hypot(x - px, z - pz);
      if (!best || dist < best.dist) best = { dist, x: px, z: pz, ax, az, bx, bz, t };
    }
  }
  return best;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
