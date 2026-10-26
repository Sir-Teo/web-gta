import {expect,test} from 'vitest';
import {WorldBoat} from '../src/simulation/WorldBoat';
import {worldBoatAudioInput} from '../src/audio/native/worldVehicleAudio';

function boat(over:Record<string,unknown>={}){
 return {modelId:452,occupied:false,wrecked:false,health:1000,engineSpeed:0,inWater:true,gasPedal:1,brakePedal:0,throttle:0,pilot:{physics:true,engineOn:true},body:{translation:()=>({x:1,y:2,z:3}),rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>({x:0,y:0,z:-5})},...over} as unknown as WorldBoat;
}
for(const [label,gas,target] of [['forward',1,.34],['reverse',-.3,.141],['idle',0,0]] as const)test(`a physics-controlled boat updates native propeller ${label} without CJ aboard`,()=>{
 const b=boat({gasPedal:gas,engineSpeed:.2});(WorldBoat.prototype as any).stepPropeller.call(b,1/50);
 expect(b.engineSpeed).toBeCloseTo(.2+(target-.2)*(gas===0?.01:.05),14);
});
test('a stopped physics boat approaches zero prop speed even with its engine flag off',()=>{
 const b=boat({gasPedal:0,engineSpeed:.2,pilot:{physics:true,engineOn:false}});(WorldBoat.prototype as any).stepPropeller.call(b,1/50);expect(b.engineSpeed).toBe(.198);
});
for(const [label,over] of [['abandoned',{pilot:undefined}],['nonphysical',{pilot:{physics:false,engineOn:true}}],['wrecked',{wrecked:true}]] as const)test(`${label} boats retain the abandoned propeller decay`,()=>{
 const b=boat({engineSpeed:.2,...over});(WorldBoat.prototype as any).stepPropeller.call(b,1/50);expect(b.engineSpeed).toBeCloseTo(.2*Math.pow(.95,.6),14);
});
test('a script-driven boat exposes physics status and its engine flag to native audio',()=>{
 const b=boat(),out=worldBoatAudioInput(b,true);expect(out).toMatchObject({status:'physics',engineOn:true,playerDriver:false,playerInVehicle:false,padAccelerate:0,padBrake:0,gasPedal:1,boat:{engineSpeed:0,inWater:true}});
});
test('stopping a script boat keeps physics status but silences its engine flag',()=>{
 const out=worldBoatAudioInput(boat({pilot:{physics:true,engineOn:false}}),true);expect(out.status).toBe('physics');expect(out.engineOn).toBe(false);
});
test('wrecked script boats stay silent despite a retained engine flag',()=>{
 const out=worldBoatAudioInput(boat({wrecked:true}),true);expect(out.status).toBe('wrecked');expect(out.engineOn).toBe(false);
});
test('a genuinely abandoned boat stays silent and keeps abandoned status',()=>{
 const out=worldBoatAudioInput(boat({pilot:undefined}),true);expect(out.status).toBe('abandoned');expect(out.engineOn).toBe(false);
});
test('CJ at the helm retains player audio even when an old script pilot is stopped',()=>{
 const b=boat({occupied:true,pilot:{physics:true,engineOn:false},throttle:.75}),out=worldBoatAudioInput(b,true);expect(out).toMatchObject({status:'player',engineOn:true,playerDriver:true,playerInVehicle:true,padAccelerate:.75});
 (WorldBoat.prototype as any).stepPropeller.call(b,1/50);expect(b.engineSpeed).toBeCloseTo(.017,14);
});
