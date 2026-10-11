import { expect, test, vi } from 'vitest';
import { AdditiveBlending, DoubleSide, FrontSide, Group, Mesh, BoxGeometry, MeshBasicMaterial, NormalBlending, Texture } from 'three';
import { placementFade, persistentNormalMaterials } from '../src/render/placementFade';
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
  fade.setAlpha(255); expect(mesh.material).toBe(normal); expect(normal.side).toBe(DoubleSide); expect(normal.blending).toBe(NormalBlending); expect(normal.depthWrite).toBe(false); fade.dispose(); expect(mesh.material).toBe(material);
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

test('draw-last normal materials apply queue alpha/depth policy and restore render order', () => {
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial(), mesh = new Mesh(geometry,material); mesh.renderOrder = 7;
  const outdoor = placementFade(mesh,4); expect(mesh.material.transparent).toBe(true); expect(mesh.material.alphaTest).toBe(100/255); expect(mesh.material.depthWrite).toBe(true);
  outdoor.setDistance(20); expect(mesh.renderOrder).toBe(-20); outdoor.setAlpha(100); outdoor.setDistance(12); expect(mesh.material.alphaTest).toBe(0); expect(mesh.renderOrder).toBe(-12);
  outdoor.setAlpha(255); expect(mesh.material.alphaTest).toBe(100/255); outdoor.dispose(); expect(mesh.renderOrder).toBe(7); expect(mesh.material).toBe(material);
  const indoor = placementFade(mesh,4,1); expect(mesh.material.alphaTest).toBe(0); indoor.dispose();
  const noZ = placementFade(mesh,4|0x40); expect(mesh.material.alphaTest).toBe(0); expect(mesh.material.depthWrite).toBe(false); noZ.dispose();
  const ordinary = placementFade(mesh); ordinary.setAlpha(100); ordinary.setDistance(20); expect(mesh.renderOrder).toBe(-20); ordinary.setAlpha(255); ordinary.setDistance(20); expect(mesh.renderOrder).toBe(7);
  expect(()=>ordinary.setDistance(NaN)).toThrow('render distance'); ordinary.dispose(); geometry.dispose(); material.dispose();
});

test('placements of one model share their flag-dependent normal copies and only the owner disposes them', () => {
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial(), shared = new Map();
  const a = new Mesh(geometry, material), b = new Mesh(geometry, material);
  const fa = placementFade(a, 4, 0, true, shared), fb = placementFade(b, 4, 0, true, shared);
  expect(a.material).not.toBe(material); expect(b.material).toBe(a.material); expect(shared.size).toBe(1);
  let disposed = 0; (a.material as MeshBasicMaterial).addEventListener('dispose', () => disposed++);
  fa.dispose(); fb.dispose(); expect(disposed).toBe(0); expect(a.material).toBe(material); expect(b.material).toBe(material);
  shared.forEach(m => m.dispose()); expect(disposed).toBe(1);
  // Without a shared map each placement still owns its own copies.
  const own = placementFade(a, 4, 0, true); expect(a.material).not.toBe(material); let ownDisposed = 0; (a.material as MeshBasicMaterial).addEventListener('dispose', () => ownDisposed++); own.dispose(); expect(ownDisposed).toBe(1);
});

test('persistent normal copies outlive the window that made them and go with their source material', () => {
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  const placed = (interior: number) => { const root = new Group(), mesh = new Mesh(geometry, material); root.add(mesh); return { root, mesh }; };
  const first = placed(0), window = placementFade(first.root, 0x4, 0, true, persistentNormalMaterials(0x4, 0));
  const normal = first.mesh.material as MeshBasicMaterial, disposed = vi.fn(); normal.addEventListener('dispose', disposed);
  expect(normal).not.toBe(material); expect(normal.transparent).toBe(true);
  window.dispose(); expect(first.mesh.material).toBe(material); expect(disposed).not.toHaveBeenCalled();
  // The next window reuses the copy for the same flags and area; another area gets its own.
  const second = placed(0), next = placementFade(second.root, 0x4, 0, true, persistentNormalMaterials(0x4, 0));
  expect(second.mesh.material).toBe(normal);
  const inside = placed(3); placementFade(inside.root, 0x4, 3, true, persistentNormalMaterials(0x4, 3));
  expect(inside.mesh.material).not.toBe(normal);
  next.dispose(); material.dispose(); expect(disposed).toHaveBeenCalledTimes(1); geometry.dispose();
});

test('a faded copy of an env-mapped material keeps the source\'s env data, not a JSON copy of its texture', () => {
  const geometry = new BoxGeometry(), env = new Texture(), material = new MeshBasicMaterial();
  material.userData.nativeEnv = { map: env, coefficient: .5, fbAlpha: false, shininess: 1 };
  const a = new Mesh(geometry, material), root = new Group(); root.add(a);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const fade = placementFade(root); fade.setAlpha(100);
  expect(warn).not.toHaveBeenCalled(); warn.mockRestore();
  expect(a.material).not.toBe(material);
  expect((a.material as MeshBasicMaterial).userData.nativeEnv).toBe(material.userData.nativeEnv);
  expect(material.userData.nativeEnv.map).toBe(env);
  fade.dispose(); geometry.dispose(); material.dispose(); env.dispose();
});
