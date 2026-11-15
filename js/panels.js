import * as THREE from 'three';
import { AREAS, PUZZLES } from './puzzles.js';
import { edgeKey, normalizePuzzle, validatePuzzle } from './validator.js';
import { GARDENS } from './layout.js';
import { areaCleared, areaUnlocked } from './progress.js';

const SIZE = 720;
const MARGIN = 0.1;
const STAR_COLORS = {
  red: '#d64545',
  blue: '#3a7bd5',
  gold: '#e2b43a',
  green: '#3aaa6a',
};

function vertToPx(x, y, cols, rows) {
  const m = SIZE * MARGIN;
  const inner = SIZE - m * 2;
  return [m + (x / cols) * inner, SIZE - (m + (y / rows) * inner)];
}

function hexPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function starPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function outward(cols, rows, end) {
  const [x, y] = end;
  if (x <= 0) return [-1, 0];
  if (x >= cols) return [1, 0];
  if (y <= 0) return [0, -1];
  if (y >= rows) return [0, 1];
  const dx = x - cols / 2;
  const dy = y - rows / 2;
  if (Math.abs(dx) >= Math.abs(dy)) return [Math.sign(dx) || 1, 0];
  return [0, Math.sign(dy) || 1];
}

function drawMiniShape(ctx, cx, cy, cell, shape, color) {
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  for (const [x, y] of shape) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const sw = maxX - minX + 1;
  const sh = maxY - minY + 1;
  const s = Math.min((cell * 0.46) / sw, (cell * 0.46) / sh);
  const ox = cx - (sw * s) / 2;
  const oy = cy - (sh * s) / 2;
  ctx.fillStyle = color;
  for (const [x, y] of shape) {
    const px = ox + (x - minX) * s;
    const py = oy + (maxY - y) * s;
    ctx.fillRect(px + 1.5, py + 1.5, s - 3, s - 3);
  }
}

