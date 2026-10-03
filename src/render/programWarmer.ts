import * as THREE from 'three';
/* Shader programs linked off the frame.
 *
 * three builds a material's program the first time it draws it, and the first draw waits for the driver to compile and
 * link it: the frame a new kind of object appears in (the first police car after a murder, a dropped weapon, the
 * moon) stalls for as long as that takes. With KHR_parallel_shader_compile the link runs beside the frames instead:
 * the objects added to the scene since the last frame have their programs started together (WebGLRenderer.compile),
 * and a mesh whose program is not linked yet is kept out of the camera's layers until the driver reports it done
 * (WebGLProgram.isReady), then drawn from the next frame on. Meshes whose programs are already linked draw at once.
 * Without the extension nothing is held back and three links on first use as before.
 *
 * A program is made for the scene's fog and lights as well as the material: one warmed under others is made again at
 * the first draw. The lights are counted once, from the scene (not again from a batch that adds them, which warmed the
 * first frame's programs for two suns), and when the fog's kind changes (the timecycle's linear fog replacing the
 * fallback once the game's data arrives) every program is started again, so the objects not yet shown (birds, plane
 * trails, the bright lights) are linked by the time they are. Things added to the scene's groups are warmed too (the
 * road signs, put up as their buildings stream in). */
type Hidden={mesh:THREE.Object3D;mask:number};
export class ProgramWarmer{
 private added:THREE.Object3D[]=[];
 private waiting:{materials:Set<THREE.Material>;hidden:Hidden[]}[]=[];
 private readonly parallel:boolean;
 /** Stands in for the scene as compile's target: the same lights, fog and environment, without walking the whole tree. */
 private readonly lightScene=new THREE.Scene();
 private lights:THREE.Light[]=[];
 private lightsAt=-Infinity;
 constructor(private readonly renderer:THREE.WebGLRenderer,private readonly scene:THREE.Scene,private readonly camera:THREE.Camera){
  this.parallel=renderer.extensions.has('KHR_parallel_shader_compile');
  if(!this.parallel)return;
  const watched=new WeakSet<THREE.Object3D>();
  const added=(event:unknown)=>{this.added.push((event as {child:THREE.Object3D}).child);};
  scene.addEventListener('childadded',event=>{
   added(event);const child=(event as unknown as {child:THREE.Object3D}).child;
   if((child as THREE.Group).isGroup&&!watched.has(child)){watched.add(child);child.addEventListener('childadded',added);}
  });
  this.lightScene.traverseVisible=callback=>{for(const light of this.lights)if(light.visible)callback(light);};
 }
 /** The fog's kind and the lights the programs were last made for. */
 private environment='';
 private environmentNow(){const fog=this.scene.fog as (THREE.Fog&{isFogExp2?:boolean})|null;return `${fog?fog.isFogExp2?'exp2':'linear':'none'}:${this.lights.length}`;}
 /** Meshes held back until their programs link. */
 get holding(){let count=0;for(const w of this.waiting)count+=w.hidden.length;return count;}
 /** Once a frame, before the scene is drawn. */
 beforeRender(nowMs:number){
  if(!this.parallel)return;
  if(this.added.length)this.start(this.added.splice(0).filter(object=>object.parent===this.scene||object.parent?.parent===this.scene),nowMs);
  const environment=this.environmentNow();
  if(environment!==this.environment){
   // Nothing is held back here: the whole world would blink out while it links.
   if(this.environment)this.start([...this.scene.children],nowMs,false);
   this.environment=environment;
  }
  for(let i=this.waiting.length-1;i>=0;i--){
   const w=this.waiting[i];
   for(const material of w.materials){const program=this.program(material);if(!program||program.isReady())w.materials.delete(material);}
   if(w.materials.size)continue;
   for(const h of w.hidden)h.mesh.layers.mask=h.mask;
   this.waiting.splice(i,1);
  }
 }
 private program(material:THREE.Material){return (this.renderer.properties.get(material) as {currentProgram?:{isReady():boolean}}).currentProgram;}
 /** The scene's lights, looked up again at most once a second, or at once when `force`d. */
 private refreshLights(nowMs:number,force=false){
  if(!force&&nowMs-this.lightsAt<=1000)return;
  const lights:THREE.Light[]=[];this.scene.traverseVisible(o=>{if((o as THREE.Light).isLight)lights.push(o as THREE.Light);});this.lights=lights;this.lightsAt=nowMs;
 }
 /** `hold`: keep the objects whose programs are still linking out of the camera's layers. */
 private start(objects:THREE.Object3D[],nowMs:number,hold=true){
  if(!objects.length)return;
  this.refreshLights(nowMs,objects.some(o=>(o as THREE.Light).isLight));
  this.lightScene.fog=this.scene.fog;this.lightScene.environment=this.scene.environment;
  // compile gathers lights from the batch as well as the light scene: the batch gives none, or a light it adds would
  // be counted twice.
  const batch={traverse:(callback:(o:THREE.Object3D)=>void)=>{for(const o of objects)o.traverse(callback);},traverseVisible:()=>{}} as unknown as THREE.Object3D;
  let materials:Set<THREE.Material>;
  try{materials=this.renderer.compile(batch,this.camera,this.lightScene) as unknown as Set<THREE.Material>;}catch{return;}
  const linking=new Set([...materials].filter(material=>{const program=this.program(material);return !!program&&!program.isReady();}));
  if(!linking.size||!hold)return;
  const hidden:Hidden[]=[];
  for(const object of objects)object.traverse(o=>{
   const material=(o as THREE.Mesh).material;if(!material)return;
   const uses=Array.isArray(material)?material.some(m=>linking.has(m)):linking.has(material);
   if(uses&&o.layers.mask!==0){hidden.push({mesh:o,mask:o.layers.mask});o.layers.mask=0;}
  });
  if(hidden.length)this.waiting.push({materials:linking,hidden});
 }
}
