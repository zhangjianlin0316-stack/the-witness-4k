import assert from 'node:assert/strict';
import { validatePuzzle, explain, shapeMatches, buildRegions, pathEdges } from '../js/validator.js';
import { PUZZLES, AREAS } from '../js/puzzles.js';
import { areaUnlocked, areaCleared, allCleared, solvedCount } from '../js/progress.js';

let passed = 0;
function check(cond, msg) {
  assert.equal(cond, true, msg);
  passed++;
}

// --- shape rotation ---
check(shapeMatches([[0, 0], [1, 0]], [0, 0], [[0, 0], [1, 0]]), 'domino identity');
check(shapeMatches([[0, 0], [0, 1]], [0, 0], [[0, 0], [1, 0]]), 'domino rotated');
check(!shapeMatches([[0, 0], [1, 0], [2, 0]], [0, 0], [[0, 0], [1, 0]]), 'domino rejects extra');
check(!shapeMatches([[0, 0]], [0, 0], [[0, 0], [1, 0]]), 'domino rejects short');

// --- region cut ---
{
  const edges = pathEdges([[0, 0], [1, 0], [1, 1], [1, 2], [1, 3]]);
  const regions = buildRegions(3, 3, edges);
  check(regions.length === 2, 'vertical cut makes 2 regions');
}

// --- hand-built rule cases ---
const base = {
  id: 't', area: 'dawn', cols: 3, rows: 3, start: [0, 0], end: [3, 3],
  dots: [], squares: [], stars: [], tetris: [], symmetry: null, gaps: [],
};
{
  const ok = validatePuzzle(base, [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]]);
  check(ok.ok, 'plain path ok');
  const badAdj = validatePuzzle(base, [[0, 0], [2, 0], [3, 0], [3, 3]]);
  check(badAdj.reason === 'adjacent', 'diagonal rejected');
  const revisit = validatePuzzle(base, [[0, 0], [1, 0], [1, 1], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]]);
  check(revisit.reason === 'revisit', 'revisit rejected');
  const gapped = validatePuzzle(
    { ...base, gaps: [[3, 0, 3, 1]] },
    [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]],
  );
  check(gapped.reason === 'gap', 'gap rejected');
}

{
  const dots = { ...base, dots: [[1, 1, 2, 1]] };
  const hit = validatePuzzle(dots, [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [3, 2], [3, 3]]);
  check(hit.ok, 'dot collected');
  const miss = validatePuzzle(dots, [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]]);
  check(miss.reason === 'dot', 'dot missed');
}

{
  const squares = {
    ...base, cols: 2, rows: 2, end: [2, 2],
    squares: [{ x: 0, y: 0, c: 'b' }, { x: 1, y: 0, c: 'w' }],
  };
  const sep = validatePuzzle(squares, [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]]);
  check(sep.ok, 'squares separated');
  const same = validatePuzzle(squares, [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]]);
  check(same.reason === 'square', 'squares mixed');
  const together = validatePuzzle(squares, [[0, 0], [1, 0], [1, 1], [0, 1], [0, 2], [1, 2], [2, 2]]);
  // that path revisits? (0,0)-(1,0)-(1,1)-(0,1)-(0,2)-(1,2)-(2,2) no revisit. It cuts between blacks?
  // Not the assertion we need. Same-color pair:
  const mono = {
    ...squares,
    squares: [{ x: 0, y: 0, c: 'b' }, { x: 0, y: 1, c: 'b' }, { x: 1, y: 0, c: 'w' }],
  };
  const monoOk = validatePuzzle(mono, [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]]);
  check(monoOk.ok, 'same color may share a region');
  void together;
}

{
  const stars = {
    ...base,
    stars: [{ x: 0, y: 0, c: 'red' }, { x: 0, y: 2, c: 'red' }, { x: 2, y: 0, c: 'blue' }, { x: 2, y: 2, c: 'blue' }],
  };
  const keep = validatePuzzle(stars, [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]]);
  check(keep.ok, 'border keeps star pairs');
  const split = validatePuzzle(stars, [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [1, 2], [1, 1], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]]);
  // vertical-ish line at x=1 full height separates col0. Reds are both in col 0? (0,0) and (0,2) yes same side.
  // Use a horizontal split between the two reds instead.
  const splitRed = validatePuzzle(stars, [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [2, 1], [1, 1], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3]]);
  check(splitRed.reason === 'star' || splitRed.reason === 'revisit' || !splitRed.ok, 'star split is not accepted');
  if (splitRed.ok) check(false, 'horizontal wall should split reds at (0,0)/(0,2)');
  void split;
}

