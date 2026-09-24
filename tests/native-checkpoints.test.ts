import {expect,test} from 'vitest';
import {CHECKPOINT,NativeCheckpoints} from '../src/world/nativeCheckpoints';
import {MARKER3D,Native3dMarkers,type Marker3dContext} from '../src/world/native3dMarkers';
import {ScmCheckpoints} from '../src/engine/ScmCheckpoints';

const ctx=(player:[number,number,number]):Marker3dContext=>({player,timeMs:0,timeStep:1,roofAt:()=>undefined,radius:1,groundZ:()=>10,collisionLoaded:()=>true});

test('a script tube is a red CCheckpoint drawn as a tube 1.5 times its size with a direction arrow above it',()=>{
 const scripts=new ScmCheckpoints(),handle=scripts.create(CHECKPOINT.tube,{x:0,y:50,z:12},{x:0,y:100,z:12},4);
 const cp=scripts.markers.checkpoints.find(c=>c.id===handle)!;
 expect(cp).toMatchObject({type:CHECKPOINT.tube,used:true,colour:[255,0,0,32],size:4,pulsePeriod:1024,rotateRate:0});
 expect(cp.fwd[1]).toBeCloseTo(1);
 const markers=new Native3dMarkers();
 scripts.markers.render(markers,ctx([0,0,0]),()=>undefined);
 const tube=markers.markers.find(m=>m.inUse)!;
 expect(tube.type).toBe(MARKER3D.tube);expect(tube.size).toBe(6);expect(tube.position[2]).toBe(12);
 // From the next frame the z check snaps it 10/20 below the ground.
 markers.update(1);markers.render(()=>true);markers.drawDirectionArrows();
 scripts.markers.render(markers,ctx([0,0,0]),()=>undefined);expect(tube.position[2]).toBeCloseTo(9.5);
 const arrows=markers.drawDirectionArrows();
 expect(arrows).toHaveLength(1);expect(arrows[0]).toMatchObject({position:[0,50,15],size:2.5,color:[255,64,64,255]});expect(arrows[0].normal[1]).toBeCloseTo(-1);
 expect(markers.drawDirectionArrows()).toHaveLength(0);
 // Moving and deleting go through the handle.
 scripts.setCoords(handle,{x:5,y:60,z:13});expect(cp.pos).toEqual([5,60,13]);
 scripts.remove(handle);expect(cp).toMatchObject({used:false,type:CHECKPOINT.na,id:0});
});
test('an up-down ring bobs a frame at a time, and falls while the player stands in it',()=>{
 const cps=new NativeCheckpoints();let player:[number,number,number]=[100,100,0];cps.player=()=>player;
 const cp=cps.placeMarker(9,CHECKPOINT.torusUpDown,[0,0,20],[0,10,20],3,[255,0,0,96],1024,.075,0)!;
 cps.update();expect(cp.multiSize).toBeCloseTo(.02);expect(cp.pos[2]).toBeCloseTo(20.02);
 player=[1,1,0];cps.update();expect(cp.type).toBe(CHECKPOINT.torusDown);expect(cp.pos[2]).toBeCloseTo(19.92);
 player=[100,100,0];cps.update();expect(cp.type).toBe(CHECKPOINT.torusUpDown);expect(cp.multiSize).toBeCloseTo(.02);
});
test('a fading ring hides within twice its size and a fly-through ring draws four fading copies',()=>{
 const cps=new NativeCheckpoints();cps.player=()=>[0,0,0];
 cps.placeMarker(3,CHECKPOINT.torus,[4,0,0],[4,10,0],3,[255,0,0,96],1024,.075,0);
 const m=new Native3dMarkers();cps.render(m,ctx([0,0,0]),()=>undefined);expect(m.markers.filter(x=>x.inUse)).toHaveLength(0);
 const through=cps.placeMarker(4,CHECKPOINT.torusThrough,[0,20,0],[0,30,0],3,[255,0,0,96],1024,.075,0)!;through.multiSize=.5;
 cps.render(m,ctx([0,0,0]),()=>undefined);
 const rings=m.markers.filter(x=>x.inUse);expect(rings).toHaveLength(4);
 expect(rings.map(r=>r.position[1]).sort((a,b)=>a-b)).toEqual([20,20.5,21,21.5]);
});
