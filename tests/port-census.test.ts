import {expect,test} from 'vitest';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// The porting pipeline's census (scripts/port/census.mjs) reads the packaged script with the game's own decoder
// and the handler table the runtime dispatches through. Without a reference checkout its reference columns read
// unknown, but the inventory itself must still come out whole.
test('the census inventories every command of the original script and ranks the gaps',()=>{
 const out=mkdtempSync(join(tmpdir(),'census-'));
 const run=spawnSync('node',['scripts/port/census.mjs','--offline','--ref',join(out,'none'),'--out',out],{encoding:'utf8',timeout:120000});
 expect(run.status,run.stderr).toBe(0);
 const census=JSON.parse(readFileSync(join(out,'census.json'),'utf8'));
 expect(census.totals.instructions).toBe(360439);
 expect(census.totals.commands).toBe(1455);
 expect(census.reference).toBeNull();
 const byName=new Map(census.missions.map((m:any)=>[m.name,m]));
 // The opening and the first story mission reach no command that stops their thread.
 for(const name of ['INTRO','INTRO1'])expect((byName.get(name) as any).byStatus.stops).toBe(0);
 // Every queued command is one the census flagged, and each names where it is first used.
 expect(census.queue.length).toBeGreaterThan(0);
 for(const q of census.queue){expect(['authored','silent','stops']).toContain(q.status);expect(q.firstMission).toBeTruthy();}
 expect(census.queue.find((q:any)=>q.name==='PLAY_MISSION_AUDIO')?.status).toBe('silent');
},130000);
