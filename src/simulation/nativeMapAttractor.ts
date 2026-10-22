import type {WorldAttractor} from './nativeScene';
/** Inspected iOS FindEffectInRange (100355898): entity candidates are supplied by CWorld, then
 * trigger-script type, model, exact script name, free-slot and prior-effect filters precede a
 * strict float32 squared-distance comparison. Candidate sector order remains the host's. */
export function closestMapAttractor(effects:readonly WorldAttractor[],point:{x:number;y:number;z:number},model:number|string,name:string,ignore:string|undefined,available:(effect:WorldAttractor)=>boolean=()=>true){
 let best:WorldAttractor|undefined,distance=1e8;
 for(const effect of effects){
  if(effect.type!==5||effect.key===ignore||effect.scriptName!==name||typeof model==='string'&&effect.model.toLowerCase()!==model.toLowerCase()||typeof model==='number'&&model!==0&&model!==-1&&effect.modelId!==model||!available(effect))continue;
  const x=Math.fround(Math.fround(point.x)-Math.fround(effect.position[0])),y=Math.fround(Math.fround(point.y)-Math.fround(effect.position[1])),z=Math.fround(Math.fround(point.z)-Math.fround(effect.position[2])),d=Math.fround(Math.fround(Math.fround(x*x)+Math.fround(y*y))+Math.fround(z*z));
  if(d<distance){best=effect;distance=d;}
 }
 return best;
}
