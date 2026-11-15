import { compilePuzzle } from './validator.js';

// Authored panels. `solution` / `decoys` are for tests and are never shown in play.
// layout 'maze' deletes every edge except the solution, decoys, and extra spurs.

const RAW = [
  // ——— 晨曦庭院：把线从圆点画到出口 ———
  {
    id: 'dawn-1', area: 'dawn', hint: 'draw', layout: 'open',
    name: { zh: '起笔', en: 'First Stroke' },
    cols: 2, rows: 2, start: [0, 0], end: [2, 2],
    solution: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],
    decoys: [{ reason: 'end', path: [[0, 0], [1, 0], [2, 0], [2, 1]] }],
  },
  {
    id: 'dawn-2', area: 'dawn', hint: 'back', layout: 'open',
    name: { zh: '折返', en: 'Turn Back' },
    cols: 3, rows: 3, start: [0, 3], end: [3, 0],
    solution: [[0, 3], [0, 2], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0]],
    decoys: [{ reason: 'revisit', path: [[0, 3], [0, 2], [0, 1], [0, 2]] }],
  },
  {
    id: 'dawn-3', area: 'dawn', hint: 'maze', layout: 'maze',
    name: { zh: '缺口', en: 'The Gap' },
    cols: 3, rows: 3, start: [0, 0], end: [3, 3],
    solution: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [2, 3], [3, 3]],
    extra: [[1, 0, 1, 1], [2, 2, 3, 2]],
    decoys: [{ reason: 'gap', keep: false, path: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3]] }],
  },
  {
    id: 'dawn-4', area: 'dawn', hint: 'maze', layout: 'maze',
    name: { zh: '回廊', en: 'Gallery' },
    cols: 4, rows: 4, start: [0, 0], end: [4, 4],
    solution: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2],
      [3, 2], [2, 2], [1, 2], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4],
    ],
    extra: [[2, 0, 2, 1], [1, 2, 1, 3]],
  },
  {
    id: 'dawn-5', area: 'dawn', hint: 'maze', layout: 'maze',
    name: { zh: '长廊', en: 'Long Gallery' },
    cols: 4, rows: 4, start: [0, 4], end: [4, 4],
    solution: [
      [0, 4], [1, 4], [1, 3], [1, 2], [1, 1], [1, 0], [2, 0],
      [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [4, 4],
    ],
    extra: [[1, 2, 2, 2], [3, 2, 4, 2], [2, 0, 2, 1]],
  },

  // ——— 秋果园：六角点必须被线经过 ———
  {
    id: 'orch-1', area: 'orchard', hint: 'dots', layout: 'open',
    name: { zh: '一枚青点', en: 'One Mark' },
    cols: 3, rows: 3, start: [0, 0], end: [3, 3],
    dots: [[1, 1, 2, 1]],
    solution: [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [3, 2], [3, 3]],
    decoys: [{ reason: 'dot', path: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]] }],
  },
  {
    id: 'orch-2', area: 'orchard', hint: 'dots', layout: 'open',
    name: { zh: '两枚', en: 'Two Marks' },
    cols: 3, rows: 3, start: [0, 3], end: [3, 0],
    dots: [[0, 1, 1, 1], [2, 2, 3, 2]],
    solution: [[0, 3], [0, 2], [0, 1], [1, 1], [1, 2], [2, 2], [3, 2], [3, 1], [3, 0]],
    decoys: [{ reason: 'dot', path: [[0, 3], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1], [3, 0]] }],
  },
  {
    id: 'orch-3', area: 'orchard', hint: 'dots', layout: 'open',
    name: { zh: '三点成线', en: 'Three Marks' },
    cols: 4, rows: 4, start: [0, 0], end: [4, 4],
    dots: [[1, 0, 2, 0], [2, 1, 2, 2], [3, 3, 4, 3]],
    solution: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
    decoys: [{ reason: 'dot', path: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]] }],
  },
  {
    id: 'orch-4', area: 'orchard', hint: 'dots', layout: 'maze',
    name: { zh: '岔路', en: 'Fork' },
    cols: 3, rows: 3, start: [0, 0], end: [3, 3],
    dots: [[0, 1, 0, 2]],
    solution: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3]],
    decoys: [{ reason: 'dot', path: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]] }],
  },
  {
    id: 'orch-5', area: 'orchard', hint: 'dots', layout: 'maze',
    name: { zh: '果径', en: 'Orchard Path' },
    cols: 4, rows: 4, start: [0, 0], end: [4, 4],
    dots: [[0, 1, 0, 2], [1, 2, 2, 2], [2, 3, 2, 4]],
    solution: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 3], [2, 4], [3, 4], [4, 4]],
    decoys: [{ reason: 'dot', path: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]] }],
  },

  // ——— 墨白园：同一区域不能同时有黑与白 ———
  {
    id: 'ink-1', area: 'ink', hint: 'squares', layout: 'open',
    name: { zh: '黑与白', en: 'Black and White' },
    cols: 2, rows: 2, start: [0, 0], end: [2, 2],
    squares: [{ x: 0, y: 0, c: 'b' }, { x: 1, y: 0, c: 'w' }],
    solution: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]],
    decoys: [{ reason: 'square', path: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]] }],
  },
  {
    id: 'ink-2', area: 'ink', hint: 'squares', layout: 'open',
    name: { zh: '横截', en: 'Across' },
    cols: 3, rows: 3, start: [0, 0], end: [3, 3],
    squares: [{ x: 1, y: 0, c: 'b' }, { x: 1, y: 2, c: 'w' }],
    solution: [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [3, 2], [3, 3]],
    decoys: [{ reason: 'square', path: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]] }],
  },
  {
    id: 'ink-3', area: 'ink', hint: 'squares', layout: 'open',
    name: { zh: '同色可聚', en: 'Like with Like' },
    cols: 3, rows: 3, start: [0, 0], end: [3, 3],
    squares: [
      { x: 0, y: 0, c: 'b' }, { x: 0, y: 2, c: 'b' },
      { x: 1, y: 1, c: 'w' }, { x: 2, y: 2, c: 'w' },
    ],
    solution: [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3]],
    decoys: [{ reason: 'square', path: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3]] }],
  },
  {
    id: 'ink-4', area: 'ink', hint: 'squares', layout: 'open',
    name: { zh: '台阶', en: 'Steps' },
    cols: 4, rows: 4, start: [0, 0], end: [4, 4],
    squares: [
      { x: 0, y: 0, c: 'w' }, { x: 0, y: 3, c: 'w' },
      { x: 1, y: 0, c: 'b' }, { x: 3, y: 0, c: 'b' },
    ],
    solution: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
    decoys: [{ reason: 'square', path: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]] }],
  },
  {
    id: 'ink-5', area: 'ink', hint: 'squares', layout: 'maze',
    name: { zh: '墨径', en: 'Ink Corridor' },
    cols: 3, rows: 3, start: [0, 0], end: [3, 3],
    squares: [{ x: 1, y: 0, c: 'b' }, { x: 0, y: 2, c: 'w' }, { x: 2, y: 2, c: 'w' }],
    solution: [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [3, 2], [3, 3]],
    extra: [[1, 1, 1, 2]],
    decoys: [{ reason: 'gap', keep: false, path: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]] }],
  },
  {
    id: 'ink-6', area: 'ink', hint: 'combo', layout: 'open',
    name: { zh: '点与色', en: 'Mark and Tone' },
    cols: 3, rows: 3, start: [0, 0], end: [3, 3],
    dots: [[1, 1, 2, 1]],
    squares: [{ x: 1, y: 0, c: 'b' }, { x: 1, y: 2, c: 'w' }],
    solution: [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [3, 2], [3, 3]],
    decoys: [{ reason: 'dot', path: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]] }],
  },

  // ——— 星桥：同色星必须在同一区域 ———
  {
    id: 'star-1', area: 'star', hint: 'stars', layout: 'maze',
    name: { zh: '一对红星', en: 'A Red Pair' },
    cols: 3, rows: 3, start: [0, 0], end: [3, 3],
    stars: [{ x: 0, y: 1, c: 'red' }, { x: 0, y: 2, c: 'red' }],
    solution: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]],
    decoys: [{ reason: 'star', path: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [3, 2], [3, 3]] }],
  },
  {
    id: 'star-2', area: 'star', hint: 'stars', layout: 'maze',
    name: { zh: '双色', en: 'Two Colors' },
    cols: 4, rows: 4, start: [0, 0], end: [4, 4],
    stars: [
      { x: 1, y: 1, c: 'red' }, { x: 1, y: 2, c: 'red' },
      { x: 0, y: 3, c: 'blue' }, { x: 1, y: 3, c: 'blue' },
    ],
    solution: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]],
    decoys: [
      { reason: 'star', path: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [4, 3], [4, 4]] },
      { reason: 'star', path: [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4]] },
    ],
  },
  {
    id: 'star-3', area: 'star', hint: 'stars', layout: 'maze',
    name: { zh: '三对', en: 'Three Pairs' },
    cols: 4, rows: 4, start: [0, 4], end: [4, 0],
    stars: [
      { x: 0, y: 0, c: 'red' }, { x: 0, y: 1, c: 'red' },
      { x: 3, y: 0, c: 'blue' }, { x: 3, y: 1, c: 'blue' },
      { x: 1, y: 0, c: 'gold' }, { x: 1, y: 3, c: 'gold' },
    ],
    solution: [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [4, 0]],
    decoys: [
      { reason: 'star', path: [[0, 4], [0, 3], [0, 2], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [4, 0]] },
    ],
  },
  {
    id: 'star-4', area: 'star', hint: 'stars', layout: 'open',
    name: { zh: '绕行', en: 'The Long Way' },
    cols: 3, rows: 3, start: [0, 3], end: [3, 0],
    stars: [{ x: 0, y: 0, c: 'gold' }, { x: 2, y: 0, c: 'gold' }, { x: 0, y: 2, c: 'blue' }, { x: 1, y: 2, c: 'blue' }],
    solution: [[0, 3], [0, 2], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0]],
    decoys: [{ reason: 'star', path: [[0, 3], [1, 3], [1, 2], [1, 1], [1, 0], [2, 0], [3, 0]] }],
  },
  {
    id: 'star-5', area: 'star', hint: 'combo', layout: 'open',
    name: { zh: '星与墨', en: 'Stars and Ink' },
    cols: 3, rows: 3, start: [0, 0], end: [3, 3],
    stars: [{ x: 1, y: 2, c: 'red' }, { x: 2, y: 2, c: 'red' }],
    squares: [{ x: 0, y: 0, c: 'b' }, { x: 2, y: 0, c: 'w' }],
    solution: [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3]],
    decoys: [
      { reason: 'square', path: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3]] },
      { reason: 'star', path: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [2, 3], [3, 3]] },
    ],
  },

  // ——— 石坊：区域形状须与方块符号一致（可旋转） ———
  {
    id: 'mason-1', area: 'mason', hint: 'tetris', layout: 'open',
    name: { zh: '两格', en: 'Domino' },
    cols: 3, rows: 3, start: [0, 3], end: [3, 0],
    tetris: [{ x: 0, y: 0, c: '#e07a3d', shape: [[0, 0], [1, 0]] }],
    solution: [[0, 3], [0, 2], [0, 1], [1, 1], [2, 1], [2, 0], [3, 0]],
    decoys: [{ reason: 'tetris', path: [[0, 3], [0, 2], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0]] }],
  },
  {
    id: 'mason-2', area: 'mason', hint: 'tetris', layout: 'open',
    name: { zh: '折尺', en: 'The L' },
    cols: 3, rows: 3, start: [2, 0], end: [0, 3],
    tetris: [{ x: 0, y: 0, c: '#3a7bd5', shape: [[0, 0], [1, 0], [0, 1]] }],
    solution: [[2, 0], [2, 1], [1, 1], [1, 2], [0, 2], [0, 3]],
  },
  {
    id: 'mason-3', area: 'mason', hint: 'tetris', layout: 'open',
    name: { zh: '丁字', en: 'The T' },
    cols: 3, rows: 3, start: [0, 1], end: [0, 2],
    tetris: [{ x: 1, y: 1, c: '#d64545', shape: [[0, 0], [-1, 0], [1, 0], [0, 1]] }],
    solution: [[0, 1], [1, 1], [2, 1], [3, 1], [3, 2], [2, 2], [2, 3], [1, 3], [1, 2], [0, 2]],
  },
  {
    id: 'mason-4', area: 'mason', hint: 'tetris', layout: 'open',
    name: { zh: '两块', en: 'Two Stones' },
    cols: 4, rows: 4, start: [0, 1], end: [2, 4],
    tetris: [
      { x: 0, y: 0, c: '#e07a3d', shape: [[0, 0], [1, 0]] },
      { x: 2, y: 2, c: '#3a7bd5', shape: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    ],
    solution: [
      [0, 1], [1, 1], [2, 1], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2],
      [3, 2], [2, 2], [2, 3], [2, 4],
    ],
  },
  {
    id: 'mason-5', area: 'mason', hint: 'tetris', layout: 'open',
    name: { zh: '方阵', en: 'Square Stone' },
    cols: 3, rows: 2, start: [3, 0], end: [3, 2],
    tetris: [{ x: 0, y: 0, c: '#8d5cc7', shape: [[0, 0], [1, 0], [0, 1], [1, 1]] }],
    solution: [[3, 0], [2, 0], [2, 1], [2, 2], [3, 2]],
    decoys: [{ reason: 'tetris', path: [[3, 0], [3, 1], [3, 2]] }],
  },

  // ——— 镜回廊：画出一侧，另一侧镜像 ———
  {
    id: 'mirror-1', area: 'mirror', hint: 'symmetry', layout: 'open', symmetry: 'v',
    name: { zh: '对岸', en: 'The Other Shore' },
    cols: 4, rows: 3, start: [0, 0], end: [0, 3],
    solution: [[0, 0], [0, 1], [0, 2], [0, 3]],
    decoys: [{
      reason: 'symmetry',
      path: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2], [4, 3], [3, 3], [2, 3], [1, 3], [0, 3]],
    }],
  },
  {
    id: 'mirror-2', area: 'mirror', hint: 'symmetry', layout: 'open', symmetry: 'v',
    name: { zh: '断岸', en: 'Broken Shore' },
    cols: 4, rows: 3, start: [0, 0], end: [0, 3],
    gaps: [[0, 0, 0, 1], [0, 1, 0, 2], [0, 2, 0, 3], [4, 0, 4, 1], [4, 1, 4, 2], [4, 2, 4, 3]],
    solution: [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [0, 3]],
    decoys: [{ reason: 'gap', path: [[0, 0], [0, 1], [0, 2], [0, 3]] }],
  },
  {
    id: 'mirror-3', area: 'mirror', hint: 'combo', layout: 'open', symmetry: 'v',
    name: { zh: '对称的点', en: 'Mirrored Marks' },
    cols: 4, rows: 3, start: [0, 0], end: [0, 3],
    dots: [[1, 0, 1, 1], [1, 1, 1, 2]],
    solution: [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [0, 3]],
    decoys: [{ reason: 'dot', path: [[0, 0], [0, 1], [0, 2], [0, 3]] }],
  },
  {
    id: 'mirror-4', area: 'mirror', hint: 'combo', layout: 'open', symmetry: 'v',
    name: { zh: '左右分色', en: 'Split Tones' },
    cols: 4, rows: 4, start: [0, 0], end: [1, 4],
    squares: [{ x: 0, y: 0, c: 'b' }, { x: 0, y: 2, c: 'b' }, { x: 2, y: 1, c: 'w' }, { x: 1, y: 3, c: 'w' }],
    solution: [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4]],
    decoys: [{ reason: 'square', path: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4]] }],
  },
  {
    id: 'mirror-5', area: 'mirror', hint: 'combo', layout: 'open', symmetry: 'v',
    name: { zh: '镜中廊', en: 'Cloister' },
    cols: 6, rows: 4, start: [0, 0], end: [2, 4],
    dots: [[2, 1, 2, 2]],
    squares: [{ x: 0, y: 1, c: 'b' }, { x: 3, y: 1, c: 'w' }],
    solution: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]],
    decoys: [{ reason: 'dot', path: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4]] }],
  },

  // ——— 灯塔：规则混用，最后一块点亮灯 ———
  {
    id: 'light-1', area: 'light', hint: 'combo', layout: 'open',
    name: { zh: '缆', en: 'The Cable' },
    cols: 3, rows: 3, start: [0, 0], end: [3, 3],
    dots: [[1, 1, 2, 1]],
    squares: [{ x: 1, y: 0, c: 'b' }, { x: 1, y: 2, c: 'w' }],
    solution: [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [3, 2], [3, 3]],
    decoys: [{ reason: 'dot', path: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]] }],
  },
  {
    id: 'light-2', area: 'light', hint: 'combo', layout: 'open',
    name: { zh: '星下落在石上', en: 'Stars on Stone' },
    cols: 3, rows: 3, start: [0, 3], end: [3, 0],
    tetris: [{ x: 0, y: 0, c: '#e2b43a', shape: [[0, 0], [1, 0]] }],
    stars: [{ x: 2, y: 1, c: 'gold' }, { x: 2, y: 2, c: 'gold' }],
    solution: [[0, 3], [0, 2], [0, 1], [1, 1], [2, 1], [2, 0], [3, 0]],
    decoys: [{ reason: 'tetris', path: [[0, 3], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1], [3, 0]] }],
  },
  {
    id: 'light-3', area: 'light', hint: 'combo', layout: 'open', symmetry: 'v',
    name: { zh: '双线点灯', en: 'Both Lines' },
    cols: 4, rows: 4, start: [0, 0], end: [1, 4],
    dots: [[1, 1, 1, 2]],
    squares: [{ x: 0, y: 1, c: 'b' }, { x: 2, y: 1, c: 'w' }],
    solution: [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4]],
    decoys: [{ reason: 'dot', path: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4]] }],
  },
  {
    id: 'light-4', area: 'light', hint: 'combo', layout: 'open',
    name: { zh: '灯芯', en: 'The Wick' },
    cols: 4, rows: 4, start: [0, 0], end: [4, 4],
    dots: [[2, 2, 2, 3]],
    squares: [{ x: 0, y: 0, c: 'b' }, { x: 3, y: 0, c: 'w' }],
    stars: [
      { x: 0, y: 2, c: 'red' }, { x: 1, y: 2, c: 'red' },
      { x: 2, y: 2, c: 'blue' }, { x: 3, y: 3, c: 'blue' },
    ],
    solution: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [3, 4], [4, 4]],
    decoys: [{ reason: 'dot', path: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]] }],
  },
];