function paintPanel(record) {
  const puzzle = record.view;
  const ctx = record.ctx;
  const { cols, rows } = puzzle;
  ctx.clearRect(0, 0, SIZE, SIZE);
  const grd = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  grd.addColorStop(0, '#f7f1e4');
  grd.addColorStop(1, '#efe4d0');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const seed = puzzle.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  ctx.fillStyle = 'rgba(80, 60, 30, 0.045)';
  for (let i = 0; i < 80; i++) {
    const n = (seed * 17 + i * 53) % 1000;
    ctx.fillRect((n * 13) % SIZE, (n * 29) % SIZE, 2, 2);
  }

  const gaps = new Set(puzzle.gaps.map((e) => edgeKey(e[0], e[1], e[2], e[3])));
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1c2428';
  ctx.lineWidth = 7;
  const strokeEdge = (x1, y1, x2, y2) => {
    const a = vertToPx(x1, y1, cols, rows);
    const b = vertToPx(x2, y2, cols, rows);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x < cols; x++) if (!gaps.has(edgeKey(x, y, x + 1, y))) strokeEdge(x, y, x + 1, y);
  }
  for (let x = 0; x <= cols; x++) {
    for (let y = 0; y < rows; y++) if (!gaps.has(edgeKey(x, y, x, y + 1))) strokeEdge(x, y, x, y + 1);
  }

  const cell = (SIZE * (1 - MARGIN * 2)) / Math.max(cols, rows);
  for (const sq of puzzle.squares) {
    const a = vertToPx(sq.x, sq.y, cols, rows);
    const b = vertToPx(sq.x + 1, sq.y + 1, cols, rows);
    const cx = (a[0] + b[0]) / 2;
    const cy = (a[1] + b[1]) / 2;
    const s = Math.abs(b[0] - a[0]) * 0.42;
    ctx.fillStyle = sq.c === 'b' ? '#1a1a1a' : '#fbfaf6';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    roundRect(ctx, cx - s / 2, cy - s / 2, s, s, 4);
    ctx.fill();
    ctx.stroke();
  }
  for (const star of puzzle.stars) {
    const a = vertToPx(star.x, star.y, cols, rows);
    const b = vertToPx(star.x + 1, star.y + 1, cols, rows);
    ctx.fillStyle = STAR_COLORS[star.c] || '#d64545';
    starPath(ctx, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) * 0.22);
    ctx.fill();
  }
  for (const piece of puzzle.tetris) {
    const a = vertToPx(piece.x, piece.y, cols, rows);
    const b = vertToPx(piece.x + 1, piece.y + 1, cols, rows);
    drawMiniShape(ctx, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]), piece.shape, piece.c || '#e07a3d');
  }
  for (const dot of puzzle.dots) {
    const a = vertToPx(dot[0], dot[1], cols, rows);
    const b = vertToPx(dot[2], dot[3], cols, rows);
    ctx.fillStyle = '#1c1c1c';
    hexPath(ctx, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.max(10, cell * 0.16));
    ctx.fill();
  }

  const s = vertToPx(puzzle.start[0], puzzle.start[1], cols, rows);
  ctx.fillStyle = '#1b1b1b';
  ctx.beginPath();
  ctx.arc(s[0], s[1], 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f4efe4';
  ctx.lineWidth = 3;
  ctx.stroke();

  const end = puzzle.end;
  const dir = outward(cols, rows, end);
  const e0 = vertToPx(end[0], end[1], cols, rows);
  const e1 = vertToPx(end[0] + dir[0] * 0.42, end[1] + dir[1] * 0.42, cols, rows);
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(e0[0], e0[1]);
  ctx.lineTo(e1[0], e1[1]);
  ctx.stroke();
  ctx.fillStyle = '#1b1b1b';
  ctx.beginPath();
  ctx.arc(e1[0], e1[1], 12, 0, Math.PI * 2);
  ctx.fill();

  const drawLine = (path, color, width, alpha) => {
    if (!path || path.length < 2) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    path.forEach(([x, y], i) => {
      const p = vertToPx(x, y, cols, rows);
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.stroke();
    ctx.restore();
  };

  if (puzzle.symmetry === 'v' && record.path.length > 1) {
    const mirror = record.path.map(([x, y]) => [cols - x, y]);
    drawLine(mirror, '#2f8f96', 18, 0.9);
  }

  let color = '#24312e';
  let alpha = 1;
  if (record.solved && record.flash <= 0) color = '#e0a23a';
  if (record.flash > 0) {
    color = '#d64545';
    alpha = 0.35 + record.flash * 0.65;
  }
  if (record.solved && record.flash <= 0) drawLine(record.path, 'rgba(255, 214, 140, 0.45)', 30, 1);
  drawLine(record.path, color, 16, alpha);

  if (!record.powered && !record.solved) {
    ctx.fillStyle = 'rgba(28, 32, 36, 0.28)';
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
  record.texture.needsUpdate = true;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bakeBox(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g.toNonIndexed();
}

function mergeParts(parts) {
  let count = 0;
  for (const g of parts) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  let o = 0;
  for (const g of parts) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const u = g.attributes.uv;
    pos.set(p.array, o * 3);
    nrm.set(n.array, o * 3);
    uv.set(u.array, o * 2);
    o += p.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function frameMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.62,
    metalness: 0.08,
    envMapIntensity: 0.35,
  });
}

export function createPanels(scene, doors, solids) {
  const solved = {};
  const records = [];
  const cables = [];
  let active = null;
  let drawing = false;
  const listeners = new Set();
  const frameMats = {};

  function emit(type, payload) {
    for (const fn of listeners) fn(type, payload);
  }

  function poses(garden, count) {
    const backX = Math.sin(garden.doorAngle);
    const backZ = Math.cos(garden.doorAngle);
    const tanX = Math.cos(garden.doorAngle);
    const tanZ = -Math.sin(garden.doorAngle);
    const inset = Math.min(garden.r - 4.4, 7.2);
    const out = [];
    const gap = count > 5 ? 2.45 : 2.7;
    for (let i = 0; i < count; i++) {
      const t = (i - (count - 1) / 2) * gap;
      out.push({
        x: garden.x - backX * inset + tanX * t,
        z: garden.z - backZ * inset + tanZ * t,
        y: garden.ground + 1.42,
        yaw: Math.atan2(backX, backZ),
      });
    }
    return out;
  }

  for (const area of AREAS) {
    const garden = GARDENS.find((g) => g.id === area.id);
    const list = PUZZLES.filter((p) => p.area === area.id);
    const spots = poses(garden, list.length);
    if (!frameMats[area.id]) frameMats[area.id] = frameMaterial(garden.accent);
    list.forEach((puzzle, index) => {
      const view = normalizePuzzle(puzzle);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SIZE;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      const faceMat = new THREE.MeshBasicMaterial({
        map: texture,
        toneMapped: true,
      });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 1.28), faceMat);
      face.position.z = 0.06;
      const stand = new THREE.Mesh(mergeParts([
        bakeBox(0.14, 1.55, 0.14, -0.52, -0.82, -0.08),
        bakeBox(0.14, 1.55, 0.14, 0.52, -0.82, -0.08),
        bakeBox(1.5, 1.5, 0.08, 0, 0, -0.04),
      ]), frameMats[area.id]);
      stand.castShadow = true;
      stand.receiveShadow = true;
      const group = new THREE.Group();
      group.add(stand);
      group.add(face);
      const pose = spots[index];
      group.position.set(pose.x, pose.y, pose.z);
      group.rotation.y = pose.yaw;
      scene.add(group);
      solids.push({ x: pose.x, z: pose.z, r: 0.46, tag: `panel-${puzzle.id}` });
      const record = {
        puzzle,
        view,
        group,
        face,
        canvas,
        ctx: canvas.getContext('2d'),
        texture,
        path: [],
        solved: false,
        flash: 0,
        failReason: '',
        powered: false,
        area: area.id,
        index,
      };
      face.userData.record = record;
      group.userData.record = record;
      records.push(record);
      paintPanel(record);
    });

    for (let i = 0; i < list.length - 1; i++) {
      cables.push(makeCable(scene, records[records.length - list.length + i], records[records.length - list.length + i + 1], list[i].id));
    }
    const last = records[records.length - 1];
    const door = doors[area.id];
    if (door) {
      const ix = garden.x - door.pivot.position.x;
      const iz = garden.z - door.pivot.position.z;
      const il = Math.hypot(ix, iz) || 1;
      const end = new THREE.Vector3(
        door.pivot.position.x + (ix / il) * 1.6,
        garden.ground + 1.35,
        door.pivot.position.z + (iz / il) * 1.6,
      );
      cables.push(makeCableTo(scene, last, end, `${area.id}-door`));
    }
  }

  function syncPower() {
    for (const area of AREAS) {
      const panels = records.filter((r) => r.area === area.id);
      const unlocked = areaUnlocked(solved, area.id);
      panels.forEach((rec, i) => {
        const prevOk = i === 0 || !!solved[panels[i - 1].puzzle.id];
        rec.powered = unlocked && prevOk;
        if (!rec.solved) paintPanel(rec);
      });
      const cleared = areaCleared(solved, area.id);
      if (doors[area.id]) {
        const open = area.id === 'dawn' || areaCleared(solved, AREAS[AREAS.findIndex((a) => a.id === area.id) - 1]?.id);
        if (area.id === 'dawn') doors.dawn.setOpen(true);
        else doors[area.id].setOpen(!!open);
      }
      void cleared;
    }
    for (const cable of cables) {
      const on = cable.kind === 'panel'
        ? !!solved[cable.fromId]
        : areaCleared(solved, cable.areaId);
      cable.goal = on ? 1.7 : 0;
    }
  }

  function markSolved(record, path) {
    record.solved = true;
    record.path = path.map((p) => p.slice());
    record.flash = 0;
    solved[record.puzzle.id] = record.path.map((p) => p.slice());
    paintPanel(record);
    syncPower();
    const areaIndex = AREAS.findIndex((a) => a.id === record.area);
    const cleared = areaCleared(solved, record.area);
    const finale = cleared && AREAS[areaIndex].finale && AREAS.every((a) => areaCleared(solved, a.id));
    emit('solved', { id: record.puzzle.id, area: record.area, cleared, finale, path: record.path });
  }

  function extend(record, grid, fromDown) {
    const puzzle = record.view;
    if (!record.path.length) {
      const d = Math.hypot(grid[0] - puzzle.start[0], grid[1] - puzzle.start[1]);
      if (d < 0.72 && fromDown) record.path.push(puzzle.start.slice());
      else return;
    }
    const gaps = new Set(puzzle.gaps.map((e) => edgeKey(e[0], e[1], e[2], e[3])));
    let guard = 0;
    while (guard++ < 8) {
      const head = record.path[record.path.length - 1];
      const next = bestNeighbor(head, grid, puzzle);
      if (!next) break;
      if (record.path.length >= 2 && next[0] === record.path[record.path.length - 2][0] && next[1] === record.path[record.path.length - 2][1]) {
        record.path.pop();
        emit('step', record);
        continue;
      }
      if (record.path.some(([x, y]) => x === next[0] && y === next[1])) break;
      if (gaps.has(edgeKey(head[0], head[1], next[0], next[1]))) break;
      if (puzzle.symmetry === 'v' && overlapsMirror(record.path, next, puzzle.cols)) break;
      record.path.push(next);
      emit('step', record);
      if (next[0] === puzzle.end[0] && next[1] === puzzle.end[1]) {
        const result = validatePuzzle(record.puzzle, record.path);
        if (result.ok) markSolved(record, record.path);
        else {
          record.flash = 1;
          record.failReason = result.reason;
          emit('fail', { id: record.puzzle.id, reason: result.reason });
        }
        drawing = false;
        break;
      }
    }
    paintPanel(record);
  }

  function ndcToGrid(ndc, record, camera) {
    _raycaster.setFromCamera(ndc, camera);
    const normal = _normal.set(0, 0, 1).applyQuaternion(record.group.quaternion);
    _plane.setFromNormalAndCoplanarPoint(normal, record.group.position);
    if (!_raycaster.ray.intersectPlane(_plane, _hit)) return null;
    record.group.updateWorldMatrix(true, false);
    const local = record.group.worldToLocal(_hit.clone());
    const u = local.x / 1.28 + 0.5;
    const v = local.y / 1.28 + 0.5;
    if (u < -0.15 || v < -0.15 || u > 1.15 || v > 1.15) return null;
    const gx = ((u - MARGIN) / (1 - 2 * MARGIN)) * record.view.cols;
    const gy = ((v - MARGIN) / (1 - 2 * MARGIN)) * record.view.rows;
    return [gx, gy];
  }

  const api = {
    records,
    solved,
    on(fn) { listeners.add(fn); },
    load(map) {
      for (const key of Object.keys(solved)) delete solved[key];
      for (const rec of records) {
        const saved = map && map[rec.puzzle.id];
        if (saved && Array.isArray(saved)) {
          rec.solved = true;
          rec.path = saved.map((p) => p.slice());
          solved[rec.puzzle.id] = rec.path.map((p) => p.slice());
        } else {
          rec.solved = false;
          rec.path = [];
        }
        rec.flash = 0;
      }
      syncPower();
      for (const rec of records) paintPanel(rec);
    },
    getSolved() {
      const out = {};
      for (const [id, path] of Object.entries(solved)) out[id] = path.map((p) => p.slice());
      return out;
    },
    pick(raycaster) {
      const hits = raycaster.intersectObjects(records.map((r) => r.face), false);
      if (!hits.length) return null;
      const record = hits[0].object.userData.record;
      return { record, dist: hits[0].distance };
    },
    usable(record) {
      if (!record) return false;
      if (!areaUnlocked(solved, record.area)) return 'locked';
      if (!record.powered && !record.solved) return 'prev';
      return 'ok';
    },
    open(record) {
      active = record;
      drawing = false;
      return record;
    },
    close() {
      if (active && active.solved && solved[active.puzzle.id]) {
        active.path = solved[active.puzzle.id].map((p) => p.slice());
        active.flash = 0;
        paintPanel(active);
      }
      drawing = false;
      active = null;
    },
    active: () => active,
    resetLine() {
      if (!active) return;
      active.path = [];
      active.flash = 0;
      paintPanel(active);
    },
    pointer(ndc, camera, type) {
      if (!active) return;
      if (type === 'down') drawing = true;
      if (type === 'up') drawing = false;
      if (!drawing && type !== 'down') return;
      const grid = ndcToGrid(ndc, active, camera);
      if (!grid) return;
      if (active.flash > 0) return;
      extend(active, grid, type === 'down' || drawing);
    },
    cameraGoal() {
      if (!active) return null;
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(active.group.quaternion);
      const position = active.group.position.clone().add(normal.multiplyScalar(2.35));
      position.y += 0.02;
      const target = active.group.position.clone();
      return { position, target };
    },
    update(dt) {
      for (const rec of records) {
        if (rec.flash > 0) {
          rec.flash = Math.max(0, rec.flash - dt * 1.35);
          paintPanel(rec);
          if (rec.flash === 0) {
            if (rec.solved && solved[rec.puzzle.id]) rec.path = solved[rec.puzzle.id].map((p) => p.slice());
            else rec.path = [];
            paintPanel(rec);
          }
        }
      }
      for (const cable of cables) {
        cable.mat.emissiveIntensity += (cable.goal - cable.mat.emissiveIntensity) * Math.min(1, dt * 3);
      }
      for (const door of Object.values(doors)) door.update(dt);
    },
    solveActive() {
      if (!active) return false;
      const result = validatePuzzle(active.puzzle, active.puzzle.solution);
      if (!result.ok) return false;
      markSolved(active, active.puzzle.solution);
      return true;
    },
  };

  api.load({});
  return api;
}

