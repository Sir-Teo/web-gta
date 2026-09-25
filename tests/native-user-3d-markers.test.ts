import {expect,test} from 'vitest';
import {MARKER3D,Native3dMarkers} from '../src/world/native3dMarkers';
import {ScmGameState} from '../src/engine/ScmGameState';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {scmOpcode} from '../src/engine/scmOpcodes';

test('five user markers, each kept until deleted, drawn as a cone bobbing on the diamond angle',()=>{
 const markers=new Native3dMarkers();
 for(let i=0;i<5;i++)expect(markers.userMarkerSet(i,0,10,[255,0,0])).toBe(i);
 expect(markers.userMarkerSet(9,9,9,[0,0,0])).toBe(-1);
 markers.userMarkerDelete(2);markers.userMarkerDelete(7);
 expect(markers.userMarkerSet(5,5,5,[0,255,0])).toBe(2);
 // A quarter turn of the diamond angle lifts each by a quarter unit; they are drawn every frame.
 markers.update(90/5);
 const drawn=markers.drawUserMarkers();
 expect(drawn).toHaveLength(5);
 expect(drawn[0].marker.type).toBe(MARKER3D.cone);expect(drawn[0].marker.size).toBe(1);
 expect(drawn[0].marker.position[2]).toBeCloseTo(10.25,5);
 expect(drawn[2].color).toEqual([0,255,0,255]);
 expect(markers.drawUserMarkers()).toHaveLength(5);
 markers.userMarkerDeleteAll();expect(markers.drawUserMarkers()).toHaveLength(0);
});

test('ENABLE_AMBIENT_CRIME is CLoadMonitor’s own switch',()=>{
 const game=new ScmGameState(),op=scmOpcode('ENABLE_AMBIENT_CRIME'),b=new Uint8Array(4);
 const space=new Uint8Array(32);space.set([op&0xff,op>>8&0xff,1,...b],0);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as unknown as ScmWorldCommands};
 expect(game.enableAmbientCrime).toBe(true);
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 expect(game.enableAmbientCrime).toBe(false);
});
