import {test,expect} from 'vitest';
import {deadPedTyreBlood,type TyreBloodCar} from '../src/simulation/nativeTyreBlood';

// A car at the origin facing +y, its box 1 unit either side and 2 units front and back.
const car=(o:Partial<TyreBloodCar>={}):TyreBloodCar=>({position:{x:0,y:0,z:1},right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},moveSpeed2DSq:.09,mass:1400,
 boundsMin:{x:-1,y:-2},boundsMax:{x:1,y:2},wheelsOnGround:[true,true,true,true],bloody:[false,false,false,false],...o});

test('the wheel nearest a body turns bloody, with an upward bump for a heavy car',()=>{
 // Under the front left corner (−1, 2).
 const [hit,...rest]=deadPedTyreBlood({x:-1.2,y:2.3,z:.2},car());
 expect(rest).toEqual([]);expect(hit.wheel).toBe(0);
 // 50 × min(1, 70 / 1000) and 50 × min(1, 100 / 2000).
 expect(hit.moveForce).toEqual({x:0,y:0,z:3.5000000000000004});
 expect(hit.turnForce).toEqual({force:{x:0,y:0,z:2.5},point:{x:-1,y:2,z:0}});
 // The rear right corner (1, −2).
 expect(deadPedTyreBlood({x:1,y:-2,z:.2},car()).map(h=>h.wheel)).toEqual([3]);
});

test('slow, distant, airborne, already bloody or light cars do not',()=>{
 const at={x:-1,y:2,z:.2};
 expect(deadPedTyreBlood(at,car({moveSpeed2DSq:.05}))).toEqual([]);
 expect(deadPedTyreBlood({...at,z:3.1},car())).toEqual([]);
 expect(deadPedTyreBlood({x:-1,y:3.1,z:.2},car())).toEqual([]);
 expect(deadPedTyreBlood(at,car({wheelsOnGround:[false,true,true,true]}))).toEqual([]);
 expect(deadPedTyreBlood(at,car({bloody:[true,false,false,false]}))).toEqual([]);
 expect(deadPedTyreBlood({x:20,y:2,z:.2},car({position:{x:19,y:0,z:1}}))).toEqual([{wheel:2,moveForce:{x:0,y:0,z:3.5000000000000004},turnForce:{force:{x:0,y:0,z:2.5},point:{x:1,y:2,z:0}}}]);
 expect(deadPedTyreBlood({x:30,y:2,z:.2},car())).toEqual([]);
 const light=deadPedTyreBlood(at,car({mass:400}));
 expect(light).toEqual([{wheel:0}]);
});
