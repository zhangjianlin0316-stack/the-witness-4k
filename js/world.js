import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GARDENS, WINDMILL, mulberry32 } from './layout.js';
import { islandMask, sampleColor, sampleHeight } from './terrain.js';

const SUN_POS = new THREE.Vector3(-52, 68, 34);

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

function paintSRGB(color, r, g, b) {
  color.setRGB(r, g, b, THREE.SRGBColorSpace);
}

function makeNormalMap() {
  const s = 128;
  const heights = new Float32Array(s * s);
  const rng = mulberry32(9);
  for (let i = 0; i < heights.length; i++) heights[i] = rng();
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const l = heights[y * s + ((x + s - 1) % s)];
      const r = heights[y * s + ((x + 1) % s)];
      const d = heights[((y + 1) % s) * s + x];
      const u = heights[((y + s - 1) % s) * s + x];
      const nx = (l - r) * 2.2;
      const ny = (u - d) * 2.2;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const p = i * 4;
      img.data[p] = (nx / len * 0.5 + 0.5) * 255;
      img.data[p + 1] = (ny / len * 0.5 + 0.5) * 255;
      img.data[p + 2] = (nz / len * 0.5 + 0.5) * 255;
      img.data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 256;
  const g = c.getContext('2d');
  const bands = ['#f4efe4', '#f4efe4', '#c4563a', '#f4efe4', '#f4efe4', '#f4efe4', '#d86a45', '#f7f3ea'];
  const h = c.height / bands.length;
  bands.forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect(0, i * h, c.width, h + 1);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createWorld(scene, renderer) {
  const solids = [];
  const rng = mulberry32(0x4c1a7);
  const normalMap = makeNormalMap();

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  scene.fog = new THREE.FogExp2(0xf2c7a2, 0.0065);
  scene.background = null;

  const hemi = new THREE.HemisphereLight(0xb7d0f2, 0x8d7348, 0.38);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0c8, 1.7);
  sun.position.copy(SUN_POS);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 8;
  sun.shadow.camera.far = 190;
  sun.shadow.camera.left = -78;
  sun.shadow.camera.right = 78;
  sun.shadow.camera.top = 78;
  sun.shadow.camera.bottom = -78;
  sun.shadow.bias = -0.00012;
  sun.shadow.normalBias = 0.025;
  sun.target.position.set(0, 2, -6);
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0x7f9ec4, 0.22);
  fill.position.set(30, 18, -40);
  scene.add(fill);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(420, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uSun: { value: SUN_POS.clone().normalize() },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vDir = normalize(wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 uSun;
        void main() {
          float h = clamp(vDir.y, -0.05, 1.0);
          vec3 zenith = vec3(0.23, 0.42, 0.74);
          vec3 mid = vec3(0.55, 0.70, 0.88);
          vec3 horizon = vec3(0.98, 0.62, 0.40);
          vec3 col = mix(horizon, mid, smoothstep(0.0, 0.28, h));
          col = mix(col, zenith, smoothstep(0.18, 0.85, h));
          float sun = pow(max(dot(normalize(vDir), uSun), 0.0), 1400.0);
          float glow = pow(max(dot(normalize(vDir), uSun), 0.0), 6.0);
          col += vec3(1.0, 0.95, 0.82) * sun * 1.8;
          col += vec3(1.0, 0.72, 0.42) * glow * 0.38;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  sky.userData.noAO = true;
  sky.frustumCulled = false;
  scene.add(sky);

  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture('#fff1c9', '#ffb15a'),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.9,
  }));
  sunSprite.position.copy(SUN_POS).normalize().multiplyScalar(280);
  sunSprite.scale.set(48, 48, 1);
  sunSprite.userData.noAO = true;
  scene.add(sunSprite);

  buildTerrain(scene, normalMap);
  const water = buildWater(scene);
  const windmill = buildWindmill(scene, solids);
  buildPier(scene, solids);
  const boat = buildBoat(scene);
  buildGardens(scene, solids);
  buildTrees(scene, rng);
  buildRocks(scene, rng, solids);
  buildFlowers(scene, rng);
  buildReeds(scene, rng);
  buildRuins(scene, solids);
  const clouds = buildClouds(scene, rng);
  const birds = buildBirds(scene);
  const petals = buildPetals(scene, rng);
  const lamp = buildLighthouse(scene, solids);
  buildInkPool(scene);
  buildMirrorPool(scene);

  const doors = {};
  for (const g of GARDENS) doors[g.id] = buildDoor(scene, g, solids);

  function update(time, dt) {
    water.material.uniforms.uTime.value = time;
    windmill.rotation.z = time * 0.45;
    boat.position.y = 0.12 + Math.sin(time * 0.8) * 0.05;
    boat.rotation.z = Math.sin(time * 0.6) * 0.03;
    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.vx * dt;
      if (cloud.position.x > 120) cloud.position.x = -120;
    }
    const flutter = Math.sin(time * 7) * 0.6;
    for (const bird of birds) {
      bird.userData.a += dt * bird.userData.speed;
      const a = bird.userData.a;
      const rad = bird.userData.rad;
      bird.position.set(Math.cos(a) * rad, bird.userData.y + Math.sin(a * 3) * 0.4, Math.sin(a * 0.8) * rad * 0.72);
      bird.rotation.y = -a + Math.PI;
      bird.children[1].rotation.z = flutter;
      bird.children[2].rotation.z = -flutter;
    }
    const dummy = petals.userData.dummy;
    const speeds = petals.userData.speeds;
    for (let i = 0; i < speeds.length; i++) {
      petals.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
      dummy.position.y -= dt * speeds[i];
      dummy.position.x += Math.sin(time + i) * dt * 0.25;
      if (dummy.position.y < sampleHeight(dummy.position.x, dummy.position.z) + 0.2) {
        dummy.position.y = 6 + (i % 5);
      }
      dummy.quaternion.setFromEuler(new THREE.Euler(time + i, time * 0.4, 0));
      dummy.updateMatrix();
      petals.setMatrixAt(i, dummy.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;
    const glow = 0.35 + Math.sin(time * 2.2) * 0.08;
    lamp.material.emissiveIntensity = lamp.userData.base + glow * lamp.userData.boost;
    if (lamp.userData.light) lamp.userData.light.intensity = lamp.userData.lightBase + lamp.userData.boost * 8;
  }

  return { update, solids, sun, doors, lamp };
}

function radialTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.35, outer);
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildTerrain(scene, normalMap) {
  const size = 190;
  const seg = 150;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = sampleHeight(x, z);
    pos.setY(i, h);
    const c = sampleColor(x, z, h);
    paintSRGB(color, c[0], c[1], c[2]);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.0,
    normalMap,
    normalScale: new THREE.Vector2(0.28, 0.28),
    envMapIntensity: 0.12,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  scene.add(mesh);
}

function buildWater(scene) {
  const geo = new THREE.PlaneGeometry(220, 220, 80, 80);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: SUN_POS.clone().normalize() },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 p = position;
        float w1 = sin(p.x * 0.35 + uTime * 1.3);
        float w2 = sin(p.z * 0.22 + uTime * 0.9);
        float w3 = sin((p.x + p.z) * 0.15 + uTime * 0.6);
        p.y += w1 * 0.07 + w2 * 0.05 + w3 * 0.04;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        vec3 n = normalize(vec3(-cos(p.x * 0.35 + uTime * 1.3) * 0.12, 1.0, -cos(p.z * 0.22 + uTime * 0.9) * 0.08));
        vNormal = normalize(mat3(modelMatrix) * n);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uSun;
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorld);
        vec3 n = normalize(vNormal);
        float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 3.0);
        vec3 deep = vec3(0.05, 0.28, 0.38);
        vec3 shallow = vec3(0.30, 0.68, 0.66);
        vec3 col = mix(deep, shallow, fres);
        float spec = pow(max(dot(reflect(-uSun, n), viewDir), 0.0), 80.0);
        col += vec3(1.0, 0.95, 0.85) * spec * 0.55;
        float coast = length(vWorld.xz / vec2(62.0, 70.0));
        float foam = smoothstep(0.78, 0.92, coast) * (0.45 + 0.55 * sin(uTime * 2.0 + vWorld.x * 0.35));
        foam *= smoothstep(1.05, 0.9, coast);
        col = mix(col, vec3(0.95, 0.97, 0.96), foam * 0.75);
        float dist = length(cameraPosition - vWorld);
        float fog = 1.0 - exp(-dist * 0.012);
        col = mix(col, vec3(0.94, 0.77, 0.64), fog);
        gl_FragColor = vec4(col, 0.9);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.02;
  mesh.userData.noAO = true;
  mesh.renderOrder = 1;
  scene.add(mesh);
  return mesh;
}

