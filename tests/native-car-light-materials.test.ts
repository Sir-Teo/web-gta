import {expect,test} from 'vitest';
import {MeshBasicMaterial} from 'three';
import type {ModelTexture} from '../src/assets/modelTextures';
import type {ModelMaterialBinding} from '../src/assets/ModelObjects';
import {nativeCarLightSlot,bindNativeCarLightMaterials} from '../src/render/nativeCarLightMaterials';
import {bindNativeCarPaint} from '../src/render/nativeCarPaint';
const markers=[[255,175,0],[0,255,200],[185,255,0],[255,60,0]],slots=['leftFront','rightFront','leftRear','rightRear'];
const texture={name:'vehiclelights128'} as ModelTexture;
function binding(rgb:number[],selected=texture):ModelMaterialBinding{
 const material=new MeshBasicMaterial({opacity:.25});material.color.setRGB(...rgb.map(v=>v/255) as [number,number,number]);
 return {material,texture:selected,geometryFlags:64,source:{color:[...rgb,64],texture:'vehiclelights128',mask:'',filter:1,addressU:1,addressV:1,surface:[.5,0,.7]}};
}
test('light markers use exact RGB and the native front/rear and left/right order',()=>{
 markers.forEach((rgb,i)=>{for(const alpha of [0,64,255])expect(nativeCarLightSlot([...rgb,alpha])).toBe(slots[i]);});
 expect(nativeCarLightSlot([255,174,0])).toBeUndefined();expect(nativeCarLightSlot([60,255,0])).toBeUndefined();
});
test('only the resolved light texture is whitened, including unclassified markers, preserving alpha and paint separation',()=>{
 const all=[...markers.map(m=>binding(m)),binding([60,255,0]),binding([1,2,3]),binding(markers[0],{...texture})];
 expect(()=>bindNativeCarLightMaterials(all,undefined as unknown as ModelTexture)).toThrow(/required/);
 const sources=structuredClone(all.map(b=>b.source));
 const targets=bindNativeCarLightMaterials(all,texture);expect(targets.map(t=>t.slot)).toEqual([...slots,undefined,undefined]);
 bindNativeCarPaint(all,texture).setColors([[20,30,40],[50,60,70],[80,90,100],[110,120,130]]);
 for(const {binding:b} of targets){expect(b.material.color.toArray()).toEqual([1,1,1]);expect(b.material.opacity).toBe(.25);expect(b.material.userData.nativeFadeColor).toEqual([1,1,1]);}
 expect(all[6].material.color.toArray()).toEqual(markers[0].map(v=>v/255));expect(all.map(b=>b.source)).toEqual(sources);
 all.forEach(b=>b.material.dispose());
});
