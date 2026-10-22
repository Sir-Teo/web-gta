import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {Mesh,BoxGeometry} from 'three';
import {nativeLitMaterial} from '../src/assets/nativeMaterial';
import {nativeScorchedUniform} from '../src/assets/nativeScorched';
import {placementFade,persistentNormalMaterials} from '../src/render/placementFade';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

test('both original POOL2 instructions set draw-last without changing object pose or collision and reach adopted placements',()=>{
 const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(script).missions[8],sites=decodeScmInstructions(script,block.start,block.end).filter(i=>i.opcode===0x418),flag=vi.fn(),m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{setWorldObjectFlag:flag} as any),o=m.runtime.game.objects.create('dyn_wine_big',{x:1,y:2,z:3},{external:false,missionCleanup:false});
 expect(sites).toHaveLength(2);
 for(const site of sites){const code=new Uint8Array(site.end-site.offset+2);code.set(script.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.locals.setInt32(238*4,o.handle,true);slot.thread.run(1000,100,1);expect(o.drawLast).toBe(true);m.runtime.world!.setObjectDrawLast!(o.handle,false);expect(o.drawLast).toBe(false);}
 expect(o.position).toEqual({x:1,y:2,z:3});expect(o.usesCollision).toBe(true);expect(o.isStatic).toBe(true);
 const adopted=m.runtime.game.objects.adoptWorld('dyn_wine_big',{x:4,y:5,z:6},0,'map-object');for(const state of [true,false]){m.runtime.world!.setObjectDrawLast!(adopted.handle,state);expect(flag).toHaveBeenLastCalledWith('map-object','drawLast',state);}expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});

test('changing the later render pass preserves fading, scorched state and sibling material ownership',()=>{
 const source=nativeLitMaterial({},[1,0,1]),geometry=new BoxGeometry(),a=new Mesh(geometry,source),b=new Mesh(geometry,source),shared=persistentNormalMaterials(0,0),fa=placementFade(a,0,0,true,shared),fb=placementFade(b,0,0,true,shared),normal=b.material;
 a.renderOrder=7;fa.setDistance(20);fa.setAlpha(80);fa.setScorched(true);fa.setDrawLast(true);expect(a.material.opacity).toBe(80/255);expect(a.material.transparent).toBe(true);expect(a.material.depthWrite).toBe(true);expect(nativeScorchedUniform(a.material).value).toBe(true);expect(b.material).toBe(normal);expect(normal.transparent).toBe(false);expect(a.renderOrder).toBe(-20);
 fa.setAlpha(255);expect(a.material.alphaTest).toBe(100/255);fa.setDrawLast(false);expect(a.material.transparent).toBe(false);expect(a.material.alphaTest).toBe(140/255);expect(nativeScorchedUniform(a.material).value).toBe(true);fa.setScorched(false);expect(a.material).toBe(normal);fa.dispose();fb.dispose();expect(a.material).toBe(source);geometry.dispose();source.dispose();
});

test('a false override clears a model’s draw-last default while retaining material-slot alpha and interior policy',()=>{
 const source=nativeLitMaterial({},[1,0,1]),geometry=new BoxGeometry(),mesh=new Mesh(geometry,[source,source]),fade=placementFade(mesh,4,1,true);
 fade.setMaterialAlpha(1,90);fade.setDistance(12);fade.setDrawLast(false);expect(mesh.material[1].opacity).toBe(90/255);fade.setDrawLast(true);expect(mesh.material[1].opacity).toBe(90/255);expect(mesh.material[1].alphaTest).toBe(0);expect(mesh.material[1].depthWrite).toBe(true);expect(mesh.renderOrder).toBe(-12);fade.setAlpha(40);fade.setDrawLast(false);expect(mesh.material[1].opacity).toBe(40/255);fade.dispose();expect(mesh.material).toEqual([source,source]);geometry.dispose();source.dispose();
});
