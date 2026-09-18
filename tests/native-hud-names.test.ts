import {describe,expect,it} from 'vitest';
import {NAME_DONT_SHOW,NAME_FADE_OUT,NAME_SHOW,NativeHudNames} from '../src/ui/nativeHudNames';

const run=(names:NativeHudNames,ms:number,step=20,o={})=>{let last;for(let t=0;t<ms;t+=step)last=names.update(step,o);return last!;};
describe('CHud::DrawAreaName and DrawVehicleName',()=>{
 it('fades a zone name in over 1 s, holds it until 3 s from the start and fades it out over 1 s',()=>{
  const n=new NativeHudNames();n.setZoneName('Ganton');
  expect(run(n,500).zone!.alpha).toBeCloseTo(.5*255,0);
  expect(run(n,600).zone!.alpha).toBe(255);expect(n.zone.state).toBe(NAME_SHOW);
  run(n,1960);expect(n.zone.state).toBe(NAME_FADE_OUT);
  run(n,1100);expect(n.zone.state).toBe(NAME_DONT_SHOW);expect(n.update(20).zone).toBeUndefined();
 });
 it('only takes a new zone name while none is showing, unless told to show it at once',()=>{
  const n=new NativeHudNames();n.setZoneName('Ganton');run(n,200);
  n.setZoneName('Idlewood');expect(run(n,200).zone!.text).toBe('Ganton');
  n.setZoneName('Idlewood',true);run(n,1500);expect(n.update(20).zone!.text).toBe('Idlewood');
 });
 it('shows the vehicle name while driving and pushes the zone name out',()=>{
  const n=new NativeHudNames();n.setZoneName('Ganton');run(n,1500);
  n.setVehicleName('Greenwood');const out=run(n,1200);
  expect(out.vehicle!.text).toBe('Greenwood');expect(out.vehicle!.alpha).toBe(255);
  expect(n.zone.state).toBe(NAME_DONT_SHOW);
  // Leaving the car drops the name at once.
  n.setVehicleName(undefined);expect(n.update(20).vehicle).toBeUndefined();
 });
 it('hides the zone name under a message and fades it out',()=>{
  const n=new NativeHudNames();n.setZoneName('Ganton');run(n,1500);
  expect(n.update(20,{bigMessage:true}).zone).toBeUndefined();expect(n.zone.state).toBe(NAME_FADE_OUT);
 });
});
