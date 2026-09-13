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
  delete material.userData.nativeFadeColor; material.color.setRGB(1,0,0); right.visible = false;
  renderer.setClearColor(new THREE.Color().setRGB(.25,.25,.25));
  function flagged(flags: number) { const owner = placementFade(left,flags); owner.setAlpha(128); const result = pixels()[0]; owner.dispose(); return result; }
  const normalBlend = flagged(0), additive = flagged(0x8);
  left.rotation.y = Math.PI;
  const culled = flagged(0), twoSided = flagged(0x200000);
  const persistent = placementFade(left,0x200000), twoSidedFull = pixels()[0]; persistent.setAlpha(128); pixels(); persistent.setAlpha(255); const twoSidedRestored = pixels()[0]; persistent.dispose(); left.rotation.y = 0;
  renderer.setClearColor(0x000000);
  const backMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true });
  const back = new THREE.Mesh(geometry,backMaterial); back.position.set(-.5,0,-1); back.renderOrder = 1; scene.add(back);
  const depthWrite = flagged(0), noDepthWrite = flagged(0x40); scene.remove(back);
  material.opacity = 64/255;
  const outdoors = placementFade(left,4), outdoorAlpha = pixels()[0]; outdoors.dispose();
  const indoors = placementFade(left,4,1), indoorAlpha = pixels()[0]; indoors.dispose();
  const noZNormal = placementFade(left,4|0x40), noZAlpha = pixels()[0]; noZNormal.dispose();
  material.opacity = 128/255; backMaterial.opacity = 128/255; scene.add(back);
  const redOrder = placementFade(left,4|0x40), greenOrder = placementFade(back,4|0x40);
  redOrder.setDistance(20); greenOrder.setDistance(10); const radialOrder = pixels()[0];
  redOrder.setDistance(5); greenOrder.setDistance(10); const reversedOrder = pixels()[0];
  redOrder.dispose(); greenOrder.dispose(); scene.remove(back); backMaterial.dispose();
  geometry.dispose(); material.dispose(); renderer.dispose(); renderer.domElement.remove();
  return { original, partial, capped, restored, modulation, unmodulated, flags: { normalBlend, additive, culled, twoSided, twoSidedFull, twoSidedRestored, depthWrite, noDepthWrite, outdoorAlpha, indoorAlpha, noZAlpha, radialOrder, reversedOrder } };
} });
