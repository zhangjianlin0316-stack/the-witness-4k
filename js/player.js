import * as THREE from 'three';
import { sampleHeight } from './terrain.js';

export function createPlayer(camera, solids) {
  const state = {
    x: 0,
    z: 0,
    yaw: 0,
    pitch: -0.05,
    sens: 0.0022,
    eye: 1.62,
  };
  const wish = { f: false, b: false, l: false, r: false, sprint: false };

  function blocked(x, z) {
    for (const s of solids) {
      if (s.active === false) continue;
      const rr = (s.r || 0.6) + 0.34;
      const dx = x - s.x;
      const dz = z - s.z;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    return false;
  }

  function tryMove(dx, dz) {
    const nx = state.x + dx;
    const nz = state.z + dz;
    if (blocked(nx, nz)) return false;
    const h0 = sampleHeight(state.x, state.z);
    const h1 = sampleHeight(nx, nz);
    if (h1 < 0.28) return false;
    if (h1 - h0 > 0.55) return false;
    state.x = nx;
    state.z = nz;
    return true;
  }

  function applyCamera() {
    const y = sampleHeight(state.x, state.z) + state.eye;
    camera.position.set(state.x, y, state.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;
    camera.rotation.z = 0;
  }

  return {
    state,
    wish,
    applyCamera,
    teleport(x, z, yaw = state.yaw, pitch = state.pitch) {
      state.x = x;
      state.z = z;
      state.yaw = yaw;
      state.pitch = pitch;
      applyCamera();
    },
    look(dx, dy) {
      state.yaw -= dx * state.sens;
      state.pitch -= dy * state.sens;
      state.pitch = Math.max(-1.25, Math.min(1.25, state.pitch));
    },
    lookAt(x, y, z) {
      const eye = sampleHeight(state.x, state.z) + state.eye;
      const dx = x - state.x;
      const dy = y - eye;
      const dz = z - state.z;
      const horiz = Math.hypot(dx, dz) || 0.0001;
      state.pitch = Math.atan2(dy, horiz);
      state.yaw = Math.atan2(-dx, -dz);
      applyCamera();
    },
    update(dt) {
      let mx = 0;
      let mz = 0;
      const fx = -Math.sin(state.yaw);
      const fz = -Math.cos(state.yaw);
      const rx = Math.cos(state.yaw);
      const rz = -Math.sin(state.yaw);
      if (wish.f) { mx += fx; mz += fz; }
      if (wish.b) { mx -= fx; mz -= fz; }
      if (wish.r) { mx += rx; mz += rz; }
      if (wish.l) { mx -= rx; mz -= rz; }
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        const speed = (wish.sprint ? 7.4 : 4.15) * dt;
        mx = (mx / len) * speed;
        mz = (mz / len) * speed;
        if (!tryMove(mx, mz)) {
          tryMove(mx, 0);
          tryMove(0, mz);
        }
      }
      applyCamera();
      return len > 0;
    },
    forward(distance = 8) {
      const y = sampleHeight(state.x, state.z) + state.eye;
      const origin = new THREE.Vector3(state.x, y, state.z);
      const dir = new THREE.Vector3(-Math.sin(state.yaw), Math.sin(state.pitch), -Math.cos(state.yaw)).normalize();
      return { origin, dir, far: origin.clone().add(dir.multiplyScalar(distance)) };
    },
  };
}
