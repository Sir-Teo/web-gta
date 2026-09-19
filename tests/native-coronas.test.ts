import {expect,test} from 'vitest';
import {readFileSync,openAsBlob} from 'node:fs';
import {NativeCoronas,coronaIntensity,MAX_NUM_CORONAS} from '../src/world/nativeCoronas';
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
