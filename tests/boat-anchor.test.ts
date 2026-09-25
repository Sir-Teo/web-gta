import {expect,test} from 'vitest';
import {Quaternion,Vector3} from 'three';
import {WorldBoat} from '../src/simulation/WorldBoat';

// CBoat::ProcessControl's bLockedToXY tail over a stand-in body.
const hull=(rotation:Quaternion)=>{
 let velocity={x:3,y:-1,z:2},q=rotation.clone();
 const boat:any=Object.create(WorldBoat.prototype);
 Object.assign(boat,{occupied:false,anchored:true,body:{linvel:()=>velocity,setLinvel:(v:any)=>{velocity=v;},rotation:()=>({x:q.x,y:q.y,z:q.z,w:q.w}),setRotation:(r:any)=>{q=new Quaternion(r.x,r.y,r.z,r.w);}}});
 return {boat,velocity:()=>velocity,rotation:()=>q,turn:(a:number)=>{q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),a).multiply(q);}};
};
const hold=(boat:any)=>(WorldBoat.prototype as any).holdAnchor.call(boat);
const off=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));

test('an anchored boat loses its speed across the water and is swung back to the heading it was anchored at',()=>{
 // Pitched a little, as a swell leaves it.
 const pitched=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.7).multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.1));
 const h=hull(pitched),upY=()=>new Vector3(0,1,0).applyQuaternion(h.rotation()).y;
 hold(h.boat);
 expect(h.velocity()).toEqual({x:0,y:-1,z:0});
 const at=h.boat.heading(),tilt=upY();
 expect(h.boat.anchorHeading).toBeCloseTo(at,9);
 h.turn(.5);expect(off(h.boat.heading(),at)).toBeGreaterThan(.4);
 hold(h.boat);
 expect(off(h.boat.heading(),at)).toBeLessThan(1e-6);expect(upY()).toBeCloseTo(tilt,6);
});

test('the player driving lifts the anchor and forgets its heading; ANCHOR_BOAT sets the flag alone',()=>{
 const h=hull(new Quaternion()),start=h.boat.heading();
 hold(h.boat);expect(h.boat.anchorHeading).toBeCloseTo(start,9);
 h.boat.body.setLinvel({x:3,y:0,z:2});h.boat.occupied=true;hold(h.boat);
 expect(h.boat.anchored).toBe(false);expect(h.boat.anchorHeading).toBeUndefined();expect(h.velocity().x).toBe(3);
 h.boat.occupied=false;h.turn(1);h.boat.setAnchored(true);
 // Taken afresh on the first anchored frame: no swing back.
 hold(h.boat);expect(h.boat.anchorHeading).toBeCloseTo(h.boat.heading(),9);expect(off(h.boat.heading(),start+1)).toBeLessThan(1e-6);
 h.boat.setAnchored(false);h.turn(.3);h.boat.setAnchored(true);hold(h.boat);
 // Let go and anchored again, it swings back to the heading it held.
 expect(off(h.boat.heading(),start+1)).toBeLessThan(1e-6);
});
