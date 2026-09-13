import * as THREE from 'three';
import { placementFade } from '../../src/render/placementFade';

Object.assign(window, { fadeProbe: () => {
  const renderer = new THREE.WebGLRenderer({ antialias: false }); renderer.setSize(64,64); renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  document.body.append(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1,1,1,-1,.1,10); camera.position.z = 5;
  const geometry = new THREE.PlaneGeometry(.8,1.5), material = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 128/255, transparent: true, alphaTest: .25 });
  const left = new THREE.Mesh(geometry,material), right = new THREE.Mesh(geometry,material); left.position.x = -.5; right.position.x = .5; scene.add(left,right);
  const fade = placementFade(left), gl = renderer.getContext();
  function pixels() {
    renderer.render(scene,camera);
    return [16,48].map(x => { const pixel = new Uint8Array(4); gl.readPixels(x,32,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel); return [...pixel]; });
  }
  const original = pixels(); fade.setAlpha(64); const partial = pixels();
  fade.setAlpha(200); const capped = pixels(); fade.setAlpha(255); const restored = pixels();
  fade.dispose();
  material.opacity = 1; material.transparent = false; material.userData.nativeFadeColor = [.5,.5,.5]; material.needsUpdate = true;
  const forced = placementFade(left); forced.setAlpha(255,true); const modulation = pixels(); forced.dispose(); const unmodulated = pixels();
  geometry.dispose(); material.dispose(); renderer.dispose(); renderer.domElement.remove();
  return { original, partial, capped, restored, modulation, unmodulated };
} });
