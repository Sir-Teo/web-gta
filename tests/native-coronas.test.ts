import {expect,test} from 'vitest';
import {readFileSync,openAsBlob} from 'node:fs';
import {NativeCoronas,coronaIntensity,coronaReflections,MAX_NUM_CORONAS} from '../src/world/nativeCoronas';
import {processLightsForEntity,type EntityLightFrame} from '../src/world/nativeEntityLights';
import {readTwoDEffects,LIGHT_FLAG,type Model2dEffect} from '../src/assets/twoDEffect';

const camera:[number,number,number]=[0,0,0];
const clear=()=>true;

test('CRegisteredCorona fades toward its registered intensity at 15 a frame and frees itself once dark', () => {
 const c=new NativeCoronas();
 c.register({id:7,color:[255,200,100],intensity:255,position:[10,0,0],size:1,range:100},camera);
 expect(c.count).toBe(1);
 const slot=c.coronas.find(k=>k.id===7)!;
 // Just created off-screen: it stays dark until a render finds it on screen.
 c.update(1,camera,0,clear);expect(slot.faded).toBe(0);expect(slot.id).toBe(7);
 slot.offScreen=false;c.register({id:7,color:[255,200,100],intensity:255,position:[10,0,0],size:1,range:100},camera);
 c.update(1,camera,0,clear);expect(slot.faded).toBe(15);
 // A look change brightens it at once.
 c.register({id:7,color:[255,200,100],intensity:255,position:[10,0,0],size:1,range:100},camera);c.update(1,camera,1,clear);expect(slot.faded).toBe(255);
 // Not registered: it fades out and the slot frees.
 for(let i=0;i<20;i++){c.update(1,camera,1,clear);}
 expect(slot.id).toBe(0);expect(c.count).toBe(0);
 // Beyond its range in 2D nothing registers; a blocked view fades it like off screen.
 c.register({id:8,color:[1,1,1],intensity:255,position:[200,0,0],size:1,range:100},camera);expect(c.count).toBe(0);
 expect(coronaIntensity(40,100)).toBe(1);expect(coronaIntensity(75,100)).toBeCloseTo(.5);expect(coronaIntensity(100,100)).toBe(0);
 expect(c.coronas).toHaveLength(MAX_NUM_CORONAS);
});

test('only-long-distance coronas show from 50 units away', () => {
 const c=new NativeCoronas();
 c.register({id:1,color:[9,9,9],intensity:255,position:[20,0,0],size:1,range:100,neonFade:true},camera);expect(c.count).toBe(0);
 c.register({id:1,color:[9,9,9],intensity:255,position:[40,0,0],size:1,range:100,neonFade:true},camera);expect(c.coronas.find(k=>k.id===1)?.alpha??0).toBe(0);
 c.register({id:2,color:[9,9,9],intensity:255,position:[60,0,0],size:1,range:100,neonFade:true},camera);expect(c.coronas.find(k=>k.id===2)?.alpha).toBe(255);
});

const lamp=(flags:number,flashType=0):Model2dEffect=>({position:[0,0,5],type:0,light:{color:[249,145,34,200],coronaFarClip:100,pointlightRange:12,coronaSize:2.5,shadowSize:8,flashType,enableReflection:true,flareType:0,shadowColorMultiplier:40,flags,coronaTexture:'coronastar',shadowTexture:'shad_exp',shadowZDistance:0,offset:[0,0,0]}});
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,100,200,10,1];
const frame=(over:Partial<EntityLightFrame>={}):EntityLightFrame=>({timeMs:0,frame:0,dayNightBalance:1,wetRoads:0,rain:0,spriteBrightness:10,camera:[100,190,12],rand:()=>0,...over});

