import RAPIER from '@dimforge/rapier3d-compat';
import { requireAsset } from '../assets/binary';
import { Box3, Vector3 } from 'three';
import type { ScenePart } from '../assets/scene';
import { planSceneCollision } from '../assets/sceneCollision';
import { placementMatrix } from '../assets/placement';
/** Find a supported, upright capsule location on imported collision, preferring mesh/box surfaces. */
export function importedSpawn(world: RAPIER.World, parts: ScenePart[], handles: Set<number>, player: RAPIER.Collider, preferred?: { x:number; z:number }) {
  const plan = planSceneCollision(parts);
  if (preferred) requireAsset([preferred.x,preferred.z].every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7), 'Invalid preferred scene spawn.');
  const bounds: Box3[] = [];
  for (const [index, part] of parts.entries()) {
    if (!part.collision) continue;
    for (const placement of plan.placements[index]) bounds.push(new Box3(new Vector3(...part.collision.bounds.min), new Vector3(...part.collision.bounds.max)).applyMatrix4(placementMatrix(placement)));
  }
  const supported = (x:number,z:number,top:number,bottom:number) => {
    const hit = world.castRayAndGetNormal(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),top-bottom+1,true,undefined,undefined,player,undefined,c=>handles.has(c.handle));
    if (!hit || hit.normal.y<0.8 || hit.collider.shapeType()===RAPIER.ShapeType.Ball) return;
    const foot={x,y:top-hit.timeOfImpact+0.05,z};
    if (!world.intersectionWithShape({x,y:foot.y+0.9,z},{x:0,y:0,z:0,w:1},new RAPIER.Capsule(0.55,0.3),undefined,undefined,player)) return foot;
  };
  if (preferred && bounds.length) {
    const top=Math.max(...bounds.map(b=>b.max.y))+3,bottom=Math.min(...bounds.map(b=>b.min.y));
    const center=supported(preferred.x,preferred.z,top,bottom);if(center)return center;
    // Deterministic nearby search; every candidate must pass collision and capsule clearance.
    for(const radius of [0.5,1,2,4,8]) for(let i=0;i<8;i++) {
      const angle=i*Math.PI/4,foot=supported(preferred.x+Math.cos(angle)*radius,preferred.z+Math.sin(angle)*radius,top,bottom);
      if(foot)return foot;
    }
  }
  for (const bound of bounds) {
    for (const fx of [0.5,0.25,0.75,0.125,0.875]) for (const fz of [0.5,0.25,0.75,0.125,0.875]) {
      const foot=supported(bound.min.x+(bound.max.x-bound.min.x)*fx,bound.min.z+(bound.max.z-bound.min.z)*fz,bound.max.y+3,bound.min.y);
      if(foot)return foot;
    }
  }
  throw new Error('No clear supported spawn was found on the imported collision.');
}
