import { MeshBasicMaterial, type GeometryGroup } from 'three';

export interface BuildingAlphaPolicy { enabled: boolean; threshold: number }

/** Keep the two complementary draws adjacent within each native mesh's queue position. */
export function buildingAlpha(material: MeshBasicMaterial, policy: BuildingAlphaPolicy) {
  material.userData.nativeDepthWrite = true;
  material.userData.nativeAlphaTest = material.alphaTest;
  const compile = material.onBeforeCompile, key = material.customProgramCacheKey;
  const highPasses = new WeakMap<MeshBasicMaterial, MeshBasicMaterial>();
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
    const split = policy.enabled && current.transparent && write;
    if (!!current.userData.nativeDualActive !== split) { current.userData.nativeDualActive = split; current.needsUpdate = true; }
    current.alphaTest = split ? policy.threshold / 255 : write ? current.userData.nativeAlphaTest : 0;
    current.depthWrite = write;
    if (!split) return;
    let high = highPasses.get(current);
    if (!high) {
      high = new MeshBasicMaterial(); highPasses.set(current,high);
      const owned = high;
      const dispose = () => { owned.dispose(); highPasses.delete(current); current.removeEventListener('dispose',dispose); };
      current.addEventListener('dispose',dispose);
    }
    high.copy(current); high.userData.nativeDualHigh = true;
    high.onBeforeCompile = current.onBeforeCompile; high.customProgramCacheKey = current.customProgramCacheKey;
    renderer.renderBufferDirect(camera,scene,geometry,high,object,group as unknown as GeometryGroup);
    current.depthWrite = false;
  };
}
