import {expect,test} from 'vitest';
import {MODEL,pointSpeed,towBarPoint,towBarReachesHitch,towHitchPoint,towLinkHolds,tractorLinkImpulse,trailerLegReach,trailerLinkImpulse,type TowBody,type TowLinkPair,type TowModel} from '../src/simulation/nativeTowLink';

const body=(o:Partial<TowBody>={}):TowBody=>({position:{x:0,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:1},linear:{x:0,y:0,z:0},angular:{x:0,y:0,z:0},
 centerOfMass:{x:0,y:0,z:0},mass:3000,turnMass:9000,...o});
/** A tractor at the origin with its bar 3 behind it, a trailer 7 behind that with its hitch on the bar. */
const pair=(o:Partial<TowLinkPair>={}):TowLinkPair=>({tractor:body({mass:3500,turnMass:15000}),trailer:body({position:{x:0,y:-10,z:0},mass:5000,turnMass:40000}),
 hitch:{x:0,y:-3,z:0},bar:{x:0,y:-3,z:0},baggage:false,timeStep:1,...o});
const close=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number},digits=5)=>{expect(a.x).toBeCloseTo(b.x,digits);expect(a.y).toBeCloseTo(b.y,digits);expect(a.z).toBeCloseTo(b.z,digits);};
const applied=(b:TowBody,d:{linear:{x:number;y:number;z:number};angular:{x:number;y:number;z:number}}):TowBody=>({...b,
 linear:{x:b.linear.x+d.linear.x,y:b.linear.y+d.linear.y,z:b.linear.z+d.linear.z},angular:{x:b.angular.x+d.angular.x,y:b.angular.y+d.angular.y,z:b.angular.z+d.angular.z}});

test('the link breaks with the points over max(timestep, 0.7) apart, the two turned over 114° apart or one rolled over',()=>{
 expect(towLinkHolds(pair({bar:{x:0,y:-2.31,z:0}}))).toBe(true);
 expect(towLinkHolds(pair({bar:{x:0,y:-1.9,z:0}}))).toBe(false);
 // A short step still allows 0.7.
 expect(towLinkHolds(pair({bar:{x:0,y:-2.4,z:0},timeStep:.5}))).toBe(true);
 expect(towLinkHolds(pair({bar:{x:0,y:-2.2,z:0},timeStep:.5}))).toBe(false);
 const a=113*Math.PI/180,b=115*Math.PI/180;
 expect(towLinkHolds(pair({trailer:body({position:{x:0,y:-10,z:0},forward:{x:Math.sin(a),y:Math.cos(a),z:0}})}))).toBe(true);
 expect(towLinkHolds(pair({trailer:body({position:{x:0,y:-10,z:0},forward:{x:Math.sin(b),y:Math.cos(b),z:0}})}))).toBe(false);
 expect(towLinkHolds(pair({trailer:body({position:{x:0,y:-10,z:0},up:{x:0,y:0,z:-1}})}))).toBe(false);
});

test('the trailer takes the whole speed between its hitch and the bar; the tractor half, by the trailer\'s share of the mass',()=>{
 const p=pair({tractor:body({mass:3500,turnMass:15000,linear:{x:0,y:.4,z:0}})});
 const hitch={x:0,y:7,z:0},bar={x:0,y:-3,z:0};
 // After its impulse the trailer's hitch moves with the bar.
 const trailer=applied(p.trailer,trailerLinkImpulse(p,false,false));
 close(pointSpeed(trailer,hitch),pointSpeed(p.tractor,bar));
 // The tractor is pulled back at its bar by half the gap times 5000 / 8500.
 const tractor=applied(p.tractor,tractorLinkImpulse(p,false,false));
 close(pointSpeed(tractor,bar),{x:0,y:.4-.4*.5*5000/8500,z:0});
 // Matching (SetTowLink's jolt), it takes all of it.
 close(pointSpeed(applied(p.tractor,tractorLinkImpulse(p,true,false)),bar),{x:0,y:0,z:0});
});

test('the second pass pulls the hitch toward the bar by 0.3 of the gap a step, and the bar toward the hitch by 0.1',()=>{
 const p=pair({hitch:{x:.2,y:-3,z:0}}),hitch={x:.2,y:7,z:0},bar={x:0,y:-3,z:0};
 // Along the pull, that is: the impulse stops speed in its own direction only (the turn it gives the trailer, off
 // its centre line, moves the hitch a little sideways too).
 expect(pointSpeed(applied(p.trailer,trailerLinkImpulse(p,false,true)),hitch).x).toBeCloseTo(-.06,6);
 close(pointSpeed(applied(p.tractor,tractorLinkImpulse(p,false,true)),bar),{x:.02,y:0,z:0});
 // A long step takes the same share of the gap over it.
 expect(pointSpeed(applied(p.trailer,trailerLinkImpulse({...p,timeStep:2},false,true)),hitch).x).toBeCloseTo(-.03,6);
 // The turn as well as the move: off the line of the centre of mass the trailer also turns.
 expect(trailerLinkImpulse(p,false,true).angular.z).not.toBe(0);
});

