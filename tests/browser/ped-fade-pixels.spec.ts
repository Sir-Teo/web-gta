import {test,expect} from '@playwright/test';

// CVisibilityPlugins::SetClumpAlpha: a ped drawn solid first must still fade. three compiles an opaque material
// with alpha forced to 1, so flipping `transparent` without a recompile left fading peds solid.
test('a ped drawn solid first fades when its clump alpha drops',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:4,gangStrengths:Array(10).fill(0)});
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;document.body.append(canvas);
  const renderer=new THREE.WebGLRenderer({canvas,preserveDrawingBuffer:true});renderer.setClearColor(0x0000ff,1);
  try{
   for(let i=0;i<300&&!crowd.people.some((p:any)=>!p.officer);i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const p=crowd.people.find((p:any)=>!p.officer);if(!p)throw new Error('no ped');
   p.view.update(p.actor,1);p.view.setAlpha(1);
   const view=new THREE.Scene();view.add(p.view.root);
   view.updateMatrixWorld(true);const center=p.view.bone(3).getWorldPosition(new THREE.Vector3());
   const camera=new THREE.PerspectiveCamera(30,1,.1,100);camera.position.copy(center).add(new THREE.Vector3(0,0,5));camera.lookAt(center);
   const pixel=()=>{renderer.render(view,camera);const gl=renderer.getContext(),out=new Uint8Array(4);gl.readPixels(64,64,1,1,gl.RGBA,gl.UNSIGNED_BYTE,out);return [...out];};
   const solid=pixel();p.view.setAlpha(.2);const faded=pixel();
   return {solid,faded};
  }finally{renderer.dispose();crowd.dispose();sim.dispose();}
 });
 // The clear colour is pure blue: the unlit solid ped hides it, the faded one lets most of it through.
 expect(result.solid[2]).toBeLessThan(200);
 expect(result.faded[2]).toBeGreaterThan(result.solid[2]+80);
});
