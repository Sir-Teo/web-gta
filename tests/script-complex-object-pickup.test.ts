import {readFileSync} from 'node:fs';
import {expect,test,vi} from 'vitest';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
const bytes=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
function setup(){
 const entity={position:{x:3,y:0,z:1},heading:0,health:100,order:undefined as any,progress:undefined as number|undefined},bounds={min:{x:-.5,y:-.5,z:0},max:{x:.5,y:.5,z:1}},carry=vi.fn(),modelBounds=vi.fn(()=>bounds as typeof bounds|undefined);
 const host={scriptPedAlive:()=>true,scriptPedPosition:()=>({...entity.position}),scriptPedHeading:()=>entity.heading,scriptPedHealth:()=>entity.health,giveScriptPedOrder:(_p:unknown,order:any)=>entity.order=order,scriptPedHasOrder:()=>!!entity.order,scriptPedAnimProgress:()=>entity.progress,scriptPedAnimTotalTime:()=>1533.3333,clearScriptPedTasks:()=>entity.order=undefined,setScriptPedCarryPose:carry,objectModelBounds:modelBounds};
 const m=new ScmMission(bytes,{infoLabels:['TEST'],population:[]} as any,host as any),ped=m.peds.adopt(entity,25,'MALE01',entity.position,0,100),object=m.runtime.game.objects.create('cardboardbox',{x:0,y:0,z:0},{external:false,missionCleanup:false}),w=m.runtime.world!,tick=(seconds=.1)=>(m as any).processRunners(seconds);
 const run=(mission:number,first:number,last:number,locals:Record<number,number>)=>{const instructions=decodeScmInstructions(bytes,readScmHeader(bytes).missions[mission].start,readScmHeader(bytes).missions[mission].end),end=instructions.find(i=>i.offset===last)!.end,code=new Uint8Array(end-first+2);code.set(bytes.subarray(first,end));code.set([78,0],end-first);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;for(const [k,v]of Object.entries(locals))slot.thread.locals.setInt32(Number(k)*4,v,true);slot.thread.run(1000,100,1);};
 const finishApproach=()=>{entity.position={...entity.order};entity.order=undefined;tick();entity.order=undefined;tick();};
 return {m,ped,object,w,entity,carry,modelBounds,bounds,tick,run,finishApproach};
}

test('DESERT9’s original sequence captures pickup, waits for the real lift clock, then carries through its next walk',()=>{
 const {m,ped,object,w,entity,carry,tick,run,finishApproach}=setup();run(80,1987139,1987187,{45:ped,52:object.handle});expect(entity.order.kind).toBe('goToPoint');expect(w.pedSequenceProgress!(ped)).toBe(0);expect(object.heldBy).toBeUndefined();finishApproach();expect(entity.order).toMatchObject({kind:'playAnim',file:'CARRY',name:'liftup'});expect(object.usesCollision).toBe(false);
 entity.progress=.3;tick();expect(object.heldBy).toBeUndefined();entity.progress=.4;tick();expect(object.heldBy).toMatchObject({ped,node:6,flags:1});entity.progress=1;entity.order=undefined;tick();expect(carry).toHaveBeenCalledWith(entity,'CRRY_PRTIAL');expect(w.pedSequenceProgress!(ped)).toBe(1);expect(entity.order).toMatchObject({kind:'goToPoint',x:360.2195129394531,y:2500.02294921875});
 w.givePedScriptedTask!(ped,{kind:'standStill',time:1000},0x5ba);expect(object.heldBy?.ped).toBe(ped);w.setPedDropsObject!(ped,true);expect(object.heldBy).toBeUndefined();expect(object.usesCollision).toBe(true);expect(carry).toHaveBeenLastCalledWith(entity,undefined);expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});

test('both CASINO2 direct instructions can be cancelled during lift, restoring collision and dropping an acquired object',()=>{
 const {m,ped,object,w,entity,tick,run,finishApproach}=setup();for(const [site,attach] of [[2104683,false],[2109688,true]] as const){entity.progress=undefined;run(85,site,site,{224:ped,228:object.handle});finishApproach();if(attach){entity.progress=.5;tick();expect(object.heldBy?.ped).toBe(ped);}w.givePedScriptedTask!(ped,{kind:'standStill',time:1000},0x5ba);expect(object.usesCollision).toBe(true);expect(object.heldBy).toBeUndefined();}expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});

test('pickup waits for shared collision bounds, aborts an expired approach and rejects unported player handling',()=>{
 const {ped,object,w,entity,modelBounds,bounds,tick}=setup();modelBounds.mockReturnValue(undefined);w.givePedScriptedTask!(ped,{kind:'complexPickUpObject',object:object.handle},0x7c9);expect(entity.order.kind).toBe('standStill');tick();expect(entity.order.kind).toBe('standStill');modelBounds.mockReturnValue(bounds);tick();expect(entity.order.kind).toBe('goToPoint');tick(5.1);expect(entity.order).toBeUndefined();expect(object.heldBy).toBeUndefined();expect(object.usesCollision).toBe(true);expect(()=>w.givePedScriptedTask!(1,{kind:'complexPickUpObject',object:object.handle},0x7c9)).toThrow('PLAYER_COMPLEX_PICKUP_NOT_PORTED');
});

test('the secondary carry pose clears when the held object disappears or the holder dies',()=>{
 for(const deleted of [false,true]){const {m,ped,object,w,entity,carry,tick,finishApproach}=setup();w.givePedScriptedTask!(ped,{kind:'complexPickUpObject',object:object.handle},0x7c9);finishApproach();entity.progress=1;tick();expect(carry).toHaveBeenLastCalledWith(entity,'CRRY_PRTIAL');if(deleted)m.runtime.game.objects.remove(object.handle);else entity.health=0;m.refreshAttachments();expect(carry).toHaveBeenLastCalledWith(entity,undefined);if(!deleted){expect(object.heldBy).toBeUndefined();expect(object.usesCollision).toBe(true);}}
});
