import {beforeAll,expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation,NATIVE_PLAYER_DAMAGE_MULT} from '../src/simulation/Simulation';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

beforeAll(async()=>RAPIER.init());
for(const friendly of [false,true])for(const allowed of [false,true])test(`nightstick combo applies friendly=${friendly} only after allowed=${allowed}`,()=>{
 const sim=new Simulation();sim.player.position={x:0,y:0,z:0};sim.player.health=5000;sim.player.armour=0;
 const p={pedType:'COP',stagger:0,meleeCooldown:0,headingChange:10,attackMult:1,actor:{player:{position:{x:0,y:0,z:-1},heading:0}},view:{playReaction:vi.fn(),reactionDuration:()=>10}},proto=WorldPedestrians.prototype as any,friendlyWithPlayer=vi.fn(()=>friendly),host={sim,stepFight:proto.stepFight,playerOnFoot:proto.playerOnFoot,damagesPlayer:()=>allowed,friendlyWithPlayer,defendPlayer:vi.fn()};
 try{
  for(let i=0;i<100;i++)proto.stepNightstick.call(host,p,true,1/30);
  expect(p.view.playReaction.mock.calls.map(c=>c[0])).toEqual(['cop_bat_1','cop_bat_2','cop_bat_3']);
  if(!allowed){expect(friendlyWithPlayer).not.toHaveBeenCalled();expect(sim.player.health).toBe(5000);expect(sim.damageEvents).toHaveLength(0);return;}
  let health=5000;const damage=[18,18,25].map(base=>{const scaled=Math.fround(Math.fround(base)*NATIVE_PLAYER_DAMAGE_MULT);return friendly?Math.min(Math.fround(scaled*Math.fround(.1)),12.5):scaled;});
  for(const amount of damage)health=Math.fround(health-amount);
  expect(sim.player.health).toBe(health);expect(friendlyWithPlayer).toHaveBeenCalledTimes(3);expect(friendlyWithPlayer).toHaveBeenCalledWith(p);
  expect(sim.damageEvents.map(e=>({weapon:e.weapon,health:e.health,fall:e.fall,fight:e.fight}))).toEqual(damage.map((health,i)=>({weapon:3,health,fall:i===2,fight:{move:i}})));
 }finally{sim.dispose();}
});
