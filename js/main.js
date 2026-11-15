import * as THREE from 'three';
import { AREAS, PUZZLES, puzzleById } from './puzzles.js';
import { validatePuzzle } from './validator.js';
import { areaCleared, areaUnlocked, solvedCount } from './progress.js';
import { GARDENS, SPAWN, gardenAt } from './layout.js';
import { sampleHeight } from './terrain.js';
import { applyDom, areaName, getLang, onLang, setLang, t } from './i18n.js';
import { loadSave, writeSave } from './save.js';
import { createAudio } from './audio.js';
import { createWorld } from './world.js';
import { createPanels } from './panels.js';
import { createPlayer } from './player.js';
import { createPipeline } from './post.js';

const view = document.getElementById('view');
const save = loadSave();
setLang(save.lang || 'zh');

const renderer = new THREE.WebGLRenderer({
  canvas: view,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0xf0c4a4, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, 1, 0.08, 520);

let world;
let panels;
let player;
let pipeline;
try {
  world = createWorld(scene, renderer);
  panels = createPanels(scene, world.doors, world.solids);
  player = createPlayer(camera, world.solids);
  pipeline = createPipeline(renderer, scene, camera, world.sun);
  pipeline.build(save.quality || 'medium');
  panels.load(save.solved || {});
} catch (err) {
  const box = document.getElementById('boot-error');
  box.classList.remove('hidden');
  box.textContent = `WebGL: ${err && err.message ? err.message : err}`;
  throw err;
}

const audio = createAudio();
audio.setVolume(save.volume ?? 0.72);

const raycaster = new THREE.Raycaster();
const ndcCenter = new THREE.Vector2(0, 0);
const keys = new Set();
let mode = 'menu';
let menuTime = 0;
let last = performance.now();
let fpsSmoothed = 60;
let fpsAccum = 0;
let fpsFrames = 0;
let currentGarden = null;
let bannerTimer = 0;
let failTimer = 0;
let lookHint = false;
let suppressPause = false;

const el = {
  menu: document.getElementById('screen-menu'),
  hud: document.getElementById('hud'),
  pause: document.getElementById('screen-pause'),
  settings: document.getElementById('screen-settings'),
  help: document.getElementById('screen-help'),
  journal: document.getElementById('screen-journal'),
  ending: document.getElementById('screen-ending'),
  puzzle: document.getElementById('puzzle-bar'),
  prompt: document.getElementById('prompt'),
  look: document.getElementById('look-hint'),
  area: document.getElementById('hud-area'),
  count: document.getElementById('hud-count'),
  fps: document.getElementById('fps'),
  banner: document.getElementById('area-banner'),
  pName: document.getElementById('puzzle-name'),
  pHint: document.getElementById('puzzle-hint'),
  pFail: document.getElementById('puzzle-fail'),
  toast: document.getElementById('toast'),
  journalList: document.getElementById('journal-list'),
  sens: document.getElementById('sens'),
  volume: document.getElementById('volume'),
};

el.sens.value = String(save.sens ?? 0.0022);
el.volume.value = String(save.volume ?? 0.72);
player.state.sens = Number(el.sens.value);
markQuality(save.quality || 'medium');

function markQuality(name) {
  document.querySelectorAll('[data-quality]').forEach((btn) => {
    btn.classList.toggle('on', btn.dataset.quality === name);
  });
}

function persist() {
  save.lang = getLang();
  save.sens = player.state.sens;
  save.volume = Number(el.volume.value);
  save.solved = panels.getSolved();
  writeSave(save);
}

function toast(text) {
  el.toast.textContent = text;
  el.toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.remove('show'), 2200);
}

function show(node) { node.classList.remove('hidden'); }
function hide(node) { node.classList.add('hidden'); }

function refreshHud() {
  const g = gardenAt(player.state.x, player.state.z, 0);
  const area = g ? AREAS.find((a) => a.id === g.id) : null;
  el.area.textContent = area ? area.name[getLang()] : t('coast');
  const total = solvedCount(panels.solved);
  const local = area ? `${solvedCount(panels.solved, area.panels)} / ${area.panels.length}` : '';
  el.count.textContent = `${t('progressLabel')} ${total} / ${PUZZLES.length}${local ? ` · ${local}` : ''}`;
  if (g && currentGarden !== g.id) {
    currentGarden = g.id;
    el.banner.textContent = area.name[getLang()];
    el.banner.classList.add('show');
    bannerTimer = 2.4;
  }
  if (!g) currentGarden = null;
}

