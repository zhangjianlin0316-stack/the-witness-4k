import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const PRESETS = {
  low: { pr: (d) => Math.min(1, d), shadow: 1024, bloom: false, ssao: false, samples: 0, exposure: 1.02, bloomStrength: 0 },
  medium: { pr: (d) => Math.min(1.25, d), shadow: 2048, bloom: true, ssao: false, samples: 2, exposure: 0.98, bloomStrength: 0.12 },
  high: { pr: (d) => Math.min(1.75, d), shadow: 4096, bloom: true, ssao: true, samples: 4, exposure: 1.0, bloomStrength: 0.16 },
  ultra: { pr: (d) => d, shadow: 8192, bloom: true, ssao: true, samples: 4, exposure: 1.02, bloomStrength: 0.18 },
};

export function createPipeline(renderer, scene, camera, sun) {
  const maxTex = renderer.capabilities.maxTextureSize || 4096;
  let composer = null;
  let bloom = null;
  let current = 'medium';
  let useFloat = true;

  function hideNoAO(hide) {
    const hidden = [];
    scene.traverse((obj) => {
      if (obj.userData && obj.userData.noAO && obj.visible) {
        hidden.push(obj);
        if (hide) obj.visible = false;
      }
    });
    return hidden;
  }

  function disposeComposer() {
    if (!composer) return;
    composer.renderTarget1?.dispose();
    composer.renderTarget2?.dispose();
    for (const pass of composer.passes) {
      if (pass.dispose) pass.dispose();
    }
    composer = null;
    bloom = null;
  }

  function build(name) {
    const preset = PRESETS[name] || PRESETS.medium;
    current = PRESETS[name] ? name : 'medium';
    const dpr = Math.max(0.5, preset.pr(window.devicePixelRatio || 1));
    const shadow = Math.min(preset.shadow, maxTex);
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight, true);
    renderer.toneMappingExposure = preset.exposure;
    sun.shadow.mapSize.set(shadow, shadow);
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
    disposeComposer();

    const size = renderer.getSize(new THREE.Vector2());
    const type = useFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
    let samples = preset.samples;
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x * dpr), Math.max(1, size.y * dpr), {
      type,
      samples,
      depthBuffer: true,
    });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(dpr);
    composer.setSize(size.x, size.y);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    if (preset.ssao) {
      const ssao = new SSAOPass(scene, camera, size.x, size.y);
      ssao.kernelRadius = name === 'ultra' ? 16 : 12;
      ssao.minDistance = 0.002;
      ssao.maxDistance = 0.16;
      const inner = ssao.render.bind(ssao);
      ssao.render = (rend, writeBuffer, readBuffer, delta, mask) => {
        const hidden = hideNoAO(true);
        inner(rend, writeBuffer, readBuffer, delta, mask);
        for (const obj of hidden) obj.visible = true;
      };
      composer.addPass(ssao);
    }

    if (preset.bloom) {
      bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), preset.bloomStrength, 0.35, 0.96);
      composer.addPass(bloom);
    }

    composer.addPass(new OutputPass());
    return preset;
  }

  function render() {
    try {
      composer.render();
    } catch (err) {
      if (useFloat) {
        useFloat = false;
        build(current);
        composer.render();
      } else {
        throw err;
      }
    }
  }

  function resize() {
    build(current);
  }

  function capture(width, height) {
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    const aspect = camera.aspect;
    const prevExposure = renderer.toneMappingExposure;
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    composer.setPixelRatio(1);
    composer.setSize(width, height);
    render();
    let url = '';
    let usedW = width;
    let usedH = height;
    try {
      url = renderer.domElement.toDataURL('image/png');
    } catch {
      url = '';
    }
    renderer.setPixelRatio(pr);
    renderer.setSize(size.x, size.y, false);
    renderer.toneMappingExposure = prevExposure;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    composer.setPixelRatio(pr);
    composer.setSize(size.x, size.y);
    return { url, width: usedW, height: usedH };
  }

  return { build, render, resize, capture, preset: () => current };
}
