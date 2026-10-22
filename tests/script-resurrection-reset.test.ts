import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

test('CASINO6’s original reset reaches shared resurrection and restores script control, camera and player fields',()=>{
 const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(script).missions[90],site=decodeScmInstructions(script,block.start,block.end).find(i=>i.opcode===0x974)!,reset=vi.fn(),control=vi.fn(),m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{resetPlayerUponResurrection:reset,setPlayerControl:control,playerCameraState:()=>({inVehicle:false,enteringCar:false,exitingCar:false})} as any),g=m.runtime.game;
 m.playerControl=false;g.pads.setPlayerSafe(0,true);g.pads.startShake(0,10000,100,0,0);g.camera.camShakeForce=2;g.playerInfo.drunkenness=200;g.playerInfo.fadeDrunkenness=20;g.playerInfo.canBeDamaged=false;g.stats.set(176,9);
 const code=new Uint8Array(site.end-site.offset+2);code.set(script.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);m.runtime.start(0,[],{space:code}).thread.run(1000,100,1);
 expect(reset).toHaveBeenCalledOnce();expect(control).toHaveBeenLastCalledWith(true);expect(m.playerControl).toBe(true);expect(g.pads.playerSafe[0]).toBe(false);expect(g.pads.shake[0].duration).toBe(0);expect(g.camera.camShakeForce).toBe(0);expect(g.camera.target).toBe('player');expect(g.playerInfo.drunkenness).toBe(0);expect(g.playerInfo.fadeDrunkenness).toBe(0);expect(g.playerInfo.canBeDamaged).toBe(true);expect(g.stats.get(176)).toBe(0);expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});
