import {expect,test} from 'vitest';
import {NativeOcclusion,calcScreenCoors,doesInfiniteLineTouchScreen,isPointInsideLine,processOneOccluder,setRotate,screenScales,type OcclusionCamera} from '../src/world/nativeOcclusion';
import {readIpl} from '../src/assets/ipl';

/** A camera at `at` looking along +y (native), x to the right, z up, 640 x 480 at the native 70 degree field of view. */
const camera=(at:[number,number,number]=[0,0,0]):OcclusionCamera=>({position:at,view:p=>({x:p[0]-at[0],y:p[2]-at[2],z:p[1]-at[1]}),tanHalfWidth:Math.tan(35*Math.PI/180),tanHalfHeight:Math.tan(35*Math.PI/180)*480/640,width:640,height:480,fov:70});
const box=(centerX:number,centerY:number,bottomZ:number,width:number,length:number,height:number,rotZ=0,interior=false)=>({centerX,centerY,bottomZ,width,length,height,rotZ,rotY:0,rotX:0,flags:0,interior});

test('CalcScreenCoors puts the view centre mid-screen, rejects depth 1 or less, and scales by 70 over the field of view',()=>{
 const cam=camera();
 expect(calcScreenCoors(cam,[0,10,0])).toEqual({x:320,y:240,z:10});
 const right=calcScreenCoors(cam,[10*Math.tan(35*Math.PI/180),10,0])!;expect(right.x).toBeCloseTo(640,6);expect(right.y).toBeCloseTo(240,6);
 const up=calcScreenCoors(cam,[0,10,10*Math.tan(35*Math.PI/180)*480/640])!;expect(up.y).toBeCloseTo(0,6);
 expect(calcScreenCoors(cam,[0,1,0])).toBeUndefined();expect(calcScreenCoors(cam,[0,-5,0])).toBeUndefined();
 expect(screenScales(cam,10)).toEqual({scaleX:64,scaleY:48});
 expect(setRotate(0,0,0)).toEqual([[1,0,-0],[-0,1,0],[0,0,1]]);
});
test('the 2d line helpers: inside is on the right-hand perpendicular, and a line touches the screen when it crosses an edge',()=>{
 // A line along +x: points below it (screen y grows downward) are on its right-hand side.
 expect(isPointInsideLine(0,0,1,0,5,3,0)).toBe(false);expect(isPointInsideLine(0,0,1,0,5,-3,0)).toBe(true);expect(isPointInsideLine(0,0,1,0,5,-3,4)).toBe(false);
 expect(doesInfiniteLineTouchScreen(10,10,1,0,640,480)).toBe(true);
 expect(doesInfiniteLineTouchScreen(-10,-10,1,0,640,480)).toBe(false);
 expect(doesInfiniteLineTouchScreen(-10,100,1,0,640,480)).toBe(true);
 expect(doesInfiniteLineTouchScreen(-10,-10,1,1,640,480)).toBe(true);
});
test('AddOne floors the sizes, drops an empty box, turns the rotations by 180 degrees and keeps interiors apart',()=>{
 const o=new NativeOcclusion();
 o.setOccluders([box(0,50,0,20.7,4.2,10.9,90),box(0,0,0,0.5,0.9,0.2),box(5,5,0,3,3,3,0,true)]);
 expect(o.occluders).toHaveLength(1);expect(o.interiorOccluders).toHaveLength(1);
 expect(o.occluders[0]).toMatchObject({center:[0,50,5.45],width:20,length:4,height:10,dontStream:false});
 expect(o.occluders[0].rotZ).toBeCloseTo(270*Math.PI/180,9);expect(o.occluders[0].rotX).toBeCloseTo(Math.PI,9);
 expect(o.snapshot()).toEqual({occluders:1,interior:1,active:0,nearby:0,farAway:1});
});
test('a wall in front of the camera becomes an active occluder with an outline and one face, and hides what is behind it',()=>{
 const o=new NativeOcclusion(),cam=camera();
 o.setOccluders([box(0,50,-5,40,4,20)]);
 expect(o.processBeforeRendering(cam)).toBe(1);
 const a=o.active[0];
 expect(a.lines.length).toBeGreaterThanOrEqual(4);expect(a.faceNormals).toHaveLength(1);expect(a.faceNormals[0][1]).toBeCloseTo(-1,6);
 expect(a.distToCam).toBe(Math.trunc(50-Math.hypot(40,4,20)));
 // Behind the wall, in front of it, and above it.
 expect(o.isPositionOccluded(cam,[0,90,0],1)).toBe(true);
 expect(o.isPositionOccluded(cam,[0,30,0],1)).toBe(false);
 expect(o.isPositionOccluded(cam,[0,90,40],1)).toBe(false);
 expect(o.isPositionOccluded(cam,[60,90,0],1)).toBe(false);
 // CEntity::IsEntityOccluded on a small building behind the wall, and on a wide one poking out of its shadow.
 const world=(c:[number,number,number])=>(p:readonly [number,number,number])=>[c[0]+p[0],c[1]+p[1],c[2]+p[2]] as const;
 expect(o.entityOccluded([0,90,3],6,{min:[-4,-4,-3],max:[4,4,3],toWorld:world([0,90,3])})).toBe(true);
 expect(o.entityOccluded([0,90,3],60,{min:[-55,-4,-3],max:[55,4,3],toWorld:world([0,90,3])})).toBe(false);
 expect(o.positionOccluded([0,90,0],1)).toBe(true);
 expect(o.snapshot()).toMatchObject({active:1,nearby:1,farAway:0});
});
test('occluders move between the far-away and nearby lists with the camera, sixteen far ones a frame',()=>{
 const o=new NativeOcclusion();
 o.setOccluders([box(0,50,0,10,10,10),box(0,1000,0,10,10,10)]);
 o.processBeforeRendering(camera());
 expect(o.snapshot()).toMatchObject({nearby:1,farAway:1,active:1});
 o.processBeforeRendering(camera([0,950,0]));o.processBeforeRendering(camera([0,950,0]));
 expect(o.snapshot()).toMatchObject({nearby:1,farAway:1});
 expect(o.active).toHaveLength(1);
 // Inside an interior the map occluders are skipped.
 expect(o.processBeforeRendering(camera([0,950,0]),false)).toBe(0);
});
test('an active occluder hidden behind a nearer one is dropped',()=>{
 const o=new NativeOcclusion(),cam=camera();
 o.setOccluders([box(0,50,-5,40,4,20),box(0,80,-5,30,4,15)]);
 expect(o.processBeforeRendering(cam)).toBe(1);
 expect(o.active[0].distToCam).toBe(Math.trunc(50-Math.hypot(40,4,20)));
});
test('a flat occluder projects as a quad with one face',()=>{
 const cam=camera();
 const flat=processOneOccluder({center:[0,50,5],width:40,length:0,height:20,rotZ:Math.PI,rotY:Math.PI,rotX:Math.PI,dontStream:false,next:-1},cam);
 expect(flat).toBeDefined();expect(flat!.lines).toHaveLength(4);expect(flat!.faceNormals).toHaveLength(1);
 const tiny=processOneOccluder({center:[0,250,5],width:4,length:0,height:2,rotZ:Math.PI,rotY:Math.PI,rotX:Math.PI,dontStream:false,next:-1},cam);
 expect(tiny).toBeUndefined();
});
test('the IPL occl section reads seven to ten fields',()=>{
 const data=readIpl(new TextEncoder().encode('occl\n-2353.98, 916.836, 44.4479, 32.0273, 57.4945, 47.0, 0.0\n10, 20, 30, 4, 5, 6, 90, 15, 30, 1\nend\n'));
 expect(data.occluders).toEqual([{centerX:-2353.98,centerY:916.836,bottomZ:44.4479,width:32.0273,length:57.4945,height:47,rotZ:0,rotY:0,rotX:0,flags:0},{centerX:10,centerY:20,bottomZ:30,width:4,length:5,height:6,rotZ:90,rotY:15,rotX:30,flags:1}]);
 expect(data.warnings).toEqual([]);
});