function renderJournal() {
  el.journalList.innerHTML = '';
  for (const area of AREAS) {
    const row = document.createElement('div');
    row.className = 'j-row';
    const unlocked = areaUnlocked(panels.solved, area.id);
    const cleared = areaCleared(panels.solved, area.id);
    const status = !unlocked ? t('locked') : cleared ? t('done') : t('open');
    row.innerHTML = `<span>${area.name[getLang()]}</span><span>${solvedCount(panels.solved, area.panels)} / ${area.panels.length}</span><em>${status}</em>`;
    el.journalList.appendChild(row);
  }
}

function openOverlay(node) {
  hide(el.settings);
  hide(el.help);
  hide(el.journal);
  show(node);
  if (node === el.journal) renderJournal();
  if ((mode === 'play' || mode === 'puzzle') && document.pointerLockElement === view) {
    suppressPause = true;
    document.exitPointerLock();
  }
}

function setMode(next) {
  mode = next;
  const playing = next === 'play' || next === 'puzzle' || next === 'shot';
  el.menu.classList.toggle('hidden', next !== 'menu');
  el.hud.classList.toggle('hidden', !playing && next !== 'pause');
  const cross = document.getElementById('crosshair');
  if (cross) cross.classList.toggle('hidden', next === 'puzzle');
  if (next !== 'puzzle') el.puzzle.classList.add('hidden');
  if (next !== 'pause') el.pause.classList.add('hidden');
  if (next !== 'ending') el.ending.classList.add('hidden');
  el.look.classList.toggle('hidden', next !== 'play' || document.pointerLockElement === view);
}

function beginPlay() {
  audio.resume();
  player.teleport(SPAWN.x, SPAWN.z, SPAWN.yaw, SPAWN.pitch);
  setMode('play');
  view.requestPointerLock();
}

function enterPuzzle(record) {
  const usable = panels.usable(record);
  if (usable === 'locked') {
    toast(t('lockedArea'));
    return;
  }
  if (usable === 'prev') {
    toast(t('needPrev'));
    return;
  }
  if (document.pointerLockElement === view) document.exitPointerLock();
  panels.open(record);
  setMode('puzzle');
  show(el.puzzle);
  const lang = getLang();
  el.pName.textContent = record.puzzle.name[lang];
  el.pHint.textContent = t(`hint_${record.puzzle.hint}`);
  el.pFail.textContent = '';
  audio.open();
  snapPuzzleCamera(1);
}

function leavePuzzle() {
  panels.close();
  setMode('play');
  hide(el.puzzle);
  player.applyCamera();
  view.requestPointerLock();
}

function snapPuzzleCamera(k) {
  const goal = panels.cameraGoal();
  if (!goal) return;
  const y = sampleHeight(player.state.x, player.state.z) + player.state.eye;
  const from = new THREE.Vector3(player.state.x, y, player.state.z);
  camera.position.lerpVectors(from, goal.position, k);
  camera.lookAt(goal.target);
  camera.fov = THREE.MathUtils.lerp(68, 40, k);
  camera.updateProjectionMatrix();
}

let puzzleBlend = 0;

function tryInteract() {
  raycaster.setFromCamera(ndcCenter, camera);
  const hit = panels.pick(raycaster);
  if (!hit || hit.dist > 3.8) return;
  enterPuzzle(hit.record);
}

function updatePrompt() {
  if (mode !== 'play' || document.pointerLockElement !== view) {
    el.prompt.textContent = '';
    return;
  }
  raycaster.setFromCamera(ndcCenter, camera);
  const hit = panels.pick(raycaster);
  if (!hit || hit.dist > 6.5) {
    el.prompt.textContent = '';
    return;
  }
  const name = hit.record.puzzle.name[getLang()];
  if (hit.dist > 3.8) el.prompt.textContent = `${name} · ${t('farPrompt')}`;
  else if (hit.record.solved) el.prompt.textContent = `${name} · ${t('solvedTag')}`;
  else el.prompt.textContent = `${name} · ${t('interactPrompt')}`;
}

function menuCamera(time) {
  const x = 16 + Math.sin(time * 0.05) * 1.6;
  const z = 63 + Math.cos(time * 0.04) * 0.8;
  const y = Math.max(1.8, sampleHeight(x, z) + 2.4);
  camera.position.set(x, y, z);
  camera.fov = 62;
  camera.lookAt(-8, 3.4, 18);
  camera.updateProjectionMatrix();
}

function pointerNdc(event) {
  const rect = view.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
}

function applyQuality(name) {
  save.quality = name;
  pipeline.build(name);
  markQuality(name);
  persist();
}

async function screenshot() {
  const ui = document.getElementById('ui');
  ui.classList.add('shot-hide');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  let shot;
  try {
    shot = pipeline.capture(3840, 2160);
  } catch (err) {
    console.error(err);
    shot = null;
  }
  ui.classList.remove('shot-hide');
  pipeline.resize();
  if (!shot || !shot.url) {
    toast(t('toastShotFail'));
    return;
  }
  const a = document.createElement('a');
  a.href = shot.url;
  a.download = `mirror-isle-4k-${Date.now()}.png`;
  a.click();
  toast(shot.width >= 3840 ? t('toastShot') : t('toastShotFail'));
}

