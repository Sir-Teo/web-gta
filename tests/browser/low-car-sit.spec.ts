import {test,expect} from '@playwright/test';

test('a driver of a low car sits in CAR_Lsit and a passenger in CAR_sitplo, both in ped.ifp',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{VehicleOccupants},{sitClip},{THREE}]=await Promise.all(['/src/render/VehicleOccupants.ts','/src/simulation/nativeDoor.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  const occupants=new VehicleOccupants(new THREE.Scene(),new URL('/play/world/',location.href).href);
  for(let i=0;i<400&&!occupants.snapshot().ready;i++)await new Promise(r=>setTimeout(r,25));
  // Driven traffic stubs: a Savanna-like low car (handling flag 0x4) and an ordinary one.
  const stub=(handle:number,modelFlags:number)=>({autopilot:{},occupied:false,wrecked:false,driverOut:false,modelFlags,modelId:567,seat:()=>({x:-.4,y:0,z:.3}),car:{body:{handle}}});
  const poses=occupants.drivers([stub(1,0x4),stub(2,0)]).map((p:any)=>p.clip);
  const catalog=(occupants as any).catalog;
  return {poses,passenger:[sitClip(0x4,false),sitClip(0,false)],clips:['car_lsit','car_sitplo'].map(n=>!!catalog.animations[n]?.tracks?.length)};
 });
 expect(result.poses).toEqual(['car_lsit','car_sit']);
 expect(result.passenger).toEqual(['car_sitplo','car_sitp']);
 expect(result.clips).toEqual([true,true]);
});
