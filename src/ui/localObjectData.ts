import {readObjectData,indexObjectData,type ObjectDataRecord} from '../assets/objectData';
export function bindLocalObjectData(root:HTMLElement,enabled:boolean,apply:(definitions?:ReadonlyMap<string,ObjectDataRecord>)=>void){
  const file=root.querySelector<HTMLInputElement>('#object-data-file')!,clear=root.querySelector<HTMLButtonElement>('#object-data-clear')!,status=root.querySelector<HTMLElement>('#object-data-status')!;
  file.disabled=!enabled;let request=0,name='';
  status.textContent=enabled?'No local object definitions loaded. Shipped definitions classify fixed collision unless replaced here.':'Object definitions apply to imported scenes.';
  file.onchange=async()=>{
    const selected=file.files?.[0],id=++request;if(!selected)return;
    status.textContent='Reading object definitions…';
    try{
      if(selected.size>4*1024*1024)throw new Error('Object data exceeds the 4 MiB file limit.');
      const text=await selected.text();if(id!==request)return;
      const records=readObjectData(text),definitions=indexObjectData(records);apply(definitions);name=selected.name;clear.disabled=false;
      const issues=records.filter(r=>r.issues.length).length;
      status.textContent=`${name}: ${definitions.size} object definitions loaded for this session. Known props no longer block the sun halo; physical collision is retained.${issues?` ${issues} rows have unsupported physics/effect values.`:''}`;
    }catch(error){if(id===request)status.textContent=`${error instanceof Error?error.message:'Unable to read object definitions.'}${name?' Current definitions retained.':''}`;}
  };
  clear.onclick=()=>{request++;apply();name='';file.value='';clear.disabled=true;status.textContent='Local definitions cleared. Shipped definitions apply again.';};
  return ()=>{request++;file.onchange=null;clear.onclick=null;};
}
