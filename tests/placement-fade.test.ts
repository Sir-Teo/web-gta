import { expect, test, vi } from 'vitest';
import { AdditiveBlending, DoubleSide, FrontSide, Group, Mesh, BoxGeometry, MeshBasicMaterial, NormalBlending, Texture } from 'three';
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

test('IDE fade flags select additive blending, depth-write suppression and single-pass two-sided rendering', () => {
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial(), mesh = new Mesh(geometry,material);
  const fade = placementFade(mesh, 0x8 | 0x40 | 0x200000), normal = mesh.material; fade.setAlpha(100);
  expect(mesh.material.blending).toBe(AdditiveBlending); expect(mesh.material.depthWrite).toBe(false);
  expect(mesh.material.side).toBe(DoubleSide); expect(mesh.material.forceSinglePass).toBe(true);
  expect(material.blending).toBe(NormalBlending); expect(material.depthWrite).toBe(true); expect(material.side).toBe(FrontSide);
  fade.setAlpha(255); expect(mesh.material).toBe(normal); expect(normal.side).toBe(DoubleSide); expect(normal.blending).toBe(NormalBlending); expect(normal.depthWrite).toBe(true); fade.dispose(); expect(mesh.material).toBe(material);
  const unrelated = placementFade(mesh, 0x1000); unrelated.setAlpha(100);
  expect(mesh.material.blending).toBe(NormalBlending); expect(mesh.material.depthWrite).toBe(true); expect(mesh.material.side).toBe(FrontSide);
  unrelated.dispose(); geometry.dispose(); material.dispose();
});

test('two-sided normal copies preserve appearance, share within a placement and dispose independently of originals', () => {
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial({ opacity: .6, alphaTest: .3 });
  const root = new Group(), a = new Mesh(geometry,[material,material]), b = new Mesh(geometry,material), sibling = new Mesh(geometry,material); root.add(a,b);
  const owner = placementFade(root,0x200000), normal = b.material;
  expect(normal).toBe(a.material[0]); expect(normal).toBe(a.material[1]); expect(sibling.material).toBe(material);
  expect(normal.opacity).toBe(.6); expect(normal.alphaTest).toBe(.3); expect(normal.transparent).toBe(false);
  const normalDisposed = vi.fn(); normal.addEventListener('dispose', normalDisposed);
  owner.setAlpha(70); const faded = b.material, fadedDisposed = vi.fn(); faded.addEventListener('dispose',fadedDisposed);
  owner.setAlpha(255); expect(b.material).toBe(normal); owner.setAlpha(70); expect(b.material).toBe(faded);
  owner.dispose(); owner.dispose(); expect(b.material).toBe(material); expect(normalDisposed).toHaveBeenCalledTimes(1); expect(fadedDisposed).toHaveBeenCalledTimes(1);
  geometry.dispose(); material.dispose();
});
