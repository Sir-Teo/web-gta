import {expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {installRapierTombstones,tombstoneLog} from '../src/simulation/rapierTombstones';
test('a removed body answers as a tombstone and the world keeps working',async()=>{
 await RAPIER.init();installRapierTombstones(RAPIER);
 const warnings:string[]=[];tombstoneLog.warn=m=>{warnings.push(m);};
 const world=new RAPIER.World({x:0,y:-9.81,z:0});
 const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(1,2,3));
 const collider=world.createCollider(RAPIER.ColliderDesc.ball(.5),body);
 const other=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,5,0));world.createCollider(RAPIER.ColliderDesc.ball(.5),other);
 world.step();
 world.removeRigidBody(body);
 // Stale reads give the last pose and no speed; setters do nothing; questions answer no.
 expect(body.translation()).toMatchObject({x:1,z:3});expect(body.linvel()).toEqual({x:0,y:0,z:0});
 expect(body.isValid()).toBe(false);expect(body.isEnabled()).toBe(false);
 body.setEnabled(true);body.setTranslation({x:9,y:9,z:9},true);
 expect(collider.isValid()).toBe(false);expect(collider.parent()).toBeNull();
 // Removing it again is harmless, and the rest of the world still steps and answers.
 world.removeRigidBody(body);
 for(let i=0;i<10;i++)world.step();
 expect(other.translation().y).toBeLessThan(5);
 expect(warnings.length).toBeGreaterThan(0);expect(warnings[0]).toContain('Removed Rapier body used');
});