function stdMat(color, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.75,
    metalness: opts.metalness ?? 0.04,
    envMapIntensity: opts.env ?? 0.4,
    flatShading: opts.flat || false,
    emissive: opts.emissive || 0x000000,
    emissiveIntensity: opts.emissiveIntensity || 0,
    transparent: opts.transparent || false,
    opacity: opts.opacity ?? 1,
    side: opts.side || THREE.FrontSide,
  });
  return m;
}

function buildGardens(scene, solids) {
  const dummy = new THREE.Object3D();
  const matrices = [];
  const colors = [];
  const geo = new THREE.BoxGeometry(2.55, 1, 0.62);
  for (const g of GARDENS) {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(g.r - 0.55, 48),
      stdMat(g.floor, { roughness: 0.92, env: 0.2 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(g.x, g.ground + 0.045, g.z);
    floor.receiveShadow = true;
    scene.add(floor);
    const seg = 34;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      if (angDiff(a, g.doorAngle) < 0.2) continue;
      const x = g.x + Math.sin(a) * g.r;
      const z = g.z + Math.cos(a) * g.r;
      const h = 2.05 + ((i * 17) % 5) * 0.06;
      dummy.position.set(x, g.ground + h * 0.5, z);
      dummy.scale.set(1, h, 1);
      dummy.rotation.set(0, a, 0);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      colors.push(new THREE.Color(g.wall));
      solids.push({ x, z, r: 0.85, tag: `wall-${g.id}` });
    }
  }
  const mesh = new THREE.InstancedMesh(geo, stdMat(0xffffff, { roughness: 0.82, env: 0.35 }), matrices.length);
  const col = new THREE.InstancedBufferAttribute(new Float32Array(matrices.length * 3), 3);
  matrices.forEach((m, i) => {
    mesh.setMatrixAt(i, m);
    col.setXYZ(i, colors[i].r, colors[i].g, colors[i].b);
  });
  mesh.instanceColor = col;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function buildDoor(scene, g, solids) {
  const pivot = new THREE.Group();
  pivot.position.set(g.doorX, g.ground, g.doorZ);
  pivot.rotation.y = g.doorAngle;
  const hinge = new THREE.Group();
  hinge.position.set(-1.25, 0, 0);
  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 2.15, 0.12),
    stdMat(g.id === 'ink' ? 0x2a2420 : 0x8d5a32, { roughness: 0.7, env: 0.3 }),
  );
  leaf.position.set(1.25, 1.08, 0);
  leaf.castShadow = true;
  hinge.add(leaf);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.14), stdMat(0xc9a36a, { metalness: 0.4, roughness: 0.4 }));
  bar.position.set(1.25, 1.15, 0.08);
  hinge.add(bar);
  pivot.add(hinge);
  const pillarGeo = new THREE.BoxGeometry(0.38, 2.4, 0.38);
  const pillarMat = stdMat(g.wall, { roughness: 0.78 });
  for (const side of [-1.55, 1.55]) {
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(side, 1.2, 0);
    p.castShadow = true;
    pivot.add(p);
  }
  const lantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    stdMat(0xffe1a8, { emissive: 0xffc56b, emissiveIntensity: 0.15, roughness: 0.35 }),
  );
  lantern.position.set(0, 2.25, 0.2);
  pivot.add(lantern);
  scene.add(pivot);
  const collider = { x: g.doorX, z: g.doorZ, r: 1.15, tag: `door-${g.id}`, active: g.id !== 'dawn' };
  solids.push(collider);
  const state = { open: g.id === 'dawn' ? 1 : 0, target: g.id === 'dawn' ? 1 : 0 };
  return {
    pivot,
    lantern,
    collider,
    state,
    setOpen(flag) {
      state.target = flag ? 1 : 0;
      collider.active = !flag;
    },
    update(dt) {
      state.open += (state.target - state.open) * Math.min(1, dt * 2.2);
      hinge.rotation.y = state.open * 1.45;
      const lit = state.target > 0.5 ? 0.45 : 0.06;
      lantern.material.emissiveIntensity += (lit - lantern.material.emissiveIntensity) * Math.min(1, dt * 3);
    },
  };
}

