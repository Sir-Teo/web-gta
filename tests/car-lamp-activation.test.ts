import {expect,test,vi} from 'vitest';
import {setCarLightState,LIGHT_SURFACE} from '../src/render/nativeCarLightMaterials';
import {WorldCar} from '../src/simulation/WorldCar';

function lamps(){
 return ['leftFront','rightFront','leftRear','rightRear'].map(slot=>({slot:slot as 'leftFront'|'rightFront'|'leftRear'|'rightRear',litMap:'on',unlit:{map:'off',ambient:.5,diffuse:.8},binding:{material:{map:'off',color:{setRGB:vi.fn()},userData:{nativeSurface:{ambient:{value:.5},diffuse:{value:.8}}}}}}));
}
test('night lights activate both rear material slots without a brake pedal',()=>{
 const targets=lamps();setCarLightState(targets,{brake:false,headlights:true});
 for(const {binding:{material}} of targets){expect(material.map).toBe('on');expect(material.userData.nativeSurface.ambient.value).toBe(LIGHT_SURFACE.ambient);}
 setCarLightState(targets,{brake:false,headlights:false});
 for(const {binding:{material}} of targets){expect(material.map).toBe('off');expect(material.userData.nativeSurface.ambient.value).toBe(.5);}
});
test('night rear materials respect independent damaged-light slots',()=>{
 const targets=lamps();setCarLightState(targets,{brake:false,headlights:true,broken:[false,false,true,false]});
 expect(targets.map(t=>t.binding.material.map)).toEqual(['on','on','on','off']);
});
for(const [label,occupied,autopilot,handbrake,expected] of [
 ['player pedal',true,false,false,true],['player handbrake',true,false,true,false],
 ['AI pedal',false,true,false,true],['AI handbrake',false,true,true,false],
 ['empty car',false,false,false,false],
] as const)test(`WorldCar supplies native dynamic brake eligibility: ${label}`,()=>{
 const setLightState=vi.fn(),host={occupied,autopilot:autopilot?{}:undefined,lightsOn:false,damageState:{lights:[false,false,false,false]},input:{pedals:{brake:1,handbrake}},car:{setAmbient:vi.fn(),setLightState,setDirtLevel:vi.fn(),setReflection:vi.fn()}} as any;
 WorldCar.prototype.setLighting.call(host,undefined,undefined,1,0);
 expect(setLightState.mock.calls[0][0]).toBe(expected);
});
test('a script driver can operate rear brakes and a departed AI driver cannot',()=>{
 const previous=WorldCar.hasDriverPed;
 try{
  for(const scriptDriver of [false,true]){
   WorldCar.hasDriverPed=()=>scriptDriver;
   const setLightState=vi.fn(),host={occupied:false,autopilot:{},driverOut:true,lightsOn:false,damageState:{lights:[]},input:{pedals:{brake:1,handbrake:false}},car:{setAmbient:vi.fn(),setLightState,setDirtLevel:vi.fn(),setReflection:vi.fn()}} as any;
   WorldCar.prototype.setLighting.call(host,undefined,undefined,1,0);expect(setLightState.mock.calls[0][0]).toBe(scriptDriver);
  }
 }finally{WorldCar.hasDriverPed=previous;}
});
