import type {LocalSunTexture} from '../render/LocalSunTexture';
export function bindLocalSunTexture(root:HTMLElement,owner:LocalSunTexture){
  const file=root.querySelector<HTMLInputElement>('#sun-texture-file')!,clear=root.querySelector<HTMLButtonElement>('#sun-texture-clear')!,status=root.querySelector<HTMLElement>('#sun-texture-status')!;
  let request=0;
  const load=async(selected:File):Promise<boolean>=>{
    const id=++request;
    status.textContent='Decoding the local particle texture…';
    try{if(!await owner.load(selected)||id!==request)return false;clear.disabled=false;status.textContent=`${owner.name}: coronastar loaded. ${owner.cloudTexture?'Low-cloud texture loaded.':'No cloud1 texture; low clouds are unavailable.'} ${owner.waterTexture?'Water surface texture loaded.':'No waterclear256 texture.'} Uses local timecycle sun size when available. Sprite shape and sizing are experimental.`;return true;}
    catch(error){if(id===request)status.textContent=`${error instanceof Error?error.message:'Unable to load sun texture.'}${owner.texture?' Current texture retained.':''}`;return false;}
  };
  file.onchange=()=>{const selected=file.files?.[0];if(selected)void load(selected);};
  clear.onclick=()=>{request++;owner.clear();file.value='';clear.disabled=true;status.textContent='Procedural sun restored. Low clouds cleared. Water texture cleared.';};
  return Object.assign(()=>{request++;file.onchange=null;clear.onclick=null;},{load});
}