test('a night street lamp lights its corona and light pool by night only', () => {
 const c=new NativeCoronas(),entity={id:1000,seed:5,matrix:identity,effects:[lamp(LIGHT_FLAG.atNight|LIGHT_FLAG.checkObstacles)]};
 const pools=processLightsForEntity(entity,frame(),c);
 const slot=c.coronas.find(k=>k.id===1000)!;
 expect(slot.position).toEqual([100,200,15]);expect(slot.color).toEqual([249,145,34]);expect(slot.alpha).toBe(255);expect(slot.checkObstacles).toBe(true);expect(slot.nearClip).toBe(.8);
 expect(pools).toEqual([{id:1000,position:[100,200,15],size:8,color:[38,22,5],intensity:128,maxHeight:15}]);
 // Half-way through dusk the corona is registered at half intensity; by day it is not registered at all.
 processLightsForEntity(entity,frame({dayNightBalance:.5}),c);expect(slot.alpha).toBe(127);
 const day=new NativeCoronas();expect(processLightsForEntity(entity,frame({dayNightBalance:0}),day)).toEqual([]);expect(day.count).toBe(0);
 // A tipped-over object keeps its lights off.
 expect(processLightsForEntity({...entity,matrix:[1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1]},frame(),new NativeCoronas())).toEqual([]);
});

test('flash modes follow CTimer: the anim-speed flash alternates every 512 ms', () => {
 const entity={id:2000,seed:0,matrix:identity,effects:[lamp(LIGHT_FLAG.atDay|LIGHT_FLAG.atNight,3)]};
 const on=new NativeCoronas();processLightsForEntity(entity,frame({timeMs:0x200}),on);expect(on.count).toBe(1);
 const off=new NativeCoronas();processLightsForEntity(entity,frame({timeMs:0}),off);expect(off.count).toBe(0);
 // Rain-only lights take the rain as their fade.
 const rain=new NativeCoronas();processLightsForEntity({...entity,effects:[lamp(LIGHT_FLAG.atNight,10)]},frame({rain:.5}),rain);
 expect(rain.coronas.find(k=>k.id===2000)!.color).toEqual([124,72,17]);
});

test.skipIf(!process.env.GTA_CONTENT_DIR)('the retail lamppost1 and trafficlight1 carry their 2d effect lights', async () => {
 const {readImgIndex,readImgEntry}=await import('../src/assets/img');const {readDff}=await import('../src/assets/dff');
 const img=await openAsBlob(`${process.env.GTA_CONTENT_DIR}/gta3.img`),entries=await readImgIndex(img);
 const read=async(name:string)=>readDff(await readImgEntry(img,entries.find(e=>e.name.toLowerCase()===name)!)).geometries.flatMap(g=>g.effects??[]);
 const lampFx=await read('lamppost1.dff');
 expect(lampFx[0].light).toMatchObject({color:[249,145,34,200],coronaFarClip:100,coronaSize:2.5,shadowSize:8,coronaTexture:'coronastar',shadowTexture:'shad_exp'});
 expect(lampFx[0].light!.flags&LIGHT_FLAG.atNight).toBeTruthy();
 const traffic=await read('trafficlight1.dff');
 expect(traffic).toHaveLength(6);expect(traffic.every(e=>e.light?.flashType===7)).toBe(true);
 expect(()=>readTwoDEffects(new Uint8Array([1,0,0,0]))).toThrow();
 void readFileSync;
});

