// Line-drawing puzzle rules for Mirror Isle.
// A panel is a grid of cells. The line walks vertices (cols+1 by rows+1)
// along orthogonal edges and may not revisit a vertex.
//
// Rules (all original implementations of common panel-puzzle ideas):
//   dots     hex marks on edges; the line must cover every marked edge
//   squares  black/white cells; a region may contain only one color
//   stars    same-colored stars must lie in the same region
//   tetris   a polyomino symbol; its region must match that shape (rotation ok)
//   symmetry vertical mirror; the drawn line implies its mirror, and the two
//            lines may touch only on the center axis

export function edgeKey(x1, y1, x2, y2) {
  if (x1 > x2 || (x1 === x2 && y1 > y2)) {
    return `${x2},${y2},${x1},${y1}`;
  }
  return `${x1},${y1},${x2},${y2}`;
}

export function parseEdgeKey(key) {
  return key.split(',').map(Number);
}

function vertexKey(x, y) {
  return `${x},${y}`;
}

function isAdjacent(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
}

function inVertexBounds(x, y, cols, rows) {
  return x >= 0 && y >= 0 && x <= cols && y <= rows;
}

export function pathEdges(path) {
  const set = new Set();
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    set.add(edgeKey(a[0], a[1], b[0], b[1]));
  }
  return set;
}

function allEdgeList(cols, rows) {
  const edges = [];
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x < cols; x++) edges.push([x, y, x + 1, y]);
  }
  for (let x = 0; x <= cols; x++) {
    for (let y = 0; y < rows; y++) edges.push([x, y, x, y + 1]);
  }
  return edges;
}

function addPathEdges(set, path) {
  if (!path) return;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    set.add(edgeKey(a[0], a[1], b[0], b[1]));
  }
}

/**
 * Turn an authoring spec into a runtime puzzle.
 * layout: 'open' keeps spec.gaps (default none). 'maze' removes every edge
 * that is not on the solution, a decoy, or an extra spur.
 */
export function compilePuzzle(spec) {
  const dots = (spec.dots || []).map((e) => e.slice());
  const squares = (spec.squares || []).map((s) => ({ ...s }));
  const stars = (spec.stars || []).map((s) => ({ ...s }));
  const tetris = (spec.tetris || []).map((t) => ({
    ...t,
    shape: t.shape.map((c) => c.slice()),
  }));
  const decoys = (spec.decoys || []).map((d) => ({
    reason: d.reason,
    keep: d.keep !== false,
    path: d.path.map((p) => p.slice()),
  }));
  let gaps;
  if (spec.layout === 'maze') {
    const keep = new Set();
    addPathEdges(keep, spec.solution);
    // Decoys are alternate routes the player can walk, unless keep:false
    // (used when the decoy is supposed to step on a missing edge).
    for (const d of decoys) if (d.keep !== false) addPathEdges(keep, d.path);
    for (const e of spec.extra || []) keep.add(edgeKey(e[0], e[1], e[2], e[3]));
    gaps = [];
    for (const e of allEdgeList(spec.cols, spec.rows)) {
      const k = edgeKey(e[0], e[1], e[2], e[3]);
      if (!keep.has(k)) gaps.push(e);
    }
  } else {
    gaps = (spec.gaps || []).map((e) => e.slice());
  }
  return {
    id: spec.id,
    area: spec.area,
    name: spec.name,
    hint: spec.hint,
    cols: spec.cols,
    rows: spec.rows,
    start: spec.start.slice(),
    end: spec.end.slice(),
    dots,
    squares,
    stars,
    tetris,
    symmetry: spec.symmetry || null,
    gaps,
    solution: (spec.solution || []).map((p) => p.slice()),
    decoys,
    extra: (spec.extra || []).map((e) => e.slice()),
  };
}

function mirrorVertex(x, y, cols) {
  return [cols - x, y];
}

function mirrorEdgeKey(key, cols) {
  const [x1, y1, x2, y2] = parseEdgeKey(key);
  const a = mirrorVertex(x1, y1, cols);
  const b = mirrorVertex(x2, y2, cols);
  return edgeKey(a[0], a[1], b[0], b[1]);
}

