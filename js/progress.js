import { AREAS, PUZZLES } from './puzzles.js';

export function emptyProgress() {
  return {};
}

export function isSolved(progress, id) {
  return Object.prototype.hasOwnProperty.call(progress, id);
}

export function solvedCount(progress, ids = null) {
  const list = ids || PUZZLES.map((p) => p.id);
  let n = 0;
  for (const id of list) if (isSolved(progress, id)) n++;
  return n;
}

export function areaCleared(progress, areaId) {
  const area = AREAS.find((a) => a.id === areaId);
  if (!area) return false;
  return area.panels.every((id) => isSolved(progress, id));
}

export function areaUnlocked(progress, areaId) {
  const index = AREAS.findIndex((a) => a.id === areaId);
  if (index <= 0) return true;
  return areaCleared(progress, AREAS[index - 1].id);
}

export function allCleared(progress) {
  return AREAS.every((a) => areaCleared(progress, a.id));
}

export function nextPanelId(areaId, panelId) {
  const area = AREAS.find((a) => a.id === areaId);
  if (!area) return null;
  const i = area.panels.indexOf(panelId);
  if (i < 0 || i >= area.panels.length - 1) return null;
  return area.panels[i + 1];
}