function buildTrees(scene, rng) {
  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.18, 1.6, 6);
  const leafGeo = new THREE.IcosahedronGeometry(0.82, 1);
  const palettes = [
    [0xe07a3d, 0xc4512c, 0xf0c14d],
    [0xd4527a, 0xf0a0b8, 0xffd0dc],
    [0x6a9a3c, 0x3e6b32, 0x9cbc55],
    [0xc73b4a, 0xe28a45, 0xf2d2a4],
  ];
  const trunks = [];
  const leaves = [];
  const leafColors = [];
  function addTree(x, z, pi, scale) {
    const y = sampleHeight(x, z);
    if (y < 0.7) return;
    const yaw = rng() * Math.PI * 2;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * 0.08, yaw, rng() * 0.08));
    const tm = new THREE.Matrix4();
    tm.compose(new THREE.Vector3(x, y + 0.8 * scale, z), q, new THREE.Vector3(scale, scale, scale));
    trunks.push(tm);
    const cols = palettes[pi % palettes.length];
    for (let k = 0; k < 2; k++) {
      const lm = new THREE.Matrix4();
      const s = scale * (k === 0 ? 1.15 : 0.78);
      const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw + k, rng() * 0.2));
      lm.compose(
        new THREE.Vector3(x + (rng() - 0.5) * 0.2, y + (1.55 + k * 0.55) * scale, z + (rng() - 0.5) * 0.2),
        q2,
        new THREE.Vector3(s, s * 0.82, s),
      );
      leaves.push(lm);
      leafColors.push(new THREE.Color(cols[k % cols.length]));
    }
  }
  for (const g of GARDENS) {
    const count = g.dress === 'orchard' ? 11 : g.dress === 'light' ? 0 : g.dress === 'ink' ? 2 : 4;
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const rad = (0.35 + rng() * 0.5) * (g.r - 2);
      const pi = g.dress === 'orchard' ? (i % 2 === 0 ? 1 : 0) : g.dress === 'ink' ? 2 : (i + g.x) % 4;
      addTree(g.x + Math.cos(a) * rad, g.z + Math.sin(a) * rad, Math.abs(pi) % 4, 0.85 + rng() * 0.45);
    }
  }
  let guard = 0;
  while (trunks.length < 78 && guard < 400) {
    guard++;
    const x = (rng() - 0.5) * 110;
    const z = (rng() - 0.5) * 120;
    if (islandMask(x, z) < 0.55) continue;
    if (GARDENS.some((g) => Math.hypot(x - g.x, z - g.z) < g.r + 1.2)) continue;
    const h = sampleHeight(x, z);
    if (h < 0.85 || h > 8.5) continue;
    addTree(x, z, Math.floor(rng() * 4), 0.8 + rng() * 0.7);
  }
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, stdMat(0x6b4632, { roughness: 0.86 }), trunks.length);
  trunks.forEach((m, i) => trunkMesh.setMatrixAt(i, m));
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  scene.add(trunkMesh);
  const leafMat = stdMat(0xffffff, { roughness: 0.62, flat: true, env: 0.22 });
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leaves.length);
  const arr = new Float32Array(leaves.length * 3);
  leaves.forEach((m, i) => {
    leafMesh.setMatrixAt(i, m);
    arr[i * 3] = leafColors[i].r;
    arr[i * 3 + 1] = leafColors[i].g;
    arr[i * 3 + 2] = leafColors[i].b;
  });
  leafMesh.instanceColor = new THREE.InstancedBufferAttribute(arr, 3);
  leafMesh.castShadow = true;
  leafMesh.receiveShadow = true;
  scene.add(leafMesh);
}

