import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {BoxGeometry,Mesh,Group} from 'three';
import {nativeLitMaterial} from '../src/assets/nativeMaterial';
import {nativeScorchedUniform} from '../src/assets/nativeScorched';
import {placementFade,persistentNormalMaterials} from '../src/render/placementFade';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

test('scorched placement copies isolate shared materials and retain their own uniform across fading and restoration',()=>{
 const material=nativeLitMaterial({},[1,0,1]),geometry=new BoxGeometry(),a=new Mesh(geometry,material),b=new Mesh(geometry,material),shared=persistentNormalMaterials(0,0),owner=placementFade(a,0,0,true,shared),sibling=placementFade(b,0,0,true,shared),normal=a.material;
 expect(b.material).toBe(normal);owner.setScorched(true);const scorched=a.material;expect(scorched).not.toBe(normal);expect(b.material).toBe(normal);expect(nativeScorchedUniform(scorched).value).toBe(true);expect(nativeScorchedUniform(normal).value).toBe(false);
 const shader:any={uniforms:{},vertexShader:'',fragmentShader:''};scorched.onBeforeCompile(shader,{} as any);expect(shader.uniforms.nativeRenderScorched).toBe(nativeScorchedUniform(scorched));
 owner.setAlpha(100);const faded=a.material;expect(nativeScorchedUniform(faded).value).toBe(true);expect(faded.opacity).toBe(100/255);owner.setAlpha(50);expect(a.material).toBe(faded);expect(faded.opacity).toBe(50/255);
 owner.setScorched(false);expect(nativeScorchedUniform(a.material).value).toBe(false);owner.setScorched(true);expect(a.material).toBe(faded);owner.setAlpha(255);expect(a.material).toBe(scorched);owner.setScorched(false);expect(a.material).toBe(normal);
 const dispose=vi.fn();scorched.addEventListener('dispose',dispose);owner.dispose();sibling.dispose();expect(dispose).toHaveBeenCalledOnce();expect(a.material).toBe(material);material.dispose();geometry.dispose();
});

test('scorched placement arrays preserve material-slot alpha without changing another placement',()=>{
 const material=nativeLitMaterial({},[1,0,1]),geometry=new BoxGeometry(),a=new Mesh(geometry,[material,material]),b=new Mesh(geometry,material),root=new Group();root.add(a);const fade=placementFade(root,0,0,true);
 fade.setScorched(true);fade.setMaterialAlpha(1,80);expect(a.material[1].opacity).toBe(80/255);expect(b.material.opacity).toBe(1);fade.setAlpha(40);expect(a.material[1].opacity).toBe(40/255);expect(nativeScorchedUniform(a.material[1]).value).toBe(true);fade.dispose();geometry.dispose();material.dispose();
});

test('both original QUARRY array instructions set the physical lighting flag and forward adopted placement changes',()=>{
 const bytes=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(bytes).missions[118],sites=decodeScmInstructions(bytes,block.start,block.end).filter(i=>i.opcode===0x654),flag=vi.fn(),m=new ScmMission(bytes,{infoLabels:['TEST'],population:[]} as any,{setWorldObjectFlag:flag} as any),objects=m.runtime.game.objects,o=objects.create('kmb_woodenbox',{x:0,y:0,z:0},{external:false,missionCleanup:false});
 expect(sites).toHaveLength(2);
 for(const [n,site] of sites.entries()){
  const code=new Uint8Array(site.end-site.offset+2);code.set(bytes.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.locals.setInt32((n?48:50)*4,0,true);slot.thread.locals.setInt32((n?111:114)*4,o.handle,true);slot.thread.run(1000,100,1);expect(o.renderScorched).toBe(true);m.runtime.world!.setObjectRenderScorched!(o.handle,false);expect(o.renderScorched).toBe(false);
 }
 const adopted=objects.adoptWorld('kmb_woodenbox',{x:0,y:0,z:0},0,'map-object');m.runtime.world!.setObjectRenderScorched!(adopted.handle,true);expect(flag).toHaveBeenLastCalledWith('map-object','scorched',true);m.runtime.world!.setObjectRenderScorched!(adopted.handle,false);expect(flag).toHaveBeenLastCalledWith('map-object','scorched',false);expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});
