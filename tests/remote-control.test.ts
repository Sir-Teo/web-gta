import {expect,test} from 'vitest';
import {NativeRemoteControl} from '../src/simulation/nativeRemoteControl';

test('remote acquisition and camera switches do not use player occupancy',()=>{
 const rc=new NativeRemoteControl();
 expect(rc.inRemoteMode).toBe(false);
 expect(rc.take(10)).toEqual({previous:undefined,switchType:1});
 expect(rc.inRemoteMode).toBe(true);
 expect(rc.take(10)).toEqual({previous:10,switchType:1});
 expect(rc.take(11)).toEqual({previous:10,switchType:2});
 expect(rc.give(12)).toEqual({switchType:1});expect(rc.vehicle).toBe(12);
});

test('remove retains the query target, fades after one second and removes strictly after two',()=>{
 const rc=new NativeRemoteControl();rc.give(10);
 expect(rc.remove(500,false)).toBe(true);
 expect(rc.vehicle).toBe(10);expect(rc.inRemoteMode).toBe(true);expect(rc.createExplosion).toBe(false);
 expect(rc.process(1499,1480)).toEqual({fadeOut:false,restore:false});
 expect(rc.process(1500,1499)).toEqual({fadeOut:true,restore:false});
 expect(rc.process(1510,1500)).toEqual({fadeOut:false,restore:false});
 expect(rc.process(2500,2480)).toEqual({fadeOut:false,restore:false});
 expect(rc.inRemoteMode).toBe(true);
 expect(rc.process(2501,2500)).toEqual({fadeOut:false,restore:true,removeVehicle:10});
 expect(rc.inRemoteMode).toBe(false);
 expect(rc.process(3000,2501)).toEqual({fadeOut:false,restore:false});
});

test('repeated removal restarts the native timer and records the requested explosion separately',()=>{
 const rc=new NativeRemoteControl();
 expect(rc.remove(0,true)).toBe(false);rc.give(5);
 expect(rc.remove(0,true,true)).toBe(false);expect(rc.afterExplosion).toBe(false);
 rc.remove(0,true);expect(rc.createExplosion).toBe(true);
 rc.remove(900,false);expect(rc.createExplosion).toBe(false);
 expect(rc.process(1000,980).fadeOut).toBe(false);
 expect(rc.process(1900,1880).fadeOut).toBe(true);
 expect(rc.process(2900,2880).removeVehicle).toBeUndefined();
 expect(rc.process(2901,2900).removeVehicle).toBe(5);
});

test('deleting the target does not clear the independent post-explosion remote mode',()=>{
 const rc=new NativeRemoteControl();rc.give(5);rc.deleted(6);expect(rc.vehicle).toBe(5);
 rc.remove(0,true);rc.deleted(5);
 expect(rc.vehicle).toBeUndefined();expect(rc.inRemoteMode).toBe(true);
 expect(rc.process(2001,2000)).toEqual({fadeOut:false,restore:true,removeVehicle:undefined});
 expect(rc.inRemoteMode).toBe(false);
 rc.give(7);rc.deleted(7);expect(rc.inRemoteMode).toBe(false);
});

test('a dead or arrested player does not receive the camera fade, but the remote vehicle is still removed',()=>{
 const rc=new NativeRemoteControl();rc.give(5);rc.remove(0);
 expect(rc.process(1000,999,false)).toEqual({fadeOut:false,restore:false});
 expect(rc.process(2001,2000,false)).toEqual({fadeOut:false,restore:false,removeVehicle:5});
 expect(rc.inRemoteMode).toBe(false);
});

test('the elapsed clock wraps as an unsigned native timer and the detonation switches stay independent',()=>{
 const rc=new NativeRemoteControl();rc.give(5);rc.remove(0xffffff00,true);
 expect(rc.process(744,743).fadeOut).toBe(true);
 expect(rc.process(1744,1724).removeVehicle).toBeUndefined();
 expect(rc.process(1745,1744).removeVehicle).toBe(5);
 expect(rc.detonateDisabled).toBe(false);expect(rc.contactDetonateDisabled).toBe(false);
 rc.setDetonateEnabled(false);expect(rc.detonateDisabled).toBe(true);expect(rc.contactDetonateDisabled).toBe(false);
 rc.setContactDetonateEnabled(false);rc.setDetonateEnabled(true);
 expect(rc.detonateDisabled).toBe(false);expect(rc.contactDetonateDisabled).toBe(true);
 rc.clear();expect(rc).toMatchObject({vehicle:undefined,afterExplosion:false,createExplosion:false,fadeAfterExplosion:false,
  removalTimeMs:0,detonateDisabled:false,contactDetonateDisabled:false});
});

test('a new target does not silently clear a native delayed hand-back already in progress',()=>{
 const rc=new NativeRemoteControl();rc.give(5);rc.remove(0);rc.take(6);
 expect(rc.afterExplosion).toBe(true);expect(rc.process(2001,2000).removeVehicle).toBe(6);
});
