import * as THREE from 'three';
import { CharacterVisual } from './character';
import { angleDelta } from '../core/math';
import type { Population } from '../population/Population';

/** One articulated pose rig drives instanced body parts for the entire local crowd. */
export class CrowdVisual {
  readonly root = new THREE.Group();
  private rig = new CharacterVisual();
  private parts: THREE.Mesh[] = [];
  private batches: THREE.InstancedMesh[] = [];
  constructor(readonly population: Population) {
    this.root.name = 'Neighborhood population';
    this.rig.root.traverse(object => { if (object instanceof THREE.Mesh) this.parts.push(object); });
    const sourceMaterials = new Set<THREE.Material>();
    for (const part of this.parts) {
      const source = part.material as THREE.MeshLambertMaterial;
      sourceMaterials.add(source);
      const material = source.clone(); material.color.set(0xffffff);
      const batch = new THREE.InstancedMesh(part.geometry, material, population.pedestrians.length);
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      batch.castShadow = true; batch.receiveShadow = true;
      for (let i = 0; i < population.pedestrians.length; i++) {
        const appearance = population.pedestrians[i].appearance;
        const color = source.name === 'skin' ? appearance.skin : source.name === 'shirt' ? appearance.shirt : source.name === 'pants' ? appearance.pants : source.color.getHex();
        batch.setColorAt(i, new THREE.Color(color));
      }
      this.root.add(batch); this.batches.push(batch);
    }
    // The pose rig is never rendered; the scene owns its geometries through the batches.
    sourceMaterials.forEach(material => material.dispose());
  }
  update(alpha: number, elapsed: number) {
    for (let i = 0; i < this.population.pedestrians.length; i++) {
      const p = this.population.pedestrians[i];
      this.rig.root.position.set(THREE.MathUtils.lerp(p.previous.x, p.position.x, alpha),
        THREE.MathUtils.lerp(p.previous.y, p.position.y, alpha), THREE.MathUtils.lerp(p.previous.z, p.position.z, alpha));
      this.rig.root.rotation.y = p.previousHeading + angleDelta(p.previousHeading, p.heading) * alpha;
      this.rig.root.scale.set(p.appearance.width, p.appearance.height, p.appearance.width);
      this.rig.animate(p.phase, p.speed * 1.6, p.grounded, elapsed + i);
      this.rig.root.updateMatrixWorld(true);
      for (let j = 0; j < this.parts.length; j++) this.batches[j].setMatrixAt(i, this.parts[j].matrixWorld);
    }
    for (const batch of this.batches) {
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingSphere();
    }
  }
}