test('DisplayActualLight shows the phase of the pole direction on the side facing the camera', async () => {
 const {displayActualLight,trafficLightType,TRAFFIC_DIRECTION}=await import('../src/world/nativeTrafficLightCoronas');
 const lamp=(y:number,color:[number,number,number]):Model2dEffect=>({position:[-3,y,3],type:0,light:{color:[...color,200],coronaFarClip:100,pointlightRange:18,coronaSize:1,shadowSize:8,flashType:7,enableReflection:true,flareType:0,shadowColorMultiplier:40,flags:1090,coronaTexture:'coronastar',shadowTexture:'shad_exp',shadowZDistance:0,offset:[0,0,100]}});
 const effects=[lamp(.8,[255,0,0]),lamp(.8,[0,255,0]),lamp(-.4,[255,0,0]),lamp(-.4,[0,255,0])];
 // A pole facing +y (native north) is a north-south light.
 const pole={id:500,matrix:identity,effects};expect(trafficLightType(identity)).toBe(TRAFFIC_DIRECTION.northSouth);
 expect(trafficLightType([0,1,0,0,-1,0,0,0,0,0,1,0,0,0,0,1])).toBe(TRAFFIC_DIRECTION.westEast);
 const c=new NativeCoronas();
 const pools=displayActualLight(pole,{visual:[2,0],cameraForward:[0,1,0],camera:[100,150,12],spriteBrightness:10,spriteSize:10,lightsOnGroundBrightness:10,trafficLightsBrightness:1},c);
 // Red for north-south; the camera looks the pole's way, so only the lamps at y <= 0 show.
 const shown=c.coronas.filter(k=>k.id);expect(shown).toHaveLength(1);expect(shown[0].id).toBe(502);expect(shown[0].color).toEqual([178,0,0]);expect(shown[0].size).toBeCloseTo(1.75);
 expect(pools[0]).toMatchObject({size:8,color:[31,0,0],intensity:128,maxHeight:12});
 // By day (traffic lights brightness 0) there is no pool, but the corona stays.
 const day=new NativeCoronas();expect(displayActualLight(pole,{visual:[0,2],cameraForward:[0,-1,0],camera:[100,170,12],spriteBrightness:10,spriteSize:10,lightsOnGroundBrightness:10,trafficLightsBrightness:0},day)).toEqual([]);
 expect(day.coronas.filter(k=>k.id).map(k=>k.id)).toEqual([501]);
 // aTrafficLightColoursR/G/B (iOS): a lamp is lit in the table's colour, whatever its own 2d effect colour; an amber
 // lamp drawn (230, 150, 20) in the model shows (255, 128, 0).
 const amber=new NativeCoronas(),amberPole={...pole,effects:[lamp(-.4,[230,150,20])]};
 const amberPools=displayActualLight(amberPole,{visual:[1,1],cameraForward:[0,1,0],camera:[100,150,12],spriteBrightness:10,spriteSize:10,lightsOnGroundBrightness:10,trafficLightsBrightness:1},amber);
 expect(amber.coronas.filter(k=>k.id)[0].color).toEqual([178,89,0]);expect(amberPools[0].color).toEqual([31,16,0]);
 // CPointLights::AddLight at the effects' centre, radius 14, max(channel, 50) × 0.4 / 255, over 0.5 brightness only.
 const lights:{position:[number,number,number];radius:number;color:[number,number,number]}[]=[];
 displayActualLight(amberPole,{visual:[1,1],cameraForward:[0,1,0],camera:[100,150,12],spriteBrightness:10,spriteSize:10,lightsOnGroundBrightness:10,trafficLightsBrightness:1},new NativeCoronas(),undefined,lights);
 expect(lights).toHaveLength(1);expect(lights[0].radius).toBe(14);
 expect(lights[0].color[0]).toBeCloseTo(.4,5);expect(lights[0].color[1]).toBeCloseTo(128*.4/255,5);expect(lights[0].color[2]).toBeCloseTo(50*.4/255,5);
 const dim:typeof lights=[];
 displayActualLight(amberPole,{visual:[1,1],cameraForward:[0,1,0],camera:[100,150,12],spriteBrightness:10,spriteSize:10,lightsOnGroundBrightness:10,trafficLightsBrightness:.4},new NativeCoronas(),undefined,dim);
 expect(dim).toHaveLength(0);
});

