import { LocalTimecycle } from '../world/LocalTimecycle';
const weathers=['Extra sunny · Los Santos','Sunny · Los Santos','Extra sunny, smog · Los Santos','Sunny, smog · Los Santos','Cloudy · Los Santos','Sunny · San Fierro','Extra sunny · San Fierro','Cloudy · San Fierro','Rainy · San Fierro','Foggy · San Fierro','Sunny · Las Venturas','Extra sunny · Las Venturas','Cloudy · Las Venturas','Extra sunny · Countryside','Sunny · Countryside','Cloudy · Countryside','Rainy · Countryside','Extra sunny · Desert','Sunny · Desert','Sandstorm · Desert','Underwater','Extra colors 1','Extra colors 2'];
export function bindLocalLighting(root:HTMLElement,lighting:LocalTimecycle){
  const file=root.querySelector<HTMLInputElement>('#lighting-file')!,weather=root.querySelector<HTMLSelectElement>('#lighting-weather')!,clear=root.querySelector<HTMLButtonElement>('#lighting-clear')!,status=root.querySelector<HTMLElement>('#lighting-status')!;
  weather.replaceChildren(...weathers.map((name,index)=>new Option(name,String(index))));
  let request=0;
  const load=async(selected:File,initialWeather?:number):Promise<boolean>=>{
    const id=++request;
    status.textContent='Reading local lighting…';
    try{
      if(selected.size>1024*1024)throw new Error('Timecycle exceeds the 1 MiB file limit.');
      const text=await selected.text();if(id!==request)return false;
      if(initialWeather!==undefined&&(!Number.isInteger(initialWeather)||initialWeather<0||initialWeather>22))throw new Error('Invalid weather selection.');
      const warnings=lighting.load(text,selected.name);
      if(initialWeather!==undefined){lighting.setWeather(initialWeather);weather.value=String(initialWeather);}
      clear.disabled=false;weather.disabled=false;
      status.textContent=`${selected.name}: sky, fog and building lighting loaded for this session.${warnings.some(w=>w.includes('directional'))?' Directional illumination is unavailable in this file.':''}${warnings.find(w=>w.startsWith('Authored fog'))?' '+warnings.find(w=>w.startsWith('Authored fog')):''}`;
      return true;
    }catch(error){if(id===request)status.textContent=`${error instanceof Error?error.message:'Unable to read lighting.'}${lighting.name?' Current lighting retained.':''}`;return false;}
  };
  file.onchange=()=>{const selected=file.files?.[0];if(selected)void load(selected);};
  weather.onchange=()=>lighting.setWeather(Number(weather.value));
  clear.onclick=()=>{request++;lighting.clear();file.value='';clear.disabled=true;weather.disabled=true;status.textContent='Authored lighting restored.';};
  return Object.assign(()=>{request++;file.onchange=null;weather.onchange=null;clear.onclick=null;lighting.clear();},{load});
}
