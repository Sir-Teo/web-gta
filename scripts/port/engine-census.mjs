// The engine census: what of gta-reversed's reversed engine code this port follows, class by class.
//
// gta-reversed registers each function it has reversed (or hooked) by address in the class's InjectHooks:
// RH_ScopedInstall(Name, 0xADDR), with { .reversed = false } for one not yet reversed. A function whose body is
// plugin::Call to its own address is a stub. This port names the functions it follows by the same addresses in its
// comments. Joining the two gives, per class, how much of the reversed code the port cites and which reversed
// functions it does not: a ranked list for making basic play faithful, as the script census is for the missions.
// A citation is a claim to check, not proof the port matches.
//
//   node scripts/port/engine-census.mjs [--ref <gta-reversed checkout>] [--out docs/port]
import {readFileSync,readdirSync,statSync,writeFileSync,existsSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
const args=process.argv.slice(2),flag=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const root=process.cwd();
const refRoot=resolve(flag('--ref')??process.env.GTA_REVERSED??join(root,'..','gta-reversed','gta-reversed'));
const outDir=resolve(flag('--out')??join(root,'docs','port'));
const source=join(refRoot,'source','game_sa');
if(!existsSync(source)){console.error(`no gta-reversed checkout at ${refRoot} (git clone https://github.com/gta-reversed/gta-reversed ../gta-reversed/gta-reversed)`);process.exit(1);}
const walk=dir=>readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?walk(path):[path];});

