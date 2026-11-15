const KEY = 'mirror-isle-witness4k-v1';

export function defaultSave() {
  return {
    v: 1,
    solved: {},
    quality: 'medium',
    lang: 'zh',
    sens: 0.0022,
    volume: 0.72,
    endingSeen: false,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    return { ...defaultSave(), ...data, solved: data.solved || {} };
  } catch {
    return defaultSave();
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode */
  }
}
