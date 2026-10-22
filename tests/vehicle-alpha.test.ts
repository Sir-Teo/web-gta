import {expect,test,vi} from 'vitest';
import {MeshBasicMaterial} from 'three';
import {NativeClumpAlpha,nextVehicleClumpAlpha} from '../src/simulation/nativeClumpAlpha';
import {bindClumpAlpha} from '../src/render/nativeClumpAlpha';

test('vehicle clump alpha keeps signed script values and the iOS fade helper’s strict 255 boundary',()=>{
 expect(nextVehicleClumpAlpha(0)).toBe(16);expect(nextVehicleClumpAlpha(240)).toBe(255);expect(nextVehicleClumpAlpha(255)).toBe(255);expect(nextVehicleClumpAlpha(300)).toBe(300);
 expect(nextVehicleClumpAlpha(-20)).toBe(-4);expect(nextVehicleClumpAlpha(8,true)).toBe(0);expect(nextVehicleClumpAlpha(4,true)).toBe(0);expect(nextVehicleClumpAlpha(255,true)).toBe(247);
 const apply=vi.fn(),state=new NativeClumpAlpha(apply);state.set(0x1ffffffff);expect(state.value).toBe(-1);expect(apply).toHaveBeenLastCalledWith(-1/255);
});

test('the port’s native thirty Hz fade reaches 255 in sixteen frames and resets its phase on script assignment',()=>{
 const apply=vi.fn(),state=new NativeClumpAlpha(apply);state.set(0);state.step(1/60);expect(state.value).toBe(0);state.step(1/60);expect(state.value).toBe(16);
 for(let i=0;i<30;i++)state.step(1/60);expect(state.value).toBe(255);expect(apply).toHaveBeenLastCalledWith(1);
 state.set(128);state.step(1/60);expect(state.value).toBe(128);state.set(0);state.step(1/60);expect(state.value).toBe(0);state.step(1/60);expect(state.value).toBe(16);
});

test('clump fade scales original opaque/glass alpha, restores shader transparency and accepts later materials',()=>{
 const opaque=new MeshBasicMaterial(),glass=new MeshBasicMaterial({opacity:.4,transparent:true}),bindings=[{material:opaque},{material:glass}],set=bindClumpAlpha(()=>bindings);
 set(0);expect(opaque.opacity).toBe(0);expect(opaque.transparent).toBe(true);set(.5);expect(opaque.opacity).toBe(.5);expect(glass.opacity).toBe(.2);
 const later=new MeshBasicMaterial({opacity:.8});bindings.push({material:later});set(.25);expect(later.opacity).toBe(.2);set(1);expect(opaque.opacity).toBe(1);expect(opaque.transparent).toBe(false);expect(glass.opacity).toBe(.4);expect(glass.transparent).toBe(true);expect(later.opacity).toBe(.8);
 set(-1);expect(opaque.opacity).toBe(0);set(2);expect(opaque.opacity).toBe(1);for(const m of [opaque,glass,later])m.dispose();
});
