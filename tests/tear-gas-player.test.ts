import {expect,test} from 'vitest';
import {WeaponSystem} from '../src/weapons/WeaponSystem';

// CWorld::SetPedsChoking: a WEAPON_TEARGAS damage event on a ped inside a box 2r across and 10 high, with no falloff;
// a fire-proof or burning ped is passed over, and no vehicle is touched.
const choke=(extra:{proofs?:object;burning?:boolean;at?:{x:number;y:number;z:number}}={})=>{
  const hurt:[number,unknown][]=[],carHits:number[]=[];
  const self=Object.assign(Object.create(WeaponSystem.prototype),{
    fires:{fireOn:()=>extra.burning?{}:undefined},damage:(handle:number)=>{carHits.push(handle);},
    sim:{playerBody:{isEnabled:()=>true,translation:()=>({x:0,y:1,z:0})},playerCollider:{isEnabled:()=>true},playerProofs:extra.proofs,
      player:{health:100,position:extra.at??{x:2.9,y:0,z:2.9}},damagePlayer:(amount:number,_a:boolean,event:unknown)=>{hurt.push([amount,event]);},
      world:{castRay:()=>null}},
    pedestrians:()=>({targets:()=>[]}),fleet:()=>({cars:[{wrecked:false,car:{body:{collider:()=>({handle:8}),translation:()=>({x:1,y:0,z:0})}}}],boats:[]})});
  (WeaponSystem.prototype as any).radial.call(self,{x:0,y:1,z:0},3,4,false,true);
  return {hurt,carHits};
};
test('tear gas chokes CJ anywhere in its box at full strength, as WEAPON_TEARGAS',()=>{
  const {hurt,carHits}=choke();
  expect(hurt).toEqual([[4,{weapon:17,from:{x:0,z:0}}]]);
  expect(carHits).toEqual([]);
  expect(choke({at:{x:3.5,y:0,z:0}}).hurt).toEqual([]);
});
test('a fire-proof or burning CJ is passed over',()=>{
  expect(choke({proofs:{fire:true}}).hurt).toEqual([]);
  expect(choke({burning:true}).hurt).toEqual([]);
});
