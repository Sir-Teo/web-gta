import type {LocalWater} from '../render/LocalWater';
export function bindLocalWater(root:HTMLElement,owner:LocalWater){
 const file=root.querySelector<HTMLInputElement>('#water-file')!,clear=root.querySelector<HTMLButtonElement>('#water-clear')!,status=root.querySelector<HTMLElement>('#water-status')!;let request=0;
 const load=async(selected:File):Promise<boolean>=>{
  const id=++request;
  try{
   if(selected.size>4*1024*1024)throw new Error('Water file exceeds 4 MiB.');
   const text=await selected.text();if(id!==request)return false;owner.load(text,selected.name);clear.disabled=false;
   status.textContent=`${owner.name}: ${owner.counts[0]} exterior and ${owner.counts[1]} interior water polygons. Load a timecycle to display them. Static surfaces; load a particle TXD for water texture. Swimming is not implemented.`;
   return true;
  }catch(error){if(id===request)status.textContent=`${error instanceof Error?error.message:'Unable to load water.'}${owner.name?' Current water retained.':''}`;return false;}
 };
 file.onchange=()=>{const selected=file.files?.[0];if(selected)void load(selected);};
 clear.onclick=()=>{request++;owner.clear();file.value='';clear.disabled=true;status.textContent='Imported water cleared.';};
 return Object.assign(()=>{request++;file.onchange=null;clear.onclick=null;},{load});
}
