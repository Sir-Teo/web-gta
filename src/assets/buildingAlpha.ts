import { MeshBasicMaterial, type GeometryGroup } from 'three';

export interface BuildingAlphaPolicy { enabled: boolean; threshold: number }
/** Whether buildings may draw their alpha in two passes (SkyGFX's PS2 dual pass: the texels at or over the threshold with
 * depth, then the rest without). The mobile ports' shaders alpha-test in one pass, a `discard` under a fixed reference
 * and no second draw, so a touch screen draws one (setBuildingDualPass): around Grove Street the second pass is 80 to
 * 190 of a frame's 400 to 1000 draws, and at a phone's size its edges are all it changes. */
let dualPassAllowed = true;
export function setBuildingDualPass(allowed: boolean) { dualPassAllowed = allowed; }

/** Keep the two complementary draws adjacent within each native mesh's queue position. */
export function buildingAlpha(material: MeshBasicMaterial, policy: BuildingAlphaPolicy) {
  material.userData.nativeDepthWrite = true;
  material.userData.nativeAlphaTest = material.alphaTest;
  const compile = material.onBeforeCompile, key = material.customProgramCacheKey;
  /** Per source material: its high pass, and the source version and userData it was last fully copied from. */
  const highPasses = new WeakMap<MeshBasicMaterial, {material:MeshBasicMaterial;version:number;userData?:Record<string,unknown>}>();
  material.onBeforeCompile = function(shader, renderer) {
    compile.call(this, shader, renderer);
    if (this.userData.nativeDualActive && !this.userData.nativeDualHigh) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', this.alphaTest === 0
        ? 'discard;'
        : 'if (diffuseColor.a >= alphaTest) discard;');
    }
  };
  material.customProgramCacheKey = function() {
    return `${key.call(this)}-${this.userData.nativeDualActive && !this.userData.nativeDualHigh ? (this.alphaTest === 0 ? 'low-zero' : 'low') : 'ordinary'}`;
  };
  material.onBeforeRender = function(renderer, scene, camera, geometry, object, group) {
    const current = this as MeshBasicMaterial;
    if (!Number.isInteger(policy.threshold) || policy.threshold < 0 || policy.threshold > 255) throw new Error('Building alpha threshold must be a byte.');
    const write = current.userData.nativeDepthWrite !== false;
    const split = dualPassAllowed && policy.enabled && current.transparent && write;
    if (!!current.userData.nativeDualActive !== split) { current.userData.nativeDualActive = split; current.needsUpdate = true; }
    current.alphaTest = split ? policy.threshold / 255 : write ? current.userData.nativeAlphaTest : 0;
    current.depthWrite = write;
    if (!split) return;
    let pass = highPasses.get(current);
    if (!pass) {
      pass = {material:new MeshBasicMaterial(),version:-1}; highPasses.set(current,pass);
      const owned = pass.material;
      const dispose = () => { owned.dispose(); highPasses.delete(current); current.removeEventListener('dispose',dispose); };
      current.addEventListener('dispose',dispose);
    }
    const high = pass.material;
    if (pass.version !== current.version || pass.userData !== current.userData) {
      // A full copy only when the source changed (needsUpdate or a new userData). Material.copy deep-copies userData
      // through JSON, which on every draw would also serialise any texture it holds (nativeEnv); the high pass reads
      // the source's userData live through its prototype instead.
      const data = current.userData; current.userData = {};
      try { high.copy(current); } finally { current.userData = data; }
      high.userData = Object.assign(Object.create(data), {nativeDualHigh: true});
      high.onBeforeCompile = current.onBeforeCompile; high.customProgramCacheKey = current.customProgramCacheKey;
      high.needsUpdate = true; pass.version = current.version; pass.userData = data;
    } else {
      // What changes between draws without a version bump: this hook's alpha test and depth write, and the placement
      // fades' opacity, visibility and transparency (placementFade.ts).
      high.alphaTest = current.alphaTest; high.depthWrite = current.depthWrite; high.opacity = current.opacity;
      high.transparent = current.transparent; high.visible = current.visible;
    }
    renderer.renderBufferDirect(camera,scene,geometry,high,object,group as unknown as GeometryGroup);
    current.depthWrite = false;
  };
}
