import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = path.join(root, 'shots');
fs.mkdirSync(shots, { recursive: true });

const executablePath = process.env.CHROME || '/usr/bin/google-chrome';
const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--disable-gpu-sandbox',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--window-size=1440,810',
  ],
});

const page = await browser.newPage();
const errors = [];
page.on('console', (msg) => {
  const type = msg.type();
  const text = msg.text();
  if (type === 'error') errors.push(text);
  if (type === 'warning' && /error|fail|deprecated/i.test(text)) errors.push(`warn: ${text}`);
  console.log(`[${type}]`, text.slice(0, 300));
});
page.on('pageerror', (err) => {
  errors.push(String(err));
  console.log('[pageerror]', err);
});

await page.setViewport({ width: 1440, height: 810, deviceScaleFactor: 2 });
await page.goto('http://127.0.0.1:8741/?v=3', { waitUntil: 'networkidle0', timeout: 90000 });
await page.waitForFunction(() => window.__MIRROR__ && window.__MIRROR__.ready, { timeout: 90000 });
await page.evaluate(() => window.__MIRROR__.setQuality('high'));
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: path.join(shots, '01-menu.png') });

const boot = await page.evaluate(() => ({
  puzzles: window.__MIRROR__.puzzles.length,
  areas: window.__MIRROR__.areas.length,
  mode: window.__MIRROR__.mode,
  h: window.__MIRROR__.sampleHeight(0.4, 54.5),
}));
console.log('boot', boot);

async function shot(name, setup) {
  await page.evaluate(setup);
  await new Promise((r) => setTimeout(r, 250));
  await page.evaluate(() => new Promise((resolve) => {
    let n = 0;
    function frame() {
      n += 1;
      if (n > 3) resolve();
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }));
  await page.screenshot({ path: path.join(shots, name) });
  console.log('saved', name);
}

await shot('02-vista.png', () => {
  const M = window.__MIRROR__;
  M.hideUI();
  M.teleport(0.3, 50.5, 0, -0.06);
  M.lookAt(0, 2.4, 28);
});

await shot('03-orchard.png', () => {
  const M = window.__MIRROR__;
  M.hideUI();
  M.teleport(18.5, 31.5, -0.9, -0.05);
  M.lookAt(34, 3.2, 16);
});

await shot('04-coast.png', () => {
  const M = window.__MIRROR__;
  M.hideUI();
  M.teleport(12, 66, 2.4, -0.08);
  M.lookAt(-28, 2, 42);
});

await shot('06-puzzle.png', () => {
  const M = window.__MIRROR__;
  M.showUI();
  M.openPuzzle('dawn-1');
});

const solved = await page.evaluate(() => {
  const M = window.__MIRROR__;
  const before = Object.keys(M.getSolved()).length;
  const ok = M.solveActive();
  const after = M.getSolved();
  const dawn = M.puzzles.find((p) => p.id === 'dawn-1');
  const check = M.validate(dawn, dawn.solution);
  return { before, ok, after: Object.keys(after).length, check };
});
console.log('solve', solved);
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: path.join(shots, '07-solved.png') });

const ink = await page.evaluate(() => {
  const M = window.__MIRROR__;
  M.openPuzzle('ink-1');
  return M.solveActive();
});
console.log('ink solve', ink);
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: path.join(shots, '08-ink.png') });

await shot('09-mirror-garden.png', () => {
  const M = window.__MIRROR__;
  M.hideUI();
  M.teleport(24, -28, Math.PI, -0.04);
  M.lookAt(24, 2.6, -40);
});

await shot('05-lighthouse.png', () => {
  const M = window.__MIRROR__;
  M.hideUI();
  M.unlockAll();
  M.teleport(0.4, -36.5, 0, -0.28);
  M.lookAt(0, 11, -54);
});

const fatal = errors.filter((e) => !/WebGL|GL_INVALID|deprecated|THREE.WebGLRenderer/i.test(e));
console.log('ERROR_COUNT', errors.length);
console.log('FATAL', fatal);
if (!boot.puzzles || boot.puzzles < 30) throw new Error('puzzle count');
if (!solved.ok || !solved.check.ok) throw new Error('solve failed');
if (fatal.length) throw new Error(fatal.join('\n'));

await browser.close();
console.log('browser test ok');