function startEnding() {
  if (save.endingSeen) return;
  save.endingSeen = true;
  persist();
  world.lamp.userData.boost = 1.6;
  world.lamp.userData.lightBase = 4;
  setMode('ending');
  show(el.ending);
  if (document.pointerLockElement === view) document.exitPointerLock();
  audio.ending();
}

panels.on((type, payload) => {
  if (type === 'step') audio.step();
  if (type === 'fail') {
    audio.fail();
    el.pFail.textContent = t(`fail_${payload.reason}`) || payload.reason;
    failTimer = 2.2;
  }
  if (type === 'solved') {
    audio.success();
    persist();
    refreshHud();
    if (payload.cleared) audio.door();
    if (payload.finale) setTimeout(startEnding, 900);
    el.pFail.textContent = t('solvedTag');
  }
});

onLang(() => {
  refreshHud();
  const active = panels.active();
  if (active) {
    el.pName.textContent = active.puzzle.name[getLang()];
    el.pHint.textContent = t(`hint_${active.puzzle.hint}`);
  }
});

document.getElementById('btn-play').addEventListener('click', beginPlay);
document.getElementById('btn-settings').addEventListener('click', () => openOverlay(el.settings));
document.getElementById('btn-help').addEventListener('click', () => openOverlay(el.help));
document.getElementById('btn-lang').addEventListener('click', () => {
  setLang(getLang() === 'zh' ? 'en' : 'zh');
  persist();
});
document.getElementById('btn-settings-close').addEventListener('click', () => hide(el.settings));
document.getElementById('btn-help-close').addEventListener('click', () => hide(el.help));
document.getElementById('btn-journal-close').addEventListener('click', () => hide(el.journal));
document.getElementById('btn-resume').addEventListener('click', () => {
  hide(el.pause);
  setMode('play');
  view.requestPointerLock();
});
document.getElementById('btn-pause-settings').addEventListener('click', () => openOverlay(el.settings));
document.getElementById('btn-pause-help').addEventListener('click', () => openOverlay(el.help));
document.getElementById('btn-pause-journal').addEventListener('click', () => openOverlay(el.journal));
document.getElementById('btn-quit').addEventListener('click', () => {
  hide(el.pause);
  setMode('menu');
  if (document.pointerLockElement === view) document.exitPointerLock();
});
document.getElementById('btn-journal').addEventListener('click', () => openOverlay(el.journal));
document.getElementById('btn-shot').addEventListener('click', () => screenshot());
document.getElementById('btn-reset').addEventListener('click', () => panels.resetLine());
document.getElementById('btn-leave').addEventListener('click', leavePuzzle);
document.getElementById('btn-ending').addEventListener('click', () => {
  hide(el.ending);
  setMode('play');
  world.lamp.userData.boost = 0.8;
});
el.sens.addEventListener('input', () => {
  player.state.sens = Number(el.sens.value);
  persist();
});
el.volume.addEventListener('input', () => {
  audio.setVolume(Number(el.volume.value));
  persist();
});
document.querySelectorAll('[data-quality]').forEach((btn) => {
  btn.addEventListener('click', () => applyQuality(btn.dataset.quality));
});

view.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return;
  if (mode === 'puzzle') panels.pointer(pointerNdc(event), camera, 'down');
  else if (mode === 'play' && document.pointerLockElement === view) tryInteract();
});
window.addEventListener('mouseup', (event) => {
  if (mode === 'puzzle') panels.pointer(pointerNdc(event), camera, 'up');
});
window.addEventListener('mousemove', (event) => {
  if (mode === 'puzzle' && (event.buttons & 1)) panels.pointer(pointerNdc(event), camera, 'move');
  if (mode === 'play' && document.pointerLockElement === view) {
    player.look(event.movementX, event.movementY);
  }
});
view.addEventListener('click', () => {
  if (mode === 'play' && document.pointerLockElement !== view) view.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === view;
  lookHint = !locked && mode === 'play';
  el.look.classList.toggle('hidden', !lookHint);
  if (!locked && mode === 'play') {
    if (suppressPause) {
      suppressPause = false;
      lookHint = true;
      el.look.classList.remove('hidden');
      return;
    }
    setMode('pause');
    show(el.pause);
  }
});
document.addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (event.code === 'Tab') event.preventDefault();
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
    event.preventDefault();
  }
  if (event.code === 'KeyE' && mode === 'play') tryInteract();
  if (event.code === 'KeyR' && mode === 'puzzle') panels.resetLine();
  if (event.code === 'F2') {
    event.preventDefault();
    screenshot();
  }
  if (event.code === 'Tab' && (mode === 'play' || mode === 'pause')) openOverlay(el.journal);
  if (event.code === 'F1') openOverlay(el.help);
  if (event.code === 'Escape') {
    if (mode === 'puzzle') leavePuzzle();
    else if (mode === 'ending') {
      hide(el.ending);
      setMode('play');
    } else if (mode === 'pause') {
      hide(el.pause);
      setMode('play');
      view.requestPointerLock();
    } else if (el.settings.classList.contains('hidden') === false || !el.help.classList.contains('hidden') || !el.journal.classList.contains('hidden')) {
      hide(el.settings); hide(el.help); hide(el.journal);
    }
  }
});
document.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
  pipeline.resize();
});
window.addEventListener('blur', () => keys.clear());

