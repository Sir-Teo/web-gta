// The porting pipeline: one command that takes stock of the whole script, runs the missions headless, and writes
// the combined status the next porting round works from. See docs/port/README.md.
//
//   node scripts/port/pipeline.mjs census            static census (docs/port/CENSUS.md, census.json)
//   node scripts/port/pipeline.mjs sweep 2,11 [--seconds 300]
//   node scripts/port/pipeline.mjs sweep story       every mission in launch order (hours headless)
//   node scripts/port/pipeline.mjs report            docs/port/STATUS.md from the census and the last sweep
//   node scripts/port/pipeline.mjs all 2,11,12       all three
//   node scripts/port/pipeline.mjs engine            engine census (docs/port/ENGINE_CENSUS.md): reversed engine
//                                                    functions, class by class, and which the port follows
//   node scripts/port/pipeline.mjs sweep 11 --bot    the objective bot plays from the radar (SWEEP_BOT)
//
// The reference checkout (gta-reversed) is cloned shallow beside the repository on first use unless --ref or
// $GTA_REVERSED names one.
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';

const root=process.cwd(),args=process.argv.slice(2);
const option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const stage=args[0]??'all',missions=args.find((a,i)=>i>0&&/^(story|\d+(,\d+)*)$/.test(a)&&args[i-1]!=='--seconds');
const seconds=option('--seconds')??'300';
const ref=resolve(option('--ref')??process.env.GTA_REVERSED??join(root,'..','gta-reversed','gta-reversed'));
const run=(command,argv,env={})=>{const r=spawnSync(command,argv,{stdio:'inherit',env:{...process.env,...env}});if(r.status!==0)process.exit(r.status??1);};

function ensureReference(){
 if(existsSync(join(ref,'source','game_sa')))return;
 mkdirSync(dirname(ref),{recursive:true});
 console.log(`pipeline: cloning gta-reversed into ${ref}`);
 const r=spawnSync('git',['clone','--depth','1','https://github.com/gta-reversed/gta-reversed',ref],{stdio:'inherit',env:{...process.env,GIT_LFS_SKIP_SMUDGE:'1'}});
 if(r.status!==0)console.warn('pipeline: no reference checkout; the census reference columns will read unknown');
}
function engine(){ensureReference();run('node',['scripts/port/engine-census.mjs','--ref',ref]);}
function census(){ensureReference();run('node',['scripts/port/census.mjs','--ref',ref,...(args.includes('--offline')?['--offline']:[])]);}
function sweep(){
 if(!missions){console.error('pipeline: name the missions to sweep (e.g. 2,11 or story)');process.exit(2);}
 // The sweep is a browser spec: it owns the dev server Playwright starts, so nothing else may hold its port.
 run('npx',['playwright','test','tests/browser/mission-sweep.spec.ts','--project=parallel','--retries=0','--reporter=line'],{SWEEP:missions,SWEEP_SECONDS:seconds,...(args.includes('--bot')?{SWEEP_BOT:'1'}:{})});
}
function report(){
 const censusFile=join(root,'docs','port','census.json'),sweepFile=join(root,'artifacts','port','sweep.json');
 if(!existsSync(censusFile)){console.error('pipeline: run the census first');process.exit(2);}
 const c=JSON.parse(readFileSync(censusFile,'utf8')),s=existsSync(sweepFile)?JSON.parse(readFileSync(sweepFile,'utf8')):undefined;
 const swept=new Map((s?.results??[]).map(r=>[r.id,r]));
 const md=['# Port status','',`Census ${c.generated.slice(0,10)}${c.reference?` (gta-reversed \`${c.reference.commit.slice(0,10)}\`)`:''}; sweep ${s?`${s.generated.slice(0,10)}, ${s.seconds} s a mission`:'not run'}.`,'',
  'Per mission: what the static census flags, and what the headless sweep saw. **Reached** is the furthest instruction the mission thread was seen at, as a share of its block; **Skipped** counts the commands the census finds with no world member yet, which the game skips (a mission runs on without them); **Stops** counts those with no handler at all, where the thread would give up; **Stopped** names a command a mission thread gave up on or a page error; **Outcome** is the big message the mission printed (M_PASS* passed, M_FAIL failed); **Waiting** is where the autopilot could not take it further (a chase, a fight, a menu). See [the census](CENSUS.md) for every command and [README](README.md) for the pipeline.','',
  '| # | Mission | Authored | Silent | Skipped | Stops | Swept | Reached | Ended | Outcome | Stopped | Waiting on |','|---|---|---|---|---|---|---|---|---|---|---|---|'];
 for(const m of c.missions){
  const r=swept.get(m.id),stop=r?[...r.gaveUp.map(g=>`${g.command}@${g.offset}${g.detail?` (${g.detail})`:''}`),...r.pageErrors.map(e=>`page: ${e}`)].join('; '):'';
  md.push(`| ${m.id} | ${m.name} | ${m.byStatus.authored} | ${m.byStatus.silent} | ${m.byStatus.skipped??0} | ${m.byStatus.stops??0} | ${r?'yes':''} | ${r?`${r.reached}%`:''} | ${r?(r.ended?'yes':'no'):''} | ${r?((r.said??[]).some(t=>/^M_PASS/.test(t))?'**passed**':(r.said??[]).includes('M_FAIL')?'failed':''):''} | ${stop.replace(/\|/g,'/')} | ${r&&!r.ended?`${r.waitingAt} ${r.loop.slice(0,4).join(', ')}`:''} |`);
 }
 const portable=c.queue.filter(q=>q.portable);
 md.push('','## Next up','','The first commands of the census queue that gta-reversed has a reversed handler for (port the function named), then the first with none (research or keep the stand-in):','');
 for(const q of portable.slice(0,15))md.push(`- **${q.name}** (${q.status}, ${q.sites} sites, first in ${q.firstMission}): \`${q.ref.where}\` ${q.ref.fn??''}. ${q.notes.join('; ')}`);
 md.push('');
 for(const q of c.queue.filter(q=>!q.portable).slice(0,15))md.push(`- ${q.name} (${q.status}, ${q.sites} sites, first in ${q.firstMission}; reference ${q.ref.kind}). ${q.notes.join('; ')}`);
 writeFileSync(join(root,'docs','port','STATUS.md'),md.join('\n')+'\n');
 console.log('pipeline: docs/port/STATUS.md');
}
const stages={census,engine,sweep,report,all:()=>{census();engine();if(missions)sweep();report();}};
const chosen=stages[stage];
if(!chosen){console.error(`pipeline: unknown stage ${stage}; use census, engine, sweep, report or all`);process.exit(2);}
chosen();