export function normalizePuzzle(puzzle) {
  if (puzzle.symmetry !== 'v') return puzzle;
  const gaps = new Set(puzzle.gaps.map((e) => edgeKey(e[0], e[1], e[2], e[3])));
  const dots = new Set(puzzle.dots.map((e) => edgeKey(e[0], e[1], e[2], e[3])));
  for (const g of [...gaps]) gaps.add(mirrorEdgeKey(g, puzzle.cols));
  for (const d of [...dots]) dots.add(mirrorEdgeKey(d, puzzle.cols));
  return {
    ...puzzle,
    gaps: [...gaps].map(parseEdgeKey),
    dots: [...dots].map(parseEdgeKey),
  };
}

function checkWalk(puzzle, path) {
  if (!path || path.length === 0) return { ok: false, reason: 'empty' };
  const [sx, sy] = puzzle.start;
  const [ex, ey] = puzzle.end;
  if (path[0][0] !== sx || path[0][1] !== sy) return { ok: false, reason: 'start' };
  const seen = new Set();
  const gaps = new Set(puzzle.gaps.map((e) => edgeKey(e[0], e[1], e[2], e[3])));
  for (let i = 0; i < path.length; i++) {
    const [x, y] = path[i];
    if (!inVertexBounds(x, y, puzzle.cols, puzzle.rows)) return { ok: false, reason: 'bounds' };
    const k = vertexKey(x, y);
    if (seen.has(k)) return { ok: false, reason: 'revisit' };
    seen.add(k);
    if (i > 0) {
      const prev = path[i - 1];
      if (!isAdjacent(prev, path[i])) return { ok: false, reason: 'adjacent' };
      if (gaps.has(edgeKey(prev[0], prev[1], x, y))) return { ok: false, reason: 'gap' };
    }
  }
  const last = path[path.length - 1];
  if (last[0] !== ex || last[1] !== ey) return { ok: false, reason: 'end' };
  return { ok: true };
}

function symmetryOk(puzzle, path) {
  const seen = new Set(path.map(([x, y]) => vertexKey(x, y)));
  for (const [x, y] of path) {
    const mx = puzzle.cols - x;
    if (mx === x) continue;
    if (seen.has(vertexKey(mx, y))) return { ok: false, reason: 'symmetry' };
  }
  const gaps = new Set(puzzle.gaps.map((e) => edgeKey(e[0], e[1], e[2], e[3])));
  for (let i = 1; i < path.length; i++) {
    const a = mirrorVertex(path[i - 1][0], path[i - 1][1], puzzle.cols);
    const b = mirrorVertex(path[i][0], path[i][1], puzzle.cols);
    if (gaps.has(edgeKey(a[0], a[1], b[0], b[1]))) return { ok: false, reason: 'gap' };
  }
  return { ok: true };
}

export function buildRegions(cols, rows, edgeSet) {
  const total = cols * rows;
  const seen = new Uint8Array(total);
  const regions = [];
  const index = (x, y) => y * cols + x;
  const blocked = (x1, y1, x2, y2) => edgeSet.has(edgeKey(x1, y1, x2, y2));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (seen[index(x, y)]) continue;
      const stack = [[x, y]];
      const cells = [];
      seen[index(x, y)] = 1;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        cells.push([cx, cy]);
        const nbs = [
          [1, 0, cx + 1, cy, cx + 1, cy + 1],
          [-1, 0, cx, cy, cx, cy + 1],
          [0, 1, cx, cy + 1, cx + 1, cy + 1],
          [0, -1, cx, cy, cx + 1, cy],
        ];
        for (const item of nbs) {
          const nx = cx + item[0];
          const ny = cy + item[1];
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          if (seen[index(nx, ny)]) continue;
          if (blocked(item[2], item[3], item[4], item[5])) continue;
          seen[index(nx, ny)] = 1;
          stack.push([nx, ny]);
        }
      }
      regions.push(cells);
    }
  }
  return regions;
}

