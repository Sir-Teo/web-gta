import {expect,test} from 'vitest';
import {ScmStats} from '../src/engine/ScmGameState';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

test('recruit capacity reads current total respect rather than raw respect or a cached starting value',()=>{
 const stats=new ScmStats(),crowd=Object.create(WorldPedestrians.prototype) as any;
 crowd.totalRespect=()=>stats.get(64);crowd.scriptGangLimit=99;crowd.cityUnlocked=()=>0;
 stats.set(68,1000);expect(crowd.groupRoom()).toBe(0);
 stats.set(64,10);expect(crowd.groupRoom()).toBe(2);
 stats.set(64,800);expect(crowd.groupRoom()).toBe(7);
 stats.set(64,60);expect(crowd.groupRoom()).toBe(3);
 crowd.scriptGangLimit=1;expect(crowd.groupRoom()).toBe(1);
 crowd.cityUnlocked=()=>2;expect(crowd.groupRoom()).toBe(0);
});

test('making room for mission members uses the current respect capacity and retains mission and dead actors',()=>{
 const stats=new ScmStats(),crowd=Object.create(WorldPedestrians.prototype) as any;
 const street=Array.from({length:5},()=>({follow:true,health:100,mission:false})),mission={follow:true,health:100,mission:true},dead={follow:true,health:0,mission:false};
 crowd.people=[...street,mission,dead];crowd.totalRespect=()=>stats.get(64);crowd.scriptGangLimit=99;
 crowd.leaveGroup=(p:any)=>{p.follow=false;};
 stats.set(64,60);crowd.makeRoomForMissionPeds(1,1);
 expect(street.filter(p=>p.follow)).toHaveLength(1);expect(mission.follow).toBe(true);expect(dead.follow).toBe(true);
 stats.set(64,0);crowd.makeRoomForMissionPeds(0,1);
 expect(street.some(p=>p.follow)).toBe(false);expect(mission.follow).toBe(true);
});
