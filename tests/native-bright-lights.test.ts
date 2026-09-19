import {expect,test} from 'vitest';
import {NativeBrightLights,BRIGHT_LIGHT,MAX_NUM_BRIGHTLIGHTS} from '../src/world/nativeBrightLights';
import {NativeCoronas} from '../src/world/nativeCoronas';
import {displayActualLight} from '../src/world/nativeTrafficLightCoronas';
import type {Model2dEffect} from '../src/assets/twoDEffect';

test('CBrightLights draws a big lens as a half-alpha hexagon and a small one as an octagon, fading from 45 to 60 units', () => {
 const b=new NativeBrightLights();
 b.registerOne([0,0,5],[0,0,1],[1,0,0],BRIGHT_LIGHT.redBig,[0,-30,5]);
 b.registerOne([2,0,5],[0,0,1],[1,0,0],BRIGHT_LIGHT.greenSmall,[0,-50,5]);
 b.registerOne([0,0,5],[0,0,1],[1,0,0],BRIGHT_LIGHT.yellowBig,[0,-61,5]);
 expect(b.lights).toHaveLength(2);
 const {positions,colors}=b.render(()=>100);
 // 4 triangles, then 6.
 expect(positions).toHaveLength((12+18)*3);
 // Red: 255, rnd, rnd with rnd = 100 / 5; half alpha for a big lens.
 expect(colors.slice(0,4)).toEqual([255,20,20,127]);
 // The hexagon's first corner: up × 0.162 and right × −0.09 (RegisterOne swaps the names).
 expect(positions.slice(0,3).map(v=>+v.toFixed(3))).toEqual([-.09,0,5.162]);
 // Green at 50.04 units: (1 − 5.04 / 15) × 255.
 expect(colors.slice(12*4,12*4+4)).toEqual([20,255,20,169]);
 expect(b.lights).toHaveLength(0);
 for(let i=0;i<40;i++)b.registerOne([0,0,5],[0,0,1],[1,0,0],BRIGHT_LIGHT.greenBig,[0,-1,5]);
 expect(b.lights).toHaveLength(MAX_NUM_BRIGHTLIGHTS);
});

test('DisplayActualLight registers the lit lens of the phase the camera faces', () => {
 const lamp=(y:number,color:[number,number,number]):Model2dEffect=>({position:[-3,y,3],type:0,light:{color:[...color,200],coronaFarClip:100,pointlightRange:18,coronaSize:1,shadowSize:8,flashType:7,enableReflection:true,flareType:0,shadowColorMultiplier:40,flags:1090,coronaTexture:'coronastar',shadowTexture:'shad_exp',shadowZDistance:0,offset:[0,0,100]}});
 const identity=[1,0,0,0,0,1,0,0,0,0,1,0,100,200,10,1];
 const frame={visual:[2,0] as [2,0],cameraForward:[0,1,0] as [number,number,number],camera:[100,190,12] as [number,number,number],spriteBrightness:10,spriteSize:10,lightsOnGroundBrightness:10,trafficLightsBrightness:1};
 const effects=[lamp(.8,[255,0,0]),lamp(.8,[0,255,0]),lamp(-.4,[255,0,0]),lamp(-.4,[0,255,0])];
 const big=new NativeBrightLights();displayActualLight({id:1,name:'trafficlight1',matrix:identity,effects},frame,new NativeCoronas(),big);
 expect(big.lights.map(l=>[l.color,...l.position])).toEqual([[BRIGHT_LIGHT.redBig,97,199.6,13]]);
 const small=new NativeBrightLights();displayActualLight({id:1,name:'cj_traffic_light4',matrix:identity,effects},frame,new NativeCoronas(),small);
 expect(small.lights[0].color).toBe(BRIGHT_LIGHT.redSmall);
});