export const AREAS = [
  {
    id: 'dawn',
    name: { zh: '晨曦庭院', en: 'Dawn Court' },
    blurb: { zh: '先学会把线画到出口。', en: 'Learn to draw a line to the exit.' },
  },
  {
    id: 'orchard',
    name: { zh: '秋果园', en: 'Hex Orchard' },
    blurb: { zh: '线上的六角点必须经过。', en: 'The line must pass every hex mark.' },
  },
  {
    id: 'ink',
    name: { zh: '墨白园', en: 'Ink Garden' },
    blurb: { zh: '一块区域里不能既有黑又有白。同色可以在一起。', en: 'A region may hold black or white, never both. Like colors may share.' },
  },
  {
    id: 'star',
    name: { zh: '星桥', en: 'Star Bridge' },
    blurb: { zh: '同色的星必须留在同一区域。', en: 'Stars of the same color must share a region.' },
  },
  {
    id: 'mason',
    name: { zh: '石坊', en: 'Masonry' },
    blurb: { zh: '带有方块符号的区域，形状必须与符号完全一致，可以旋转。', en: 'A marked region must match the polyomino exactly. Rotation is allowed.' },
  },
  {
    id: 'mirror',
    name: { zh: '镜回廊', en: 'Mirror Cloister' },
    blurb: { zh: '你只画一侧，另一侧会镜像。两条线只能在中轴相贴。', en: 'Draw one side. The other mirrors it, and the lines may meet only on the axis.' },
  },
  {
    id: 'light',
    name: { zh: '灯塔', en: 'Lighthouse' },
    blurb: { zh: '把整座岛的规则收成一条路。', en: 'Gather every rule on the island into one road.' },
    finale: true,
  },
];

export const PUZZLES = RAW.map(compilePuzzle);

export function puzzlesInArea(areaId) {
  return PUZZLES.filter((p) => p.area === areaId);
}

export function puzzleById(id) {
  return PUZZLES.find((p) => p.id === id) || null;
}

for (const area of AREAS) {
  area.panels = puzzlesInArea(area.id).map((p) => p.id);
}