function bestNeighbor(head, grid, puzzle) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let best = null;
  let score = 0.4;
  for (const [dx, dy] of dirs) {
    const nx = head[0] + dx;
    const ny = head[1] + dy;
    if (nx < 0 || ny < 0 || nx > puzzle.cols || ny > puzzle.rows) continue;
    const proj = (grid[0] - head[0]) * dx + (grid[1] - head[1]) * dy;
    if (proj > score) {
      score = proj;
      best = [nx, ny];
    }
  }
  return best;
}

function overlapsMirror(path, next, cols) {
  const seen = new Set(path.map(([x, y]) => `${x},${y}`));
  seen.add(`${next[0]},${next[1]}`);
  for (const key of seen) {
    const [x, y] = key.split(',').map(Number);
    const mx = cols - x;
    if (mx === x) continue;
    if (seen.has(`${mx},${y}`)) return true;
  }
  return false;
}

function makeCable(scene, a, b, fromId) {
  const start = a.group.position.clone();
  start.y += 0.62;
  const end = b.group.position.clone();
  end.y += 0.62;
  return spawnCable(scene, start, end, { kind: 'panel', fromId, areaId: a.area });
}

function makeCableTo(scene, a, end, id) {
  const start = a.group.position.clone();
  start.y += 0.62;
  return spawnCable(scene, start, end, { kind: 'door', fromId: id, areaId: a.area });
}

function spawnCable(scene, start, end, meta) {
  const mid = start.clone().lerp(end, 0.5);
  mid.y -= 0.22 + start.distanceTo(end) * 0.04;
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  const geo = new THREE.TubeGeometry(curve, 20, 0.032, 5, false);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x243036,
    roughness: 0.42,
    metalness: 0.62,
    emissive: new THREE.Color(0x8ef0d2),
    emissiveIntensity: 0,
    envMapIntensity: 0.5,
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return { mesh, mat, goal: 0, ...meta };
}

const _raycaster = new THREE.Raycaster();
const _plane = new THREE.Plane();
const _hit = new THREE.Vector3();
const _normal = new THREE.Vector3();
