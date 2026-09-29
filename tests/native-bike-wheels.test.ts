import {expect,test} from 'vitest';
import {bikeRestBottom,bikeWheelSupports,frameModelPosition} from '../src/vehicle/nativeBikeWheels';

const translate=(x:number,y:number,z:number)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
/** A clump root, a fork turned a quarter round Z holding the front wheel, and the rear wheel off the root. */
const model={frames:[
 {name:'bike',parent:-1,matrix:translate(0,0,0)},
 {name:'forks_front',parent:0,matrix:[0,1,0,0,-1,0,0,0,0,0,1,0,0,.8,.1,1]},
 {name:'wheel_front',parent:1,matrix:translate(.2,0,-.4)},
 {name:'wheel_rear',parent:0,matrix:translate(0,-.6,-.1)},
]};

test('a wheel dummy sits where its parents carry it in the clump',()=>{
 const front=frameModelPosition(model,2);
 // The fork's quarter turn maps its x onto the clump's y.
 expect(front.x).toBeCloseTo(0,6);expect(front.y).toBeCloseTo(1,6);expect(front.z).toBeCloseTo(-.3,6);
 expect(frameModelPosition(model,3)).toEqual({x:0,y:-.6,z:-.1});
});

test('each wheel holds the bike up with a ball of its vehicles.ide size',()=>{
 const supports=bikeWheelSupports(model,{front:[2],rear:[3]},.66,.7);
 expect(supports.map(s=>s.radius)).toEqual([.33,.35]);
 expect(supports[1].center).toEqual({x:0,y:-.6,z:-.1});
 // Without a size for one end the other end's stands in; without either, 0.6.
 expect(bikeWheelSupports(model,{front:[2],rear:[3]},undefined,.5).map(s=>s.radius)).toEqual([.25,.25]);
 expect(bikeWheelSupports(model,{front:[2],rear:[3]}).map(s=>s.radius)).toEqual([.3,.3]);
});

// CBike::PlaceOnRoadProperly sets the bike down on its wheels: the rest height comes from the lowest tyre bottom when
// that reaches below the collision model, so the tyres are not sunk into the road at spawn.
test('the rest bottom is the lowest tyre bottom, or the collision bottom when that is lower',()=>{
 // Front tyre centre z -0.3 radius 0.33 → -0.63; rear -0.1 - 0.35 → -0.45.
 expect(bikeRestBottom(model,{front:[2],rear:[3]},-.3,.66,.7)).toBeCloseTo(-.63,6);
 expect(bikeRestBottom(model,{front:[2],rear:[3]},-.9,.66,.7)).toBe(-.9);
});
