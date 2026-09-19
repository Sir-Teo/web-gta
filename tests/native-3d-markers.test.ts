import {expect,test} from 'vitest';
import {Native3dMarkers,MARKER3D,MAX_3D_MARKERS,type Marker3dContext} from '../src/world/native3dMarkers';

const ctx=(over:Partial<Marker3dContext>={}):Marker3dContext=>({player:[0,0,0],timeMs:0,timeStep:1,roofAt:()=>undefined,radius:1,...over});
const camera:[number,number,number]=[0,-20,5];
const all=()=>true;

test('an entry exit cone bobs 0.3 units, shrinks up close and is drawn opaque until it is no longer placed', () => {
 const m=new Native3dMarkers();
 // First frame: a new marker at the raw size, bobbing by sin(angle × 0.3) (the reversed first-frame bug).
 const first=m.placeMarkerCone(7,[0,30,10],2,255,255,0,255,1024,1,5,false,camera,ctx({player:[0,0,0]}))!;
 expect(first.type).toBe(MARKER3D.coneNoCollision);expect(first.rotateRate).toBe(0);expect(first.size).toBe(2);expect(first.position[2]).toBe(10);
 m.update(1);expect(m.angleDiamondDeg).toBe(5);
 expect(m.render(all).map(d=>d.color)).toEqual([[255,255,0,255]]);
 // Next frame the same slot bobs by sin(5°) × 0.3 and scales for the 30-unit 2D distance (no shrink beyond 25).
 const again=m.placeMarkerCone(7,[0,30,10],2,255,255,0,255,1024,1,5,false,camera,ctx())!;
 expect(again).toBe(first);expect(again.position[2]).toBeCloseTo(10+Math.sin(5*Math.PI/180)*.3);expect(again.size).toBe(2);
 // The same alpha twice in a row is nudged by one.
 m.update(1);expect(m.render(all)[0].color[3]).toBe(254);
 // Within 5 units it is 70% of its size, and its alpha fades to 0.65 (drawn opaque anyway).
 const near=m.placeMarkerCone(7,[0,3,10],2,255,255,0,255,1024,1,5,false,camera,ctx())!;
 expect(near.size).toBeCloseTo(1.4);expect(near.color[3]).toBe(165);
 m.update(1);expect(m.render(all)[0].color[3]).toBe(255);
 // Not placed: it loses its object at the next render and the slot frees.
 m.update(1);expect(m.render(all)).toEqual([]);expect(first.id).toBe(0);expect(first.hasAtomic).toBe(false);
});

test('cones under a roof sit half size just below it; none are placed next to the camera', () => {
 const m=new Native3dMarkers(),roof=ctx({roofAt:(a,b)=>{expect(b[2]-a[2]).toBe(1.5);return 11;},radius:.5});
 m.placeMarkerCone(3,[0,30,10],2,255,255,0,255,1024,1,5,true,camera,roof);m.update(1);m.render(all);
 // The roof test waits two seconds after creation.
 const early=m.placeMarkerCone(3,[0,30,10],2,255,255,0,255,1024,1,5,true,camera,{...roof,timeMs:1999})!;expect(early.roofHeight).toBe(65535);m.update(1);m.render(all);
 const late=m.placeMarkerCone(3,[0,30,10],2,255,255,0,255,1024,1,5,true,camera,{...roof,timeMs:2000})!;
 expect(late.type).toBe(MARKER3D.cone);expect(late.size).toBe(1);expect(late.position[2]).toBeCloseTo(11-.05+Math.sin(10*Math.PI/180)*.15);
 expect(m.placeMarkerCone(4,[0,-20,6],2,255,255,0,255,1024,1,5,true,camera,roof)).toBeUndefined();
});

test('with every slot taken, the reusable marker furthest from the player is replaced', () => {
 const m=new Native3dMarkers();
 for(let i=0;i<MAX_3D_MARKERS;i++)m.placeMarkerCone(i+1,[0,10+i,0],2,255,255,0,255,1024,1,5,false,camera,ctx());
 const replaced=m.placeMarkerCone(99,[0,5,0],2,255,255,0,255,1024,1,5,false,camera,ctx())!;
 expect(replaced).toBe(m.markers[MAX_3D_MARKERS-1]);expect(replaced.id).toBe(99);
 // Beyond 150 units from the player, or off screen, an active marker is not drawn but keeps its slot.
 const far=new Native3dMarkers();far.placeMarkerCone(1,[0,200,0],2,255,255,0,255,1024,1,5,false,camera,ctx());far.update(1);
 expect(far.render(all)).toEqual([]);expect(far.numActiveMarkers).toBe(1);expect(far.markers[0].id).toBe(1);
});
