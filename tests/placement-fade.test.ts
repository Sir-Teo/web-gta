import { expect, test, vi } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Texture } from 'three';
import { placementFade } from '../src/render/placementFade';
import { distanceFadeAlpha } from '../src/render/distanceFade';

test('source distance alpha uses the 20-unit band and expands width for unparented long-range models', () => {
  expect([99, 100, 110, 120, 130].map(d => distanceFadeAlpha(d, 100, 100, true))).toEqual([255,255,127,0,0]);
  expect(distanceFadeAlpha(290, 300, 300, false)).toBe(255);
  expect(distanceFadeAlpha(300, 300, 300, false)).toBe(170);
  expect(distanceFadeAlpha(300, 300, 300, true)).toBe(255);
  expect(distanceFadeAlpha(110, 100, 500, false)).toBe(127);
});

test('placement fades cap material alpha without touching siblings, reuse copies and restore ownership', () => {
  const geometry = new BoxGeometry(), texture = new Texture(), material = new MeshBasicMaterial({ opacity: .5, alphaTest: .4, map: texture });
  material.userData.nativeFadeColor = [.2,.3,.4];
  const a = new Mesh(geometry, material), b = new Mesh(geometry, material), root = new Group(); root.add(a);
  const fade = placementFade(root), originalDispose = vi.fn(), textureDispose = vi.fn(); material.addEventListener('dispose', originalDispose); texture.addEventListener('dispose', textureDispose);
  fade.setAlpha(200); const faded = a.material;
  expect(faded).not.toBe(material); expect(b.material).toBe(material); expect(material.opacity).toBe(.5);
  expect(faded.opacity).toBe(.5); expect(faded.transparent).toBe(true); expect(faded.depthWrite).toBe(material.depthWrite); expect(faded.alphaTest).toBe(0); expect(faded.map).toBe(texture);
  expect(faded.color.toArray()).toEqual([.2,.3,.4]);
  fade.setAlpha(64); expect(a.material).toBe(faded); expect(faded.opacity).toBe(64/255);
  fade.setAlpha(255); expect(a.material).toBe(material);
  fade.setAlpha(255, true); expect(a.material).toBe(faded);
  const disposed = vi.fn(); faded.addEventListener('dispose', disposed); fade.dispose(); fade.dispose();
  expect(a.material).toBe(material); expect(disposed).toHaveBeenCalledTimes(1); expect(originalDispose).not.toHaveBeenCalled(); expect(textureDispose).not.toHaveBeenCalled();
  geometry.dispose(); material.dispose(); texture.dispose();
});

test('material arrays share fade copies within a placement and retain custom shader callbacks', () => {
  const material = new MeshBasicMaterial(), geometry = new BoxGeometry(), root = new Group();
  const callback = () => {}; material.onBeforeCompile = callback;
  const a = new Mesh(geometry, [material,material]), b = new Mesh(geometry, material); root.add(a,b);
  const fade = placementFade(root); expect(()=>fade.setAlpha(NaN)).toThrow('byte'); fade.setAlpha(100);
  expect(a.material[0]).toBe(a.material[1]); expect(b.material).toBe(a.material[0]); expect(b.material.onBeforeCompile).toBe(callback);
  fade.dispose(); expect(a.material).toEqual([material,material]); geometry.dispose(); material.dispose();
});
