import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
test('effects.fxp systems render native effectsPC.txd particles: explosion, car fire, flamethrower and blood',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldFx},{Simulation},{EXPLOSION},{THREE,RAPIER}]=await Promise.all(['/src/simulation/fx/WorldFx.ts','/src/simulation/Simulation.ts','/src/simulation/fx/nativeFxEffects.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene();
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(900,500);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0x6f7d86);renderer.domElement.style.cssText='position:fixed;inset:0;z-index:9999';document.body.append(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(60,900/500,.1,300);camera.position.set(0,4,18);camera.lookAt(0,3,0);camera.updateMatrixWorld();
  const fx=new WorldFx(scene,sim,camera);await fx.load(new URL('/play/world/',location.href).href);
  const read=()=>{renderer.render(scene,camera);const gl=renderer.getContext(),bytes=new Uint8Array(900*500*4);gl.readPixels(0,0,900,500,gl.RGBA,gl.UNSIGNED_BYTE,bytes);let changed=0;for(let i=0;i<bytes.length;i+=4)if(Math.abs(bytes[i]-0x6f)>6||Math.abs(bytes[i+1]-0x7d)>6||Math.abs(bytes[i+2]-0x86)>6)changed++;return changed;};
  const step=(seconds:number)=>{for(let t=0;t<seconds;t+=1/60)fx.step(1/60,[],[]);fx.draw(0);};
  const empty=read();
  fx.explosion(EXPLOSION.car,{x:-6,y:1,z:0});
  fx.areaEffect(37,{x:4,y:1.2,z:2},{x:1,y:0,z:-.2});
  fx.bulletHit({point:{x:0,y:1.5,z:4},normal:{x:0,y:.3,z:1},collider:-1,ped:{head:false,dead:false}},16);
  step(.25);fx.areaEffect(37,{x:4,y:1.2,z:2},{x:1,y:0,z:-.2});step(.2);
  const early=fx.snapshot(),pixels=read(),shot=renderer.domElement.toDataURL('image/png');
  step(8);const late=fx.snapshot();
  fx.dispose();sim.dispose();renderer.dispose();
  return {empty,pixels,early,late,shot};
 });
 const {shot,...summary}=result;console.log(JSON.stringify(summary));writeFileSync('artifacts/native-fx.png',Buffer.from(shot.split(',')[1],'base64'));
 expect(result.empty).toBe(0);
 expect(result.early.active).toEqual(expect.arrayContaining(['explosion_medium','flamethrower','prt_blood']));
 expect(result.early.byPrim.some((p:string)=>p.startsWith('explosion_fuel_car'))).toBe(true);
 expect(result.early.quads).toBeGreaterThan(50);
 expect(result.pixels).toBeGreaterThan(5000);
 // One-shot systems destroy themselves; only the 17 static prt_ systems remain.
 expect(result.late.systems).toBe(17);expect(result.late.particles).toBe(0);
 expect(errors).toEqual([]);
});
