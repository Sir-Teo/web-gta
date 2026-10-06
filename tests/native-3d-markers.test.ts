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
 // The iOS Render draws a cone opaque every frame (PC's s_SavedAlpha nudge is not there).
 m.update(1);expect(m.render(all)[0].color[3]).toBe(255);
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

test('a contact-point cylinder sits size/20 below the ground once per map square, or on the water above it', () => {
 const m=new Native3dMarkers();let reads=0;
 const c=ctx({player:[100,200,0],groundZ:(_x,_y,z)=>{reads++;expect(z).toBe(21);return 12;},collisionLoaded:()=>true});
 // PlaceMarkerSet: a third of the alpha (228 → 76), faded to 0.65 with the player inside it, and rotate rate 1.
 const made=m.placeMarkerSet(5,MARKER3D.cylinder,[100.5,200.5,20],2,255,0,0,228,2048,.2,c)!;
 expect(made.type).toBe(MARKER3D.cylinder);expect(made.rotateRate).toBe(1);expect(made.color[3]).toBe(49);
 expect(made.position[2]).toBeCloseTo(12-2/20);expect([made.lastMapReadX,made.lastMapReadY]).toEqual([100,200]);
 m.update(1);expect(m.render(all)).toHaveLength(1);
 // Placed again at the same square the ground is not read again and the height sticks.
 const again=m.placeMarkerSet(5,MARKER3D.cylinder,[100.7,200.2,20],2,255,0,0,228,2048,.2,c)!;
 expect(again).toBe(made);expect(reads).toBe(1);expect(again.position[2]).toBeCloseTo(11.9);expect(again.heading).toBeCloseTo(Math.PI/180);
 // Over water higher than the marker, it floats on the flat water level instead.
 const wet=new Native3dMarkers().placeMarkerSet(6,MARKER3D.cylinder,[0,0,1],2,255,0,0,228,2048,.2,ctx({waterNoWaves:()=>3,groundZ:()=>-5,collisionLoaded:()=>true}))!;
 expect(wet.position[2]).toBe(3);
 // Without collision the height stays and the square is not marked read.
 const unloaded=new Native3dMarkers().placeMarkerSet(7,MARKER3D.cylinder,[0,0,9],2,255,0,0,228,2048,.2,ctx({groundZ:()=>0,collisionLoaded:()=>false}))!;
 expect(unloaded.position[2]).toBe(9);expect(unloaded.lastMapReadX).toBe(30000);
});
test('a full marker array replaces a far arrow for a cone but refuses a cylinder, and a torus keeps its first height', () => {
 const m=new Native3dMarkers(),c=ctx();
 for(let i=0;i<MAX_3D_MARKERS;i++)m.placeMarkerCone(100+i,[i*10,50,0],1,255,255,255,255,1024,1,5,true,camera,c);
 expect(m.placeMarkerSet(999,MARKER3D.cylinder,[0,0,0],2,255,0,0,228,2048,.2,c)).toBeUndefined();
 expect(m.placeMarkerCone(998,[0,0,5],1,255,255,255,255,1024,1,5,true,camera,c)?.id).toBe(998);
 const t=new Native3dMarkers();
 const ring=t.placeMarker(3,MARKER3D.torus,[0,0,40],4,255,255,255,200,1024,.1,0,c,[0,1,0])!;
 expect(ring.normal).toEqual([0,1,0]);
 t.update(1);t.render(all);
 const moved=t.placeMarker(3,MARKER3D.torus,[5,6,70],4,255,255,255,200,1024,.1,0,c,[0,1,0])!;
 expect(moved.position).toEqual([5,6,40]);
 // A tube counts a quarter of its distance for its fade.
 const tube=t.placeMarker(4,MARKER3D.tube,[0,40,0],1,255,255,255,128,1024,.1,1,c)!;expect(tube.distToCam2D).toBe(10);
});
