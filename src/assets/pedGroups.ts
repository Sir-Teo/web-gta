import {requireAsset} from './binary';

/** One peds.ide row: native ped type, stats and anim-group assignment. */
export interface PedModelDef {model:string;pedType:string;stat:string;animGroup:string}
/** Parse the `peds` section of peds.ide (id, model, txd, pedtype, stat, anims, ...). */
export function readPedsIde(text:string):Map<string,PedModelDef>{
 requireAsset(text.length<=1024*1024&&!text.includes('\0'),'Invalid ped definition resource.');
 const defs=new Map<string,PedModelDef>();
 let section:'none'|'peds'|'done'='none';
 for(const [line,raw] of text.split(/\r?\n/).entries()){
  const body=raw.split('#')[0].trim();
  if(!body)continue;
  if(section==='none'){
   if(body.toLowerCase()==='peds')section='peds';
   continue;
  }
  if(section!=='peds')continue;
  if(body.toLowerCase()==='end'){section='done';continue;}
  const fields=body.split(',').map(f=>f.trim());
  requireAsset(fields.length>=6,`Ped definition line ${line+1}: expected id, model, txd, pedtype, stat and anims.`);
  const [id,model,,pedType,stat,animGroup]=fields;
  requireAsset(Number.isInteger(Number(id))&&model.length>0&&pedType.length>0&&stat.length>0&&animGroup.length>0,`Ped definition line ${line+1}: invalid row.`);
  const key=model.toLowerCase();
  requireAsset(!defs.has(key),`Duplicate ped definition: ${model}.`);
  defs.set(key,{model:key,pedType:pedType.toUpperCase(),stat:stat.toUpperCase(),animGroup:animGroup.toLowerCase()});
 }
 requireAsset(section==='done'&&defs.size>=200,'Expected a complete peds.ide table.');
 return defs;
}
/** One pedstats.dat row: decision weights plus attack/defend damage multipliers. */
export interface PedStatDef {name:string;fleeDistance:number;headingChange:number;fear:number;temper:number;lawfulness:number;sexiness:number;attack:number;defend:number;shootingRate:number;decisionMaker:number}
/** Parse pedstats.dat (name + 10 numeric columns; `#` comments). */
export function readPedStats(text:string):Map<string,PedStatDef>{
 requireAsset(text.length<=256*1024&&!text.includes('\0'),'Invalid ped stats resource.');
 const stats=new Map<string,PedStatDef>();
 for(const [line,raw] of text.split(/\r?\n/).entries()){
  const body=raw.split('#')[0].trim();
  if(!body)continue;
  const fields=body.split(/\s+/);
  if(fields.length<11)continue;
  const [name,flee,heading,fear,temper,lawful,sexy,attack,defend,shooting,decision]=fields;
  const values=[flee,heading,fear,temper,lawful,sexy,attack,defend,shooting,decision].map(Number);
  requireAsset(/^[A-Z0-9_]+$/.test(name)&&values.every(v=>Number.isFinite(v)),`Ped stats line ${line+1}: expected a stat name and 10 numbers.`);
  const key=name.toUpperCase();
  requireAsset(!stats.has(key),`Duplicate ped stats: ${name}.`);
  stats.set(key,{name:key,fleeDistance:values[0],headingChange:values[1],fear:values[2],temper:values[3],lawfulness:values[4],sexiness:values[5],attack:values[6],defend:values[7],shootingRate:values[8],decisionMaker:values[9]});
 }
 requireAsset(stats.has('STAT_PLAYER')&&stats.has('STAT_COP')&&stats.size>=30,'Expected a complete pedstats.dat table.');
 return stats;
}
/** pedgrp.dat gang/dealer membership (CPopulation::ChooseGangOccupation inputs). */
export interface PedGangGroups {gangs:string[][];dealers:string[]}
/** Parse pedgrp.dat. Gang lines carry `Gang N` comments; dealers carry `Dealers`. */
export function readPedGroups(text:string):PedGangGroups{
 requireAsset(text.length<=256*1024&&!text.includes('\0'),'Invalid ped group resource.');
 const gangs:string[][]=Array.from({length:10},()=>[]);
 let dealers:string[]=[];
 for(const [line,raw] of text.split(/\r?\n/).entries()){
  const hash=raw.indexOf('#'),body=(hash<0?raw:raw.slice(0,hash)).trim(),comment=hash<0?'':raw.slice(hash+1);
  if(!body)continue;
  const names=body.split(',').map(n=>n.trim().toLowerCase()).filter(n=>n.length>0);
  requireAsset(names.length>0&&names.every(n=>/^[a-z0-9_]+$/.test(n)),`Ped group line ${line+1}: expected model names.`);
  const gang=comment.match(/gang\s+(\d+)/i);
  if(gang){
   const index=Number(gang[1]);
   requireAsset(index>=1&&index<=10,`Ped group line ${line+1}: invalid gang index.`);
   requireAsset(gangs[index-1].length===0,`Duplicate ped group: Gang ${index}.`);
   gangs[index-1]=names;continue;
  }
  if(/dealers/i.test(comment)){
   requireAsset(dealers.length===0,'Duplicate ped dealer group.');
   dealers=names;
  }
 }
 requireAsset(gangs.every(g=>g.length>0),'Ped groups lack a complete Gang 1–10 roster.');
 requireAsset(dealers.length>0,'Ped groups lack dealers.');
 return {gangs,dealers};
}