function buildRocks(scene, rng, solids) {
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mats = [];
  const matrices = [];
  const colors = [];
  for (let i = 0; i < 42; i++) {
    const x = (rng() - 0.5) * 108;
    const z = (rng() - 0.5) * 118;
    if (islandMask(x, z) < 0.42) continue;
    if (GARDENS.some((g) => Math.hypot(x - g.x, z - g.z) < g.r - 1)) continue;
    const y = sampleHeight(x, z);
    if (y < 0.3) continue;
    const s = 0.35 + rng() * 1.15;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng(), rng() * 6, rng()));
    m.compose(new THREE.Vector3(x, y + s * 0.25, z), q, new THREE.Vector3(s * (0.8 + rng()), s * (0.55 + rng() * 0.5), s));
    matrices.push(m);
    const shade = 0.45 + rng() * 0.18;
    colors.push(shade, shade * 0.95, shade * 0.9);
    if (s > 0.7) solids.push({ x, z, r: s * 0.55, tag: 'rock' });
  }
  // quarry chunks inside masonry
  const mason = GARDENS.find((g) => g.id === 'mason');
  for (let i = 0; i < 7; i++) {
    const x = mason.x + (rng() - 0.5) * 10;
    const z = mason.z + (rng() - 0.5) * 10;
    const s = 0.5 + rng() * 0.8;
    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(x, mason.ground + s * 0.3, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng() * 3, rng() * 0.4)),
      new THREE.Vector3(s, s * 0.6, s * 0.8),
    );
    matrices.push(m);
    colors.push(0.72, 0.62, 0.5);
    solids.push({ x, z, r: s * 0.45, tag: 'quarry' });
  }
  const mesh = new THREE.InstancedMesh(geo, stdMat(0xffffff, { roughness: 0.78, flat: true, env: 0.45 }), matrices.length);
  const arr = new Float32Array(colors);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(arr, 3);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  void mats;
}

function buildFlowers(scene, rng) {
  const geo = new THREE.ConeGeometry(0.12, 0.28, 5);
  const matrices = [];
  const colors = [];
  const palette = [0xf2a3b8, 0xfff4d2, 0xe7c85a, 0xf7f7f2, 0xe07a9a];
  for (let i = 0; i < 160; i++) {
    const x = (rng() - 0.5) * 100;
    const z = (rng() - 0.5) * 110;
    const h = sampleHeight(x, z);
    if (h < 0.6 || h > 7) continue;
    if (islandMask(x, z) < 0.5) continue;
    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(x, h + 0.14, z),
      new THREE.Quaternion(),
      new THREE.Vector3(0.7 + rng(), 0.6 + rng(), 0.7 + rng()),
    );
    matrices.push(m);
    const col = new THREE.Color(palette[i % palette.length]);
    colors.push(col.r, col.g, col.b);
  }
  if (!matrices.length) return;
  const mesh = new THREE.InstancedMesh(geo, stdMat(0xffffff, { roughness: 0.6, flat: true, env: 0.2 }), matrices.length);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(colors), 3);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function buildReeds(scene, rng) {
  const geo = new THREE.CylinderGeometry(0.03, 0.05, 1.1, 4);
  const matrices = [];
  for (let i = 0; i < 50; i++) {
    const a = rng() * Math.PI * 2;
    const rad = 52 + rng() * 10;
    const x = Math.cos(a) * rad * 0.72;
    const z = Math.sin(a) * rad;
    const h = sampleHeight(x, z);
    if (h < -0.2 || h > 0.8) continue;
    const m = new THREE.Matrix4();
    m.compose(new THREE.Vector3(x, h + 0.5, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng() * 3, (rng() - 0.5) * 0.4)), new THREE.Vector3(1, 0.7 + rng() * 0.6, 1));
    matrices.push(m);
  }
  if (!matrices.length) return;
  const mesh = new THREE.InstancedMesh(geo, stdMat(0x8aaa55, { roughness: 0.7, flat: true }), matrices.length);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  scene.add(mesh);
}

