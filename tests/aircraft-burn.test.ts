import {expect,test} from 'vitest';
import {WorldPlane} from '../src/simulation/WorldPlane';

const plane=(extra:object={})=>{
 const p:any={health:200,drowning:false,burnTimer:0,fireCounter:0,occupied:false,modelId:487,random:()=>.5,blasts:0,destroyed:false,
  body:{translation:()=>({x:1,y:2,z:3})},onBurnExplosion(){p.blasts++;},damage(n:number){p.health-=n;p.destroyed=true;return true;},...extra};
 Object.defineProperty(p,'burning',{get:()=>p.health>0&&p.health<250&&!p.drowning});
 return p;
};
const burn=(p:any,dt:number)=>(WorldPlane.prototype as any).burn.call(p,dt);

test('a burning plane or helicopter blows up once its burn timer passes 5000 ms (ProcessCarOnFireAndExplode)',()=>{
 const p=plane({occupied:true});
 for(let i=0;i<250;i++)expect(burn(p,1/50)).toBe(false);
 expect(p.burnTimer).toBe(5000);
 expect(burn(p,1/50)).toBe(true);expect(p.destroyed).toBe(true);
 // Out of the fire the timer clears.
 const healthy=plane({health:600,burnTimer:1200});burn(healthy,1/50);expect(healthy.burnTimer).toBe(0);
 const sinking=plane({drowning:true,burnTimer:1200});burn(sinking,1/50);expect(sinking.burnTimer).toBe(0);
});

test('a burning aircraft nobody flies goes off with a rocket blast 1.2% of frames, never an RC toy or the player\'s',()=>{
 // One 30 fps game frame (1/30 s) is one roll.
 const empty=plane({random:()=>.011});burn(empty,1/30);expect(empty.blasts).toBe(1);
 const unlucky=plane({random:()=>.013});burn(unlucky,1/30);expect(unlucky.blasts).toBe(0);
 const flown=plane({random:()=>0,occupied:true});burn(flown,1/50);expect(flown.blasts).toBe(0);
 const toy=plane({random:()=>0,modelId:465});burn(toy,1/50);expect(toy.blasts).toBe(0);
});

test('the fire counter latches once when the fire starts: 2 in the air, 1 on the ground or in the water, never cleared',()=>{
 const flying=plane({inAir:true});burn(flying,1/50);expect(flying.fireCounter).toBe(2);
 // Landing later does not change it.
 flying.inAir=false;burn(flying,1/50);expect(flying.fireCounter).toBe(2);
 const landed=plane({inAir:false});burn(landed,1/50);expect(landed.fireCounter).toBe(1);
 // Not burning: nothing is latched.
 const healthy=plane({health:600,inAir:true});burn(healthy,1/50);expect(healthy.fireCounter).toBe(0);
});