{
  const sym = {
    ...base, cols: 4, rows: 3, end: [0, 3], symmetry: 'v',
  };
  const left = validatePuzzle(sym, [[0, 0], [0, 1], [0, 2], [0, 3]]);
  check(left.ok, 'symmetry left shore');
  const cross = validatePuzzle(sym, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2], [4, 3], [3, 3], [2, 3], [1, 3], [0, 3]]);
  check(cross.reason === 'symmetry', 'crossing mirror overlaps');
}

// --- every authored panel ---
check(PUZZLES.length >= 30, `puzzle count ${PUZZLES.length}`);
check(AREAS.length >= 5, 'area count');
check(AREAS.some((a) => a.finale), 'finale area');
const ids = new Set();
const ruleHits = { dots: 0, squares: 0, stars: 0, tetris: 0, symmetry: 0, maze: 0 };
for (const puzzle of PUZZLES) {
  check(!ids.has(puzzle.id), `unique ${puzzle.id}`);
  ids.add(puzzle.id);
  if (puzzle.dots.length) ruleHits.dots++;
  if (puzzle.squares.length) ruleHits.squares++;
  if (puzzle.stars.length) ruleHits.stars++;
  if (puzzle.tetris.length) ruleHits.tetris++;
  if (puzzle.symmetry) ruleHits.symmetry++;
  if (puzzle.gaps.length) ruleHits.maze++;

  for (const s of puzzle.squares) {
    check(s.x >= 0 && s.y >= 0 && s.x < puzzle.cols && s.y < puzzle.rows, `${puzzle.id} square bounds`);
  }
  for (const s of puzzle.stars) {
    check(s.x >= 0 && s.y >= 0 && s.x < puzzle.cols && s.y < puzzle.rows, `${puzzle.id} star bounds`);
  }
  for (const t of puzzle.tetris) {
    check(t.shape.some(([x, y]) => x === 0 && y === 0), `${puzzle.id} tetris anchor`);
  }

  const result = validatePuzzle(puzzle, puzzle.solution);
  if (!result.ok) {
    const info = explain(puzzle, puzzle.solution);
    console.error('SOLUTION FAIL', puzzle.id, result.reason, JSON.stringify(info.regions));
  }
  check(result.ok, `${puzzle.id} solution (${result.reason})`);

  for (const decoy of puzzle.decoys) {
    const d = validatePuzzle(puzzle, decoy.path);
    if (d.ok || d.reason !== decoy.reason) {
      const info = explain(puzzle, decoy.path);
      console.error('DECOY FAIL', puzzle.id, 'expected', decoy.reason, 'got', d.reason, JSON.stringify(info.regions));
    }
    check(!d.ok && d.reason === decoy.reason, `${puzzle.id} decoy ${decoy.reason} (got ${d.reason})`);
  }
}
for (const [rule, n] of Object.entries(ruleHits)) {
  check(n >= 2, `${rule} puzzles: ${n}`);
}

// broken mutations of the first real solution
{
  const p = PUZZLES[0];
  const trunc = p.solution.slice(0, -1);
  check(validatePuzzle(p, trunc).reason === 'end', 'truncated solution');
  const shifted = p.solution.map(([x, y]) => [x + 1, y]);
  check(!validatePuzzle(p, shifted).ok, 'shifted solution rejected');
}

// progress gating
{
  const prog = {};
  check(areaUnlocked(prog, 'dawn'), 'dawn open');
  check(!areaUnlocked(prog, 'orchard'), 'orchard locked');
  for (const id of AREAS[0].panels) prog[id] = [[0, 0]];
  check(areaCleared(prog, 'dawn'), 'dawn cleared');
  check(areaUnlocked(prog, 'orchard'), 'orchard unlocks');
  check(!areaUnlocked(prog, 'ink'), 'ink still locked');
  check(solvedCount(prog) === 5, 'solved count');
  check(!allCleared(prog), 'not done');
}

console.log(`ok ${passed} assertions, ${PUZZLES.length} puzzles, ${AREAS.length} areas`);