test('a baggage cart\'s link carries nothing up or down',()=>{
 const p=pair({baggage:true,tractor:body({linear:{x:0,y:.2,z:.1}})});
 const d=trailerLinkImpulse(p,false,false);
 expect(d.linear.z).toBe(0);expect(d.linear.y).toBeGreaterThan(0);
 expect(tractorLinkImpulse(p,true,false).linear.z).toBe(0);
});

const model=(o:Partial<TowModel>):TowModel=>({model:0,trailer:false,boundsMin:[-1,-4,-1],boundsMax:[1,5,1.5],frontHeightAboveRoad:.8,...o});
test('the hitch is a trailer\'s hookup dummy, else a unit ahead of it when the model counts; a car\'s inside its front',()=>{
 const tanker=model({model:584,trailer:true,hookup:{x:0,y:6.8,z:-.7}});
 expect(towHitchPoint(tanker,false)).toEqual({x:0,y:6.8,z:-.7});
 expect(towHitchPoint(tanker,true,model({model:MODEL.towtruck}))).toBeUndefined();
 const bare=model({trailer:true});
 expect(towHitchPoint(bare,false)).toBeUndefined();
 expect(towHitchPoint(bare,true)).toEqual({x:0,y:6,z:Math.fround(.5-.8)});
 expect(towHitchPoint(model({}),false)).toBeUndefined();
 expect(towHitchPoint(model({}),true)).toEqual({x:0,y:4.5,z:Math.fround(.5-.8)});
});

test('the tow bar is misc_a on the rigs, and on the van and the tugs only for their own trailers',()=>{
 const tanker=model({model:584,trailer:true,hookup:{x:0,y:6.8,z:-.7}}),misc={x:0,y:-3.5,z:-.2};
 for(const rig of [MODEL.petro,MODEL.rdtrain,MODEL.linerun])expect(towBarPoint(model({model:rig,miscA:misc}),false,tanker)).toEqual(misc);
 const utility=model({model:MODEL.utility,miscA:misc});
 expect(towBarPoint(utility,false,model({model:MODEL.utiltr1,trailer:true}))).toEqual(misc);
 expect(towBarPoint(utility,false,tanker)).toBeUndefined();
 const baggage=model({model:MODEL.baggage,miscA:misc});
 expect(towBarPoint(baggage,false,model({model:MODEL.bagboxa,trailer:true}))).toEqual(misc);
 expect(towBarPoint(baggage,false,tanker)).toBeUndefined();
 // An ordinary car has none of its own; asked with the model, the hitch's point.
 expect(towBarPoint(model({model:400}),false,tanker)).toBeUndefined();
 expect(towBarPoint(model({model:400}),true,tanker)).toEqual({x:0,y:4.5,z:Math.fround(.5-.8)});
 // A trailer's own bar: only the baggage carts', behind their bounds.
 expect(towBarPoint(model({model:MODEL.bagboxa,trailer:true}),false)).toEqual({x:0,y:Math.fround(-4+.05),z:Math.fround(.5-.8)});
 expect(towBarPoint(tanker,false)).toBeUndefined();
 // The tractor takes only the farm trailer, the tow truck no trailer; both from behind at the lowered hoist's height.
 expect(towBarPoint(model({model:MODEL.tractor}),true,tanker)).toBeUndefined();
 expect(towBarPoint(model({model:MODEL.tractor}),true,model({model:MODEL.farmtr1,trailer:true}))).toEqual({x:0,y:Math.fround(-.6-4),z:Math.fround(1-.8)});
 expect(towBarPoint(model({model:MODEL.towtruck}),true,tanker)).toBeUndefined();
 expect(towBarPoint(model({model:MODEL.towtruck}),true,model({model:400}))).toEqual({x:0,y:Math.fround(-1.05-4),z:Math.fround(1-.8)});
});

test('a tow bar takes the hitch within 0.4 across and a unit up or down; towed, the legs reach at least 0.9',()=>{
 expect(towBarReachesHitch({x:.3,y:.2,z:.9},{x:0,y:0,z:0})).toBe(true);
 expect(towBarReachesHitch({x:.3,y:.3,z:0},{x:0,y:0,z:0})).toBe(false);
 expect(towBarReachesHitch({x:0,y:0,z:-1},{x:0,y:0,z:0})).toBe(false);
 expect(trailerLegReach(.2,true)).toBe(.9);expect(trailerLegReach(.95,true)).toBe(.95);expect(trailerLegReach(.2,false)).toBe(.2);
});
