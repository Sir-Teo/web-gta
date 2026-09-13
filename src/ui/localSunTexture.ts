import type {LocalSunTexture} from '../render/LocalSunTexture';
export function bindLocalSunTexture(root:HTMLElement,owner:LocalSunTexture){
  const file=root.querySelector<HTMLInputElement>('#sun-texture-file')!,clear=root.querySelector<HTMLButtonElement>('#sun-texture-clear')!,status=root.querySelector<HTMLElement>('#sun-texture-status')!;
  let request=0;
  file.onchange=async()=>{
    const selected=file.files?.[0],id=++request;if(!selected)return;
    status.textContent='Decoding the local particle texture…';
    try{if(!await owner.load(selected)||id!==request)return;clear.disabled=false;status.textContent=`${owner.name}: coronastar loaded. Uses local timecycle sun size when available. Sprite shape and sizing are experimental.`;}
    catch(error){if(id===request)status.textContent=`${error instanceof Error?error.message:'Unable to load sun texture.'}${owner.texture?' Current texture retained.':''}`;}
  };
  clear.onclick=()=>{request++;owner.clear();file.value='';clear.disabled=true;status.textContent='Procedural sun restored.';};
  return ()=>{request++;file.onchange=null;clear.onclick=null;};
}
