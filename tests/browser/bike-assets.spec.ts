import {test,expect} from '@playwright/test';

test('supported bikes resolve models, handling, seats and wheels',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts'].map(p=>import(p)));
  const base=new URL('/play/world/',location.href).href;
  const catalog=await openStaticWorldVehicles(await openStaticWorld(base));
  const out:Record<string,unknown>={};
  for(const modelId of [481,462,468,471]){
   const bike=await loadFixedWorldBike(catalog,{modelId,primaryColor:-1,secondaryColor:-1});
   const frames=bike.model.frames.map((f:any)=>f.name);
   out[modelId]={type:bike.vehicle.type,handling:bike.vehicle.handling,animation:bike.vehicle.animation,
    animGroup:bike.animGroup?{id:bike.animGroup.id,first:bike.animGroup.first,second:bike.animGroup.second}:null,
    front:bike.wheelFrames.front.map((i:any)=>bike.model.frames[i].name),rear:bike.wheelFrames.rear.map((i:any)=>bike.model.frames[i].name),
    seat:frames.includes('ped_frontseat'),pillion:frames.includes('ped_backseat'),lights:!!bike.lightTexture};
  }
  return out;
 });
 expect(result[481]).toMatchObject({type:'bmx',handling:'BMX',animation:'bmx',animGroup:{id:9,first:9,second:3},front:['wheel_front'],rear:['wheel_rear'],seat:true,lights:false});
 expect(result[462]).toMatchObject({type:'bike',handling:'MOPED',animGroup:{id:5,first:5,second:3},seat:true,pillion:true});
 expect(result[468]).toMatchObject({type:'bike',handling:'DIRTBIKE',animGroup:{id:7,first:7,second:3},seat:true});
 expect(result[471]).toMatchObject({type:'quad',handling:'QUADBIKE',animGroup:{id:12,first:12,second:3},front:['wheel_lf_dummy','wheel_rf_dummy'],rear:['wheel_lb_dummy','wheel_rb_dummy'],seat:true});
 expect(errors).toEqual([]);
});