// --- The reference: every install, with its class and category.
const functions=[];
for(const file of walk(source).filter(f=>f.endsWith('.cpp'))){
 const text=readFileSync(file,'utf8');if(!text.includes('RH_Scoped'))continue;
 let cls='',category='';
 const stubs=new Set([...text.matchAll(/plugin::Call\w*<\s*(0x[0-9A-Fa-f]{6})/g)].map(m=>m[1].toLowerCase()));
 for(const line of text.split('\n')){
  let m;
  if((m=/RH_Scoped(?:Virtual)?Class\((\w+)/.exec(line)))cls=m[1];
  else if((m=/RH_ScopedNamespace(?:Name)?\(\s*"?(\w+)/.exec(line)))cls=m[1];
  if((m=/RH_ScopedCategory(?:Global)?\(\s*"([^"]*)"/.exec(line)))category=m[1];
  else if(/RH_ScopedCategoryGlobal\(\s*\)/.test(line))category='Global';
  if((m=/RH_Scoped(\w*?)Install\(\s*([\w:~]+)\s*,\s*(?:"[^"]*"\s*,\s*)?(0x[0-9A-Fa-f]{6})([^;]*)/.exec(line))){
   const address=m[3].toLowerCase(),rest=m[4];
   const reversed=!/reversed\s*=\s*false/.test(rest)&&!stubs.has(address);
   functions.push({cls:cls||relative(source,file).replace(/\.cpp$/,''),category:category||relative(source,file).split('/')[0],name:m[2],address,reversed,file:relative(refRoot,file)});
  }
 }
}
// --- The port: every address its sources name.
const cited=new Map();
for(const file of walk(join(root,'src')).filter(f=>/\.tsx?$/.test(f))){
 const text=readFileSync(file,'utf8');
 for(const m of text.matchAll(/0x([0-9A-Fa-f]{6})\b/g)){const a=`0x${m[1].toLowerCase()}`;if(!cited.has(a))cited.set(a,new Set());cited.get(a).add(relative(root,file));}
}
// ...and every Class::Function it names, which is how most of its comments cite the reference.
const named=new Set();
for(const file of walk(join(root,'src')).filter(f=>/\.tsx?$/.test(f)))for(const m of readFileSync(file,'utf8').matchAll(/\b(C[A-Z]\w+)::(~?\w+)/g))named.add(`${m[1]}::${m[2]}`);
const isCited=f=>cited.has(f.address)||named.has(`${f.cls}::${f.name}`);
// --- Per class.
const classes=new Map();
for(const f of functions){
 const key=f.cls;let c=classes.get(key);if(!c){c={cls:key,category:f.category,file:f.file,total:0,reversed:0,cited:0,citedReversed:0,missing:[]};classes.set(key,c);}
 c.total++;if(f.reversed)c.reversed++;
 if(isCited(f)){c.cited++;if(f.reversed)c.citedReversed++;}
 else if(f.reversed)c.missing.push(`${f.name} ${f.address}`);
}
const rows=[...classes.values()].filter(c=>c.reversed>0).sort((a,b)=>a.category.localeCompare(b.category)||b.reversed-a.reversed);
const totals={functions:functions.length,reversed:functions.filter(f=>f.reversed).length,cited:functions.filter(isCited).length};
totals.citedReversed=functions.filter(f=>f.reversed&&isCited(f)).length;
let commit='';try{commit=readFileSync(join(refRoot,'.git','HEAD'),'utf8').trim();if(commit.startsWith('ref:'))commit=readFileSync(join(refRoot,'.git',commit.slice(5)),'utf8').trim();}catch{}
writeFileSync(join(outDir,'engine-census.json'),JSON.stringify({generated:new Date().toISOString(),reference:commit,totals,classes:rows},null,1)+'\n');
// The gameplay classes first: what a player touches every minute.
const GAMEPLAY=/^(CPed|CPlayerPed|CCopPed|CTask|CEvent|CAutomobile|CBike|CBmx|CQuad|CBoat|CVehicle|CPhysical|CWeapon|CProjectile|CCam|CCamera|CPad|CWanted|CPopulation|CCarCtrl|CCarAI|CAutoPilot|CPedIntelligence|CPedGroup|CFire|CExplosion|CPickups|CPlayerInfo|CWorld|CCollision)/;
const pct=(n,d)=>d?`${Math.round(n/d*100)}%`:'–';
const md=['# Engine census','',
 `Generated by \`node scripts/port/engine-census.mjs\` on ${new Date().toISOString().slice(0,10)} against gta-reversed \`${commit.slice(0,10)}\`.`,'',
 'Each class gta-reversed hooks, with how many of its functions are reversed there (not `.reversed = false`, not a `plugin::Call` stub of their own address) and how many of those this port names in its sources, by address or as `Class::Function`. **Not cited** lists reversed functions the port never names: candidates to port, or to check against the port\'s authored stand-in. A citation is a claim to check, not proof.','',
 `Totals: ${totals.functions} hooked functions, ${totals.reversed} reversed; the port cites ${totals.cited} of them, ${totals.citedReversed} reversed (${pct(totals.citedReversed,totals.reversed)}).`,'',
 '## Gameplay classes','','| Class | Category | Reversed | Cited | Share | Not cited (first 8) |','|---|---|---|---|---|---|'];
const line=c=>`| ${c.cls} | ${c.category} | ${c.reversed} | ${c.citedReversed} | ${pct(c.citedReversed,c.reversed)} | ${c.missing.slice(0,8).join(', ')}${c.missing.length>8?`, … ${c.missing.length-8} more`:''} |`;
for(const c of rows.filter(c=>GAMEPLAY.test(c.cls)).sort((a,b)=>b.missing.length-a.missing.length))md.push(line(c));
md.push('','## Everything else','','| Class | Category | Reversed | Cited | Share | Not cited (first 8) |','|---|---|---|---|---|---|');
for(const c of rows.filter(c=>!GAMEPLAY.test(c.cls)))md.push(line(c));
writeFileSync(join(outDir,'ENGINE_CENSUS.md'),md.join('\n')+'\n');
console.log(`engine census: ${totals.functions} functions, ${totals.reversed} reversed, ${totals.citedReversed} cited -> ${relative(root,outDir)}/ENGINE_CENSUS.md`);