test('CCoronas::RenderReflections mirrors reflecting coronas through the ground while the roads are wet', () => {
 const c=new NativeCoronas(),eye:[number,number,number]=[0,0,10];
 c.register({id:1,color:[200,100,50],intensity:255,position:[5,0,4],size:2,range:100,reflection:true},eye);
 c.register({id:2,color:[255,255,255],intensity:255,position:[8,0,4],size:1,range:100},eye);
 c.register({id:3,color:[255,255,255],intensity:255,position:[9,0,30],size:1,range:100,reflection:true},eye);
 let probes=0;const ground=()=>{probes++;return 1;};
 const out=coronaReflections(c,.5,1,eye,ground);
 // Only reflecting coronas probe; the one 29 units up is too high to reflect.
 expect(probes).toBe(2);expect(out).toHaveLength(1);
 expect(out[0]).toEqual({position:[5,0,-2],size:2,color:[200,100,50],farClip:55,heightFactor:1-3/20});
 // The ground is found once, then each slot re-probes it one frame in 16.
 const slot=c.coronas.find(k=>k.id===1)!;
 probes=0;for(let f=2;f<18;f++)coronaReflections(c,.5,f,eye,ground);
 expect(probes).toBe(2);
 // A camera below the corona's ground sees none; dry roads forget the heights.
 expect(coronaReflections(c,.5,1,[0,0,.5],ground)).toHaveLength(0);
 expect(coronaReflections(c,0,1,eye,ground)).toHaveLength(0);expect(slot.validHeight).toBe(false);
});

test('a corona taking a freed slot starts without the old occupant\'s ground height (CCoronas::RegisterCorona)',()=>{
 const c=new NativeCoronas();
 c.register({id:7,color:[255,200,100],intensity:255,position:[10,0,0],size:1,range:100},camera);
 const slot=c.coronas.find(k=>k.id===7)!;slot.validHeight=true;slot.heightAboveGround=3;
 slot.id=0;c.count--;
 c.register({id:8,color:[255,200,100],intensity:255,position:[20,0,0],size:1,range:100},camera);
 expect(c.coronas.find(k=>k.id===8)!.validHeight).toBe(false);
});

test('EFFECT_SUN_GLARE registers a coronastar sized by camera distance and lit by its alignment with the sun',()=>{
 const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 // The glint sits a unit above the entity; the camera is 10 units above it, so the reflection direction is straight up.
 const entity={id:2000,seed:1,matrix:identity,effects:[{position:[0,0,1] as [number,number,number],type:4}]},c=new NativeCoronas();
 processLightsForEntity(entity as any,frame({camera:[0,0,11],sunGlare:{amount:.5,vectorToSun:[0,0,-1],sunCore:[255,128,0]}}),c);
 const glint=c.coronas.find(x=>x.id===2000)!;
 expect(glint).toBeDefined();
 // sqrt(1) × 0.5: (core + 510) × 0.5 / 3.
 expect(glint.color).toEqual([127,106,85]);
 expect(glint.size).toBeCloseTo(Math.sqrt(10)*.5*.5,6);
 // Pulled 2 units toward the camera.
 expect(glint.position).toEqual([0,0,3]);
 // A sun behind the reflection registers nothing.
 const d=new NativeCoronas();processLightsForEntity(entity as any,frame({camera:[0,0,11],sunGlare:{amount:.5,vectorToSun:[0,0,1],sunCore:[255,128,0]}}),d);
 expect(d.coronas.some(x=>x.id===2000)).toBe(false);
});

test('a lit lamp adds a point light of its colour × LightFade × TimeFade / 256; by day none', () => {
 const entity={id:1000,seed:5,matrix:identity,effects:[lamp(LIGHT_FLAG.atNight)]},lights:import('../src/world/nativeEntityLights').EntityPointLight[]=[];
 processLightsForEntity(entity,frame(),new NativeCoronas(),lights);
 expect(lights).toHaveLength(1);expect(lights[0].position).toEqual([100,200,15]);expect(lights[0].radius).toBe(12);
 expect(lights[0].color[0]).toBeCloseTo(249/256,9);
 const day:typeof lights=[];processLightsForEntity(entity,frame({dayNightBalance:0}),new NativeCoronas(),day);expect(day).toEqual([]);
});
