import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
for(const garment of ['bare','vest','classic'] as const)test(`native player body assembles with ${garment} torso on the player skeleton`,async({page})=>{
 const root=process.env.GTA_CONTENT_DIR,reference=process.env.GTA_REFERENCE_DIR;test.skip(!root||!reference,'Set GTA_CONTENT_DIR to the acquired content depot.');
 const files=Object.fromEntries(['player.dff','torso.dff','head.dff','hands.dff','legs.dff','feet.dff','player_torso.txd','player_face.txd','player_legs.txd','player_feet.txd','vest.dff','vest.txd','jeans.dff','jeansdenim.txd','sneaker.dff','sneakerbincblk.txd'].map(n=>[n,readFileSync(`${root}/player/${n}`).toString('base64')]));
 files['fat.ifp']=readFileSync(`${reference}/fat.ifp`).toString('base64');
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async({files,garment})=>{
  const paths=['/src/assets/readPlayerBaseBody.ts','/src/assets/ModelObjects.ts','/node_modules/three/build/three.module.js','/src/assets/ifp.ts','/src/animation/bind.ts','/src/animation/playerShoulders.ts'];
  const [{readPlayerBaseBody},{modelObject},THREE,{readIfp},{bindAnimation},{bindPlayerShoulders}]=await Promise.all(paths.map(p=>import(p)));
  const bytes=(n:string)=>Uint8Array.from(atob(files[n]),c=>c.charCodeAt(0));
  const {model,textures}=readPlayerBaseBody(new Map(Object.keys(files).map(n=>[n,bytes(n)])),'normal',garment);
  const object=modelObject(model,textures);const animation=readIfp(bytes('fat.ifp')).animations.find((a:any)=>/idle/i.test(a.name));if(!animation)throw new Error('Missing reference idle');const bindingPose=bindAnimation(model,object.root,animation);bindingPose.sample(0);bindPlayerShoulders(model,object.root).update();const scene=new THREE.Scene();scene.background=new THREE.Color('#252b35');scene.add(object.root);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(700,700);renderer.domElement.style.cssText='position:fixed;inset:0;z-index:9999';document.body.append(renderer.domElement);renderer.domElement.id='assembled-player';
  object.root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(object.root),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const camera=new THREE.PerspectiveCamera(35,1,.01,100);camera.position.copy(center).add(new THREE.Vector3(2,.4,3));camera.lookAt(center);renderer.render(scene,camera);
  (window as any).assembledPlayerProbe={renderer,object,scene,camera,THREE};
  return {animation:animation.name,vertices:model.geometries.reduce((n:any,g:any)=>n+g.positions.length/3,0),triangles:model.geometries.reduce((n:any,g:any)=>n+g.indices.length/3,0),bones:model.geometries.map((g:any)=>g.skin.boneCount),textures:textures.map((t:any)=>t.name),size:size.toArray()};
 },{files,garment});
 const prefix=garment==='bare'?'native-player-assembled':`native-player-${garment}`;
 writeFileSync(`artifacts/${prefix}.json`,JSON.stringify(result,null,2));
 expect(result.size[1]).toBeGreaterThan(1.4);expect(result.size[1]).toBeLessThan(2.2);
 expect(result.vertices).toBe(garment==='classic'?1721:1745);expect(result.triangles).toBe(garment==='classic'?2332:2366);expect(result.bones).toEqual([32,32,32,32,32]);expect(result.textures).toEqual(['torso','face','legs','foot']);expect(result.size.every(Number.isFinite)).toBe(true);
 expect(errors).toEqual([]);
 await page.locator('#assembled-player').screenshot({path:`artifacts/${prefix}.png`});
 for(const [name,position] of [['front',[-2,.4,-3]],['side',[3,.4,0]]] as const){
  await page.evaluate(position=>{const {renderer,object,scene,camera,THREE}=(window as any).assembledPlayerProbe;const center=new THREE.Box3().setFromObject(object.root).getCenter(new THREE.Vector3());camera.position.copy(center).add(new THREE.Vector3(...position));camera.lookAt(center);renderer.render(scene,camera);},position);
  await page.locator('#assembled-player').screenshot({path:`artifacts/${prefix}-${name}.png`});
 }
 await page.evaluate(()=>{const {renderer,object}=(window as any).assembledPlayerProbe;object.dispose();renderer.dispose();renderer.domElement.remove();delete (window as any).assembledPlayerProbe;});
 expect(errors).toEqual([]);
});
