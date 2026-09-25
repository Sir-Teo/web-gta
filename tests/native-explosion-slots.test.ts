import {expect,test} from 'vitest';
import {EXPLOSION,EXPLOSION_UNDEFINED,NativeExplosionSlots} from '../src/combat/nativeExplosion';
import {ScmGameState} from '../src/engine/ScmGameState';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {scmOpcode} from '../src/engine/scmOpcodes';

test('an explosion holds its slot for its type’s time, and a seventeenth at once is not made',()=>{
 const slots=new NativeExplosionSlots();
 expect(slots.add(EXPLOSION.car,{x:10,y:0,z:0},0)).toBe(true);
 // A car blast stays 4250 ms, a grenade 750.
 expect(slots.inArea(EXPLOSION.car,{x:9,y:-1,z:-1},{x:11,y:1,z:1})).toBe(true);
 expect(slots.inArea(EXPLOSION.grenade,{x:9,y:-1,z:-1},{x:11,y:1,z:1})).toBe(false);
 expect(slots.inArea(EXPLOSION_UNDEFINED,{x:9,y:-1,z:-1},{x:11,y:1,z:1})).toBe(true);
 // Faces count; outside does not.
 expect(slots.inArea(EXPLOSION.car,{x:10,y:0,z:0},{x:12,y:1,z:1})).toBe(true);
 expect(slots.inArea(EXPLOSION.car,{x:10.1,y:0,z:0},{x:12,y:1,z:1})).toBe(false);
 slots.expire(4249);expect(slots.count).toBe(1);
 slots.expire(4250);expect(slots.count).toBe(0);
 for(let i=0;i<16;i++)expect(slots.add(EXPLOSION.grenade,{x:i,y:0,z:0},5000)).toBe(true);
 expect(slots.add(EXPLOSION.grenade,{x:0,y:0,z:0},5000)).toBe(false);
 // Once the grenades have gone, there is room again.
 expect(slots.add(EXPLOSION.grenade,{x:0,y:0,z:0},5750)).toBe(true);
});

test('the camera and music settings are the engine’s own',()=>{
 const game=new ScmGameState(),out:number[]=[];
 const ins=(opcode:number,values:[number,boolean][])=>{const o=[opcode&0xff,opcode>>8&0xff];for(const [v,f] of values){const b=new Uint8Array(4),d=new DataView(b.buffer);if(f){d.setFloat32(0,v,true);o.push(6,...b);}else {d.setInt32(0,v,true);o.push(1,...b);}}return o;};
 out.push(...ins(scmOpcode('SET_INTERPOLATION_PARAMETERS'),[[30,true],[2000,false]]),...ins(scmOpcode('SET_MUSIC_DOES_FADE'),[[0,false]]));
 const space=new Uint8Array(128);space.set(out,0);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as unknown as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(0,2);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 expect(game.camera.scriptParametersSetForInterp).toBe(true);
 expect(game.camera.scriptPercentageInterToStopMoving).toBeCloseTo(.3,6);
 expect(game.camera.scriptPercentageInterToCatchUp).toBeCloseTo(.7,6);
 expect(game.camera.scriptTimeForInterpolation).toBe(2000);
 expect(game.camera.ignoreFadingStuffForMusic).toBe(true);
});