function buildRuins(scene, solids) {
  const stone = stdMat(0xd9d0c2, { roughness: 0.8, env: 0.4 });
  const spots = [
    [18, -26], [16, -30], [27, -28], [-4, -18], [-16, -20],
  ];
  spots.forEach(([x, z], i) => {
    const y = sampleHeight(x, z);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 1.8 + (i % 3) * 0.4, 8), stone);
    col.position.set(x, y + 0.9, z);
    col.castShadow = true;
    col.receiveShadow = true;
    if (i % 2 === 0) col.rotation.z = 0.08;
    scene.add(col);
    solids.push({ x, z, r: 0.5, tag: 'ruin' });
    if (i % 2 === 0) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5), stone);
      cap.position.set(x, y + 1.9, z);
      cap.castShadow = true;
      scene.add(cap);
    }
  });
}

function buildWindmill(scene, solids) {
  const y = sampleHeight(WINDMILL.x, WINDMILL.z);
  const group = new THREE.Group();
  group.position.set(WINDMILL.x, y, WINDMILL.z);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.7, 7.2, 8), stdMat(0xf3efe6, { roughness: 0.72 }));
  tower.position.y = 3.6;
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.3, 8), stdMat(0x8d3d32, { roughness: 0.6 }));
  roof.position.y = 7.6;
  roof.castShadow = true;
  group.add(roof);
  const hub = new THREE.Group();
  hub.position.set(0, 6.3, 1.15);
  const bladeGeo = new THREE.BoxGeometry(0.28, 3.3, 0.06);
  const cloth = stdMat(0xf7f1e4, { roughness: 0.55 });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(bladeGeo, cloth);
    b.position.y = 1.7;
    const pivot = new THREE.Group();
    pivot.rotation.z = (i / 4) * Math.PI * 2;
    pivot.add(b);
    hub.add(pivot);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), stdMat(0x6b422c, { roughness: 0.5 }));
  hub.add(nose);
  group.add(hub);
  scene.add(group);
  solids.push({ x: WINDMILL.x, z: WINDMILL.z, r: 1.7, tag: 'mill' });
  return hub;
}

function buildLighthouse(scene, solids) {
  const g = GARDENS.find((d) => d.id === 'light');
  const y = g.ground;
  const group = new THREE.Group();
  group.position.set(g.x, y, g.z);
  const tex = stripeTexture();
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector2(2.15 - t * 0.55, t * 12.5));
  }
  const tower = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.62, metalness: 0.05, envMapIntensity: 0.35,
  }));
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);
  const gallery = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.08, 8, 20), stdMat(0x22262b, { metalness: 0.6, roughness: 0.35 }));
  gallery.rotation.x = Math.PI / 2;
  gallery.position.y = 12.2;
  group.add(gallery);
  const glassMat = stdMat(0xfff6e4, {
    emissive: 0xffc98a, emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.05,
    transparent: true, opacity: 0.78, env: 0.8,
  });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 2.1, 12), glassMat);
  glass.position.y = 13.3;
  group.add(glass);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), stdMat(0xb08d4a, { metalness: 0.65, roughness: 0.32 }));
  cap.position.y = 14.35;
  cap.castShadow = true;
  group.add(cap);
  const bulb = new THREE.PointLight(0xffd2a2, 1.2, 18, 2);
  bulb.position.y = 13.3;
  group.add(bulb);
  glass.userData.light = bulb;
  glass.userData.base = 0.55;
  glass.userData.boost = 0;
  glass.userData.lightBase = 1.2;
  scene.add(group);
  solids.push({ x: g.x, z: g.z, r: 2.1, tag: 'lighthouse' });
  return glass;
}