applyDom();
setMode('menu');

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  menuTime += dt;
  const moving = keys.has('KeyW') || keys.has('KeyA') || keys.has('KeyS') || keys.has('KeyD')
    || keys.has('ArrowUp') || keys.has('ArrowLeft') || keys.has('ArrowDown') || keys.has('ArrowRight');

  if (mode === 'menu') menuCamera(menuTime);
  else if (mode === 'play' || mode === 'shot') {
    player.wish.f = keys.has('KeyW') || keys.has('ArrowUp');
    player.wish.b = keys.has('KeyS') || keys.has('ArrowDown');
    player.wish.l = keys.has('KeyA') || keys.has('ArrowLeft');
    player.wish.r = keys.has('KeyD') || keys.has('ArrowRight');
    player.wish.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    if (mode === 'shot') player.applyCamera();
    else player.update(dt);
    updatePrompt();
    refreshHud();
  } else if (mode === 'puzzle') {
    puzzleBlend = Math.min(1, puzzleBlend + dt * 2.4);
    snapPuzzleCamera(puzzleBlend);
    if (failTimer > 0) {
      failTimer -= dt;
      if (failTimer <= 0 && panels.active() && !panels.active().solved) el.pFail.textContent = '';
    }
  }
  if (mode !== 'puzzle') puzzleBlend = 0;

  if (bannerTimer > 0) {
    bannerTimer -= dt;
    if (bannerTimer <= 0) el.banner.classList.remove('show');
  }

  world.update(menuTime, dt);
  panels.update(dt, menuTime);
  audio.update(menuTime);
  pipeline.render();

  fpsFrames++;
  fpsAccum += dt;
  if (fpsAccum >= 0.4) {
    fpsSmoothed = fpsFrames / fpsAccum;
    el.fps.textContent = `${Math.round(fpsSmoothed)} ${t('fps')}`;
    fpsFrames = 0;
    fpsAccum = 0;
  }
  requestAnimationFrame(frame);
  void moving;
}

requestAnimationFrame(frame);

window.__MIRROR__ = {
  ready: true,
  validate: validatePuzzle,
  puzzles: PUZZLES,
  areas: AREAS,
  gardens: GARDENS,
  sampleHeight,
  get mode() { return mode; },
  get fps() { return fpsSmoothed; },
  teleport(x, z, yaw = 0, pitch = -0.05) {
    hide(el.menu);
    setMode('shot');
    player.teleport(x, z, yaw, pitch);
  },
  lookAt(x, y, z) { player.lookAt(x, y, z); },
  setQuality: applyQuality,
  hideUI() { document.getElementById('ui').classList.add('shot-hide'); },
  showUI() { document.getElementById('ui').classList.remove('shot-hide'); },
  openPuzzle(id) {
    const record = panels.records.find((r) => r.puzzle.id === id);
    if (!record) return false;
    hide(el.menu);
    setMode('puzzle');
    show(el.hud);
    show(el.puzzle);
    panels.open(record);
    const lang = getLang();
    el.pName.textContent = record.puzzle.name[lang];
    el.pHint.textContent = t(`hint_${record.puzzle.hint}`);
    puzzleBlend = 1;
    snapPuzzleCamera(1);
    return true;
  },
  solveActive() { return panels.solveActive(); },
  getSolved() { return panels.getSolved(); },
  unlockAll() {
    const map = {};
    for (const puzzle of PUZZLES) map[puzzle.id] = puzzle.solution.map((p) => p.slice());
    panels.load(map);
    save.solved = panels.getSolved();
    world.lamp.userData.boost = 1.4;
    world.lamp.userData.lightBase = 6;
    persist();
  },
  capture(w, h) { return pipeline.capture(w, h); },
  puzzleById,
  areaName,
};

console.info('Mirror Isle ready', PUZZLES.length, 'puzzles');
