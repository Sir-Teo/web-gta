import {requireAsset} from './binary';
/** Active GTA.DAT map IPL directives, excluding zones and commented-out files. */
export function readWorldIplLoadList(text:string){
 const paths:string[]=[];
 for(const raw of text.split(/\r?\n/)){
  const line=raw.split('#')[0].trim(),match=/^IPL\s+DATA[\\/]MAPS[\\/](\S+\.ipl)$/i.exec(line);
  if(match)paths.push('ipl/'+match[1].replace(/\\/g,'/').toLowerCase());
 }
 requireAsset(paths.length>0&&new Set(paths).size===paths.length,'Invalid native world IPL load list.');
 return paths;
}
