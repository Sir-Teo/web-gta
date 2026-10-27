import {readFileSync} from 'node:fs';
import {expect,test,vi} from 'vitest';
import {Scene,PerspectiveCamera} from 'three';
import reference from './fixtures/boat-fire-reference.json';
import {readFxProject} from '../src/assets/fxProject';
import {NativeFxManager,FX_PLAY,FX_KILL,fxIdentity} from '../src/simulation/fx/NativeFx';
import {NativeFxEffects} from '../src/simulation/fx/nativeFxEffects';
import {WorldFx} from '../src/simulation/fx/WorldFx';
import {WorldBoat} from '../src/simulation/WorldBoat';
const project=readFxProject(readFileSync('public/play/world/files/models/effects.fxp','utf8'));
function fixture(input=reference.cases[0].input){
 const camera=new PerspectiveCamera(),manager=new NativeFxManager(project,{random:()=>.5}),effects=new NativeFxEffects(manager,()=>[camera.position.x,-camera.position.z,camera.position.y]),scene=new Scene(),host=new WorldFx(scene,{} as any,camera);
 host.manager=manager;host.effects=effects;
 const boat:any={modelId:input.model,health:input.health,wrecked:input.wrecked,root:{visible:true},splashes:[],inWater:true,submergedInWater:false,get onFire(){return !this.wrecked&&this.health<250;},fireDummy:WorldBoat.prototype.fireDummy,
  assets:{collision:{bounds:{min:[-1,-3,-1],max:[1,3,1]}}},body:{translation:()=>({x:input.dx,y:input.dz,z:-input.dy}),rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>({x:4,y:2,z:-3})}};
 const matrix=fxIdentity(),original=input.existing?manager.create('fire_car',[0,0,0],matrix):undefined;
 if(original){original.play();(host as any).boatDamage.set(boat,{matrix,fire:original,propellers:[]});}
 if(input.fail){const create=manager.create.bind(manager);vi.spyOn(manager,'create').mockImplementation((name,...args)=>name==='fire_car'?undefined:create(name,...args));}
 return {boat,host,manager,effects,camera,original,update:()=>{(host as any).updateBoats([boat]);return (host as any).boatDamage.get(boat)?.fire as typeof original;}};
}
for(const [i,row] of reference.cases.entries())test(`native boat fire ownership gate ${i}`,()=>{
 const f=fixture(row.input);try{const fire=f.update();expect(!!fire).toBe(row.hasFire);if(fire){expect(fire.playStatus).toBe(FX_PLAY.playing);if(f.original)expect(fire).toBe(f.original);}if(row.calls.some(c=>c.call==='kill'))expect(f.original!.killStatus).toBe(FX_KILL.killed);}finally{f.host.dispose();}
});
for(const [model,expected] of [[430,[-1.5,-.5,1.2]],[452,[.4,-2.4,.8]],[453,[2,-1,.5]],[484,[-1.5,-.5,1.2]]] as const)test(`boat ${model} uses the PC fire location without an engine-frame fallback`,()=>{
 const f=fixture({...reference.cases[0].input,model});try{const fire=f.update()!;expect(Array.from(fire.local).slice(9)).toEqual(expected.map(Math.fround));expect(f.boat.fireDummy()).toEqual({x:Math.fround(expected[0]),y:Math.fround(expected[1]),z:Math.fround(expected[2])});}finally{f.host.dispose();}
});
test('boat fire does not request car overheat smoke or add engine velocity to particles',()=>{
 const f=fixture();try{const overheat=vi.spyOn(f.effects,'overheat'),fire=f.update()!;expect(overheat).not.toHaveBeenCalled();expect(fire.velAdd).toEqual([0,0,0]);}finally{f.host.dispose();}
});
test('partial repairs retain the same fire, with no duplicate creation, until above 460',()=>{
 const f=fixture();try{const first=f.update()!,create=vi.spyOn(f.manager,'create');for(const health of [250,300,460]){f.boat.health=health;expect(f.update()).toBe(first);}expect(create).not.toHaveBeenCalled();f.boat.health=461;expect(f.update()).toBeUndefined();expect(first.killStatus).toBe(FX_KILL.killed);}finally{f.host.dispose();}
});
test('camera distance governs birth while an existing fire stays attached outside that square',()=>{
 const f=fixture();try{f.camera.position.set(200,0,0);expect(f.update()).toBeUndefined();f.camera.position.set(199,0,-199);const fire=f.update()!;expect(fire).toBeDefined();f.camera.position.set(500,0,500);expect(f.update()).toBe(fire);expect(fire.parent).toBe((f.host as any).boatDamage.get(f.boat).matrix);}finally{f.host.dispose();}
});
test('bounds-cull failure retries with the ordinary native creation flag and removal kills the owned fire',()=>{
 const f=fixture();try{const create=vi.spyOn(f.manager,'create');create.mockReturnValueOnce(undefined);expect(f.update()).toBeUndefined();const fire=f.update()!;expect(fire).toBeDefined();expect(create.mock.calls.filter(c=>c[0]==='fire_car').every(c=>c[3]!==true)).toBe(true);(f.host as any).updateBoats([]);expect(fire.killStatus).toBe(FX_KILL.killed);}finally{f.host.dispose();}
});
