import {expect,test} from 'vitest';
import {softGroundResistance,HANDLING_FLAG_OFFROAD_ABILITY,HANDLING_FLAG_OFFROAD_ABILITY2,RAIL_TRACK_RESISTANCE_DEFAULT,railTrackResistance} from '../src/simulation/nativeSoftGround';
const base={up:{x:0,y:0,z:1},modelId:492,handlingFlags:0,wetRoads:0,timeStep:1,touchingSand:true,touchingRailTrack:false,railTrackResistance:0};
test('a slow car on sand is bogged down: it loses 0.005 of its planar speed a step, the vertical part untouched',()=>{
 const r=softGroundResistance({...base,moveSpeed:{x:0.1,y:0.2,z:0.05}});
 expect(r.boggedDown).toBe(true);expect(r.touchingSand).toBe(true);
 expect(r.delta!.x).toBeCloseTo(-0.0005,9);expect(r.delta!.y).toBeCloseTo(-0.001,9);expect(r.delta!.z).toBeCloseTo(0,9);
});
test('a fast car on sand gets a 0.3-unit push against its travel eased by max(0.2, 1 − 2 × speed); offroad flags and wet roads cut it',()=>{
 const fast={...base,moveSpeed:{x:0,y:0.6,z:0}};
 const r=softGroundResistance(fast);
 expect(r.boggedDown).toBe(false);
 // 0.005 × 0.2 (1 − 1.2 floors at 0.2) × 0.3 push.
 expect(r.delta!.y).toBeCloseTo(-0.005*0.2*0.3,9);
 expect(softGroundResistance({...fast,moveSpeed:{x:0,y:0.35,z:0}}).delta!.y).toBeCloseTo(-0.005*(1-0.7)*0.3,9);
 expect(softGroundResistance({...fast,handlingFlags:HANDLING_FLAG_OFFROAD_ABILITY}).delta!.y).toBeCloseTo(-0.005*0.2*0.3*0.6,9);
 expect(softGroundResistance({...fast,handlingFlags:HANDLING_FLAG_OFFROAD_ABILITY2|HANDLING_FLAG_OFFROAD_ABILITY}).delta!.y).toBeCloseTo(-0.005*0.2*0.3*0.3,9);
 expect(softGroundResistance({...fast,wetRoads:0.5}).delta!.y).toBeCloseTo(-0.005*0.2*0.3*0.7,9);
 expect(softGroundResistance({...fast,wetRoads:0.2}).delta!.y).toBeCloseTo(-0.005*0.2*0.3,9);
 expect(softGroundResistance({...fast,timeStep:2}).delta!.y).toBeCloseTo(-0.005*0.2*0.3*2,9);
});
test('the Rhino and the RC Bandit ignore sand and rails; rail tracks use the rail resistance on the planar speed',()=>{
 expect(softGroundResistance({...base,modelId:432,moveSpeed:{x:0,y:0.1,z:0}}).delta).toBeUndefined();
 expect(softGroundResistance({...base,modelId:441,touchingSand:false,touchingRailTrack:true,railTrackResistance:.01,moveSpeed:{x:0,y:0.1,z:0}}).delta).toBeUndefined();
 const rail=softGroundResistance({...base,touchingSand:false,touchingRailTrack:true,railTrackResistance:.01,moveSpeed:{x:0.2,y:0,z:0.3}});
 expect(rail.boggedDown).toBe(false);expect(rail.delta!.x).toBeCloseTo(-0.002,9);expect(rail.delta!.z).toBeCloseTo(0,9);
 expect(softGroundResistance({...base,touchingSand:false,moveSpeed:{x:0.2,y:0,z:0}}).delta).toBeUndefined();
});

test('ms_fRailTrackResistance defaults to the iOS executable\'s 0.003 and takes the script\'s multiplier',()=>{
 expect(RAIL_TRACK_RESISTANCE_DEFAULT).toBe(Math.fround(.003));
 expect(railTrackResistance.value).toBe(Math.fround(.003));
 const before=railTrackResistance.multiplier;railTrackResistance.multiplier=()=>2;
 try{expect(railTrackResistance.value).toBeCloseTo(.006,9);}finally{railTrackResistance.multiplier=before;}
});
