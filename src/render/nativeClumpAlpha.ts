import type {Material} from 'three';
/** RenderAtomicWithAlpha: multiply each material's original opacity by the clump's alpha without losing glass
 * transparency. A component callback can replace source opacity before clump fading.
 * The bindings include parts added later; each vehicle owns these materials. */
export function bindClumpAlpha(bindings:()=>readonly {material:Material}[],componentOpacity?:(material:Material)=>number|undefined){
 const originals=new WeakMap<Material,{opacity:number;transparent:boolean}>();
 return (alpha:number)=>{
  const a=Math.max(0,Math.min(1,alpha));
  for(const {material} of bindings()){
   let base=originals.get(material);if(!base){base={opacity:material.opacity,transparent:material.transparent};originals.set(material,base);}
   const component=componentOpacity?.(material);
   material.opacity=(component??base.opacity)*a;const transparent=a<1||base.transparent||component!==undefined&&component<1;
   if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
  }
 };
}
