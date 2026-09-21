import {openStaticWorld} from './staticWorldArchive';
import {readModel,ModelReadCache} from './readModel';
import {requireAsset} from './binary';
/** CEscalator's two step models: MI_ESCALATORSTEP for the sloped run and MI_ESCALATORSTEP8 for the flat runs, both
 * dressed from `escstep.txd`. CEscalator::AddThisOne drops the escalator's points by the sloped step's bounding
 * box height, which is read here from the model's own geometry (the collision archive carries no entry for it). */
export async function openEscalatorAssets(base:string){
 const source=await openStaticWorld(base),cache=new ModelReadCache(source.file,source.entries);
 const entries=new Map(source.entries.map(e=>[e.name.toLowerCase(),e]));
 const load=async(name:string)=>{
  const entry=entries.get(`${name}.dff`),textureEntry=entries.get('escstep.txd');
  requireAsset(!!entry&&!!textureEntry,`Missing escalator step model or dictionary: ${name}.`);
  const asset=await readModel({file:source.file,entry:entry!,textureEntry:textureEntry!},cache);
  const names=new Set(asset.textures.map(t=>t.name.toLowerCase()));
  const missing=asset.model.geometries.flatMap(g=>g.materials.filter(m=>m.texture&&!names.has(m.texture.toLowerCase())));
  requireAsset(!missing.length,`Unresolved escalator step textures: ${name}.`);
  return asset;
 };
 const [sloped,flat]=await Promise.all([load('esc_step'),load('esc_step8')]);
 // The model's own vertical extent stands in for the collision bounding box the native drop uses.
 let stepHeight=0;
 for(const geometry of sloped.model.geometries)for(let i=2;i<geometry.positions.length;i+=3)stepHeight=Math.max(stepHeight,geometry.positions[i]);
 requireAsset(Number.isFinite(stepHeight)&&stepHeight>=0&&stepHeight<8,'Invalid escalator step height.');
 return {sloped,flat,stepHeight};
}
export type EscalatorAssets=Awaited<ReturnType<typeof openEscalatorAssets>>;