function buildPier(scene, solids) {
  const wood = stdMat(0x8d6844, { roughness: 0.78 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 16), wood);
  deck.position.set(0, 0.48, 62);
  deck.receiveShadow = true;
  deck.castShadow = true;
  scene.add(deck);
  for (let i = 0; i < 5; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.3, 6), wood);
    post.position.set(i % 2 === 0 ? -1 : 1, 0.1, 56 + i * 2.6);
    scene.add(post);
  }
  solids.push({ x: 0, z: 62, r: 1.3, tag: 'pier' });
}

function buildBoat(scene) {
  const group = new THREE.Group();
  group.position.set(3.2, 0.15, 64);
  group.rotation.y = 0.5;
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), stdMat(0x6e4634, { roughness: 0.68, side: THREE.DoubleSide }));
  hull.scale.set(1.05, 0.42, 2.3);
  group.add(hull);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.28), stdMat(0xc9a36a, { roughness: 0.6 }));
  seat.position.set(0, 0.28, 0.2);
  group.add(seat);
  scene.add(group);
  return group;
}

function buildClouds(scene, rng) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xfff8f2, roughness: 1, metalness: 0, transparent: true, opacity: 0.78, depthWrite: false, envMapIntensity: 0.1,
  });
  const clouds = [];
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(2.2 + rng() * 2.4, 8, 6), mat);
      s.position.set((rng() - 0.5) * 6, (rng() - 0.5) * 1.2, (rng() - 0.5) * 3);
      s.scale.y = 0.55;
      g.add(s);
    }
    g.position.set((rng() - 0.5) * 180, 42 + rng() * 16, (rng() - 0.5) * 160);
    g.userData.vx = 0.6 + rng() * 0.8;
    g.userData.noAO = true;
    scene.add(g);
    clouds.push(g);
  }
  return clouds;
}

function buildBirds(scene) {
  const bodyMat = stdMat(0x2c333c, { roughness: 0.5 });
  const wingMat = stdMat(0xf2efe8, { roughness: 0.6 });
  const birds = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), bodyMat);
    body.scale.set(0.7, 0.55, 1.4);
    g.add(body);
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.22), wingMat);
    wingL.position.set(-0.35, 0.05, 0);
    const wingR = wingL.clone();
    wingR.position.x = 0.35;
    g.add(wingL);
    g.add(wingR);
    g.userData.a = i * 1.3;
    g.userData.rad = 24 + i * 4;
    g.userData.y = 8 + (i % 3) * 1.4;
    g.userData.speed = 0.18 + i * 0.02;
    g.userData.noAO = true;
    scene.add(g);
    birds.push(g);
  }
  return birds;
}

function buildPetals(scene, rng) {
  const geo = new THREE.PlaneGeometry(0.16, 0.1);
  const mat = stdMat(0xf0a0b4, { roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const count = 36;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const speeds = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    dummy.position.set((rng() - 0.5) * 40, 2 + rng() * 6, 10 + (rng() - 0.5) * 30);
    dummy.rotation.set(rng(), rng(), rng());
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    speeds.push(0.25 + rng() * 0.45);
  }
  mesh.userData.speeds = speeds;
  mesh.userData.dummy = new THREE.Object3D();
  mesh.userData.noAO = true;
  scene.add(mesh);
  return mesh;
}

function buildInkPool(scene) {
  const g = GARDENS.find((d) => d.id === 'ink');
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), stdMat(0x1c2428, { roughness: 0.18, metalness: 0.55, env: 1 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(g.x - 2, g.ground + 0.08, g.z + 1);
  scene.add(pool);
}

function buildMirrorPool(scene) {
  const g = GARDENS.find((d) => d.id === 'mirror');
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 28), stdMat(0xd5e4ee, { roughness: 0.12, metalness: 0.7, env: 1.1 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(g.x, g.ground + 0.08, g.z + 1.5);
  scene.add(pool);
}