function regionIdAt(regions, x, y) {
  for (let i = 0; i < regions.length; i++) {
    for (const [cx, cy] of regions[i]) {
      if (cx === x && cy === y) return i;
    }
  }
  return -1;
}

function squaresOk(squares, regions) {
  for (const region of regions) {
    let color = null;
    for (const [x, y] of region) {
      const mark = squares.find((s) => s.x === x && s.y === y);
      if (!mark) continue;
      if (color && color !== mark.c) return false;
      color = mark.c;
    }
  }
  return true;
}

function starsOk(stars, regions) {
  const byColor = new Map();
  for (const star of stars) {
    const id = regionIdAt(regions, star.x, star.y);
    if (id < 0) return false;
    if (!byColor.has(star.c)) byColor.set(star.c, id);
    else if (byColor.get(star.c) !== id) return false;
  }
  return true;
}

function rot90(shape) {
  return shape.map(([x, y]) => [y, -x]);
}

function shapeKey(cells) {
  return cells
    .map(([x, y]) => `${x},${y}`)
    .sort()
    .join('|');
}

export function shapeMatches(regionCells, anchor, shape) {
  const rel = regionCells.map(([x, y]) => [x - anchor[0], y - anchor[1]]);
  const key = shapeKey(rel);
  let cur = shape.map((c) => c.slice());
  for (let i = 0; i < 4; i++) {
    if (shapeKey(cur) === key) return true;
    cur = rot90(cur);
  }
  return false;
}

function tetrisOk(pieces, regions) {
  for (const piece of pieces) {
    const id = regionIdAt(regions, piece.x, piece.y);
    if (id < 0) return false;
    if (!shapeMatches(regions[id], [piece.x, piece.y], piece.shape)) return false;
  }
  return true;
}

function dotsOk(dots, edgeSet) {
  for (const d of dots) {
    if (!edgeSet.has(edgeKey(d[0], d[1], d[2], d[3]))) return false;
  }
  return true;
}

/**
 * Validate a drawn path. `path` is the line the player controls.
 * Symmetry puzzles mirror it inside this function.
 */
export function validatePuzzle(puzzle, path) {
  const p = normalizePuzzle(puzzle);
  const walk = checkWalk(p, path);
  if (!walk.ok) return walk;
  let edges = pathEdges(path);
  if (p.symmetry === 'v') {
    const sym = symmetryOk(p, path);
    if (!sym.ok) return sym;
    for (let i = 1; i < path.length; i++) {
      const a = mirrorVertex(path[i - 1][0], path[i - 1][1], p.cols);
      const b = mirrorVertex(path[i][0], path[i][1], p.cols);
      edges.add(edgeKey(a[0], a[1], b[0], b[1]));
    }
  }
  if (p.dots.length && !dotsOk(p.dots, edges)) return { ok: false, reason: 'dot' };
  const needsRegions = p.squares.length || p.stars.length || p.tetris.length;
  if (!needsRegions) return { ok: true, reason: 'ok' };
  const regions = buildRegions(p.cols, p.rows, edges);
  if (p.squares.length && !squaresOk(p.squares, regions)) return { ok: false, reason: 'square' };
  if (p.stars.length && !starsOk(p.stars, regions)) return { ok: false, reason: 'star' };
  if (p.tetris.length && !tetrisOk(p.tetris, regions)) return { ok: false, reason: 'tetris' };
  return { ok: true, reason: 'ok' };
}

export function explain(puzzle, path) {
  const p = normalizePuzzle(puzzle);
  const result = validatePuzzle(puzzle, path);
  let edges = pathEdges(path || []);
  if (p.symmetry === 'v' && path) {
    for (let i = 1; i < path.length; i++) {
      const a = mirrorVertex(path[i - 1][0], path[i - 1][1], p.cols);
      const b = mirrorVertex(path[i][0], path[i][1], p.cols);
      edges.add(edgeKey(a[0], a[1], b[0], b[1]));
    }
  }
  const regions = path && path.length ? buildRegions(p.cols, p.rows, edges) : [];
  return { ...result, regions };
}
