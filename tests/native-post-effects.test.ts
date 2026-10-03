import {expect,test} from 'vitest';
import {colourFilterFactor,colourMultFactor,lightingFromCol,postFxPasses,screenExtraMult,SCREEN_EXTRA_MULT_BASE_CAP,nightVisionFlash,infraredExpansions,NIGHT_VISION_TINT,INFRARED_COLOUR,INFRARED_TINT,NIGHT_VISION_GRAIN,INFRARED_GRAIN,waterGreen,underWaterColour,underWaterWave,underWaterXOffset} from '../src/world/nativePostEffects';
test('the two post-effect passes add colour x alpha x screen each: one multiplier of the frame',()=>{
 expect(colourFilterFactor({r:255,g:0,b:0,a:255},{r:0,g:0,b:0,a:0})).toEqual([1,0,0]);
 const f=colourFilterFactor({r:128,g:64,b:32,a:128},{r:64,g:64,b:64,a:64});
 expect(f[0]).toBeCloseTo(128/255*128/255+64/255*64/255,9);expect(f[1]).toBeCloseTo(64/255*128/255+64/255*64/255,9);expect(f[2]).toBeCloseTo(32/255*128/255+64/255*64/255,9);
 expect(colourFilterFactor({r:255,g:255,b:255,a:255},{r:255,g:255,b:255,a:255})).toEqual([1,1,1]);
});
test('night vision and infrared grey both passes to 64; the riots multiplier scales pass 1; the extra multiplier both',()=>{
 const [p1,p2]=postFxPasses({r:200,g:100,b:50,a:90},{r:10,g:20,b:30,a:40},{vision:true});
 expect(p1).toEqual({r:64,g:64,b:64,a:90});expect(p2).toEqual({r:64,g:64,b:64,a:40});
 const [q1,q2]=postFxPasses({r:200,g:100,b:50,a:90},{r:10,g:20,b:30,a:40},{laRiotsLightMult:.5});
 expect(q1).toEqual({r:100,g:50,b:25,a:90});expect(q2).toEqual({r:10,g:20,b:30,a:40});
 // At the cap the multiplier is 1; at no lighting it doubles (and the uint8 cast wraps 400 to 144).
 expect(colourMultFactor(SCREEN_EXTRA_MULT_BASE_CAP)).toBe(1);expect(colourMultFactor(0)).toBe(2);expect(colourMultFactor(.175)).toBeCloseTo(1.5,9);
 const [d1]=postFxPasses({r:200,g:100,b:50,a:90},{r:10,g:20,b:30,a:40},{extraMult:0});
 expect(d1).toEqual({r:144,g:200,b:100,a:90});
});
test('s_ExtraMult creeps toward the collision lighting at 0.0005 a step and never passes 0.35',()=>{
 expect(screenExtraMult(.35,.9,1)).toBe(.35);
 expect(screenExtraMult(.35,.1,1)).toBeCloseTo(.3495,9);
 expect(screenExtraMult(.2,.9,2)).toBeCloseTo(.201,9);
 expect(screenExtraMult(.2,.2002,1)).toBeCloseTo(.2002,9);
});
test('the lighting from the collision surface is the averaged ambient plus the contact brightness',()=>{
 expect(lightingFromCol([.3,.3,.3],1,true)).toBeCloseTo(1.3,9);
 expect(lightingFromCol([.3,.6,.9],.5,false)).toBeCloseTo(1.1,9);
 // The exterior scale only applies with the unknown fraction supplied.
 expect(lightingFromCol([.3,.3,.3],.5,false,{sum1:765,sum2:0},.5)).toBeCloseTo(.8,9);
 expect(lightingFromCol([.3,.3,.3],.5,false,{sum1:0,sum2:765},.5)).toBeCloseTo(.8,9);
});
test('the night vision flash lowers the count to at most zero before its loop, so it never draws',()=>{
 // The loop counts the lowered count, which is never above zero: no flash quad is ever drawn.
 expect(nightVisionFlash(50,1.5)).toEqual({draws:0,next:0});
 expect(nightVisionFlash(0,1)).toEqual({draws:0,next:0});expect(nightVisionFlash(-3,1)).toEqual({draws:0,next:-3});
 expect(nightVisionFlash(.7,2)).toEqual({draws:0,next:-1.3});
 expect(NIGHT_VISION_TINT).toEqual([32,255,32]);expect(NIGHT_VISION_GRAIN).toBe(48);
});
test('infrared draws the buffer four times grown by 0.3 px steps in (255, 60, 40), tints magenta and grains at 64',()=>{
 expect(infraredExpansions().map(v=>+v.toFixed(4))).toEqual([.3,.6,.9,1.2]);
 expect(INFRARED_COLOUR).toEqual([255,60,40]);expect(INFRARED_TINT).toEqual([255,64,255]);expect(INFRARED_GRAIN).toBe(64);
});
test('under water s_WaterGreen climbs to 24, the colour is the water colour plus 184 darkened by depth, and the rows sway',()=>{
 expect(waterGreen(0,true,1.5)).toBe(1.5);expect(waterGreen(23.2,true,2)).toBe(24);expect(waterGreen(10,false,1)).toBe(0);
 expect(underWaterColour(0,0)).toEqual([248,248,248]);expect(underWaterColour(24,0)).toEqual([248,255,248]);
 expect(underWaterColour(24,45)).toEqual([124,127,124]);expect(underWaterColour(24,200)).toEqual([0,0,0]);expect(underWaterColour(24,45,false)).toEqual([0,0,0]);
 expect(underWaterXOffset(24,640)).toBe(4);expect(underWaterXOffset(12,1280)).toBe(4);
 expect(underWaterWave(0,0,4)).toBe(0);expect(underWaterWave(Math.PI/2/.04,0,4)).toBeCloseTo(4,9);
});

test('the colour filter scales the frame in place, with no copy of it, unless the goggles or the water read the copy',async()=>{
 const {NativePostEffects}=await import('../src/render/NativePostEffects');
 const fx=new NativePostEffects(undefined,()=>.5),quads=()=>Object.fromEntries(fx.colourFilterQuads.map(q=>[q.name,q.visible]));
 const colour=(q:string)=>[...(fx.colourFilterQuads.find(x=>x.name===q)!.material.uniforms.colour.value as {toArray():number[]}).toArray()];
 // A day's filter, the sum under one: one scale draw of 1 + K, the native passes and the copy idle.
 fx.update({r:128,g:64,b:32,a:128},{r:64,g:64,b:64,a:64});
 expect(quads()).toEqual({'Native colour filter pass 1':false,'Native colour filter pass 2':false,'Native colour filter scale 1':true,'Native colour filter scale 2':false});
 const k=[128,64,32].map(c=>c/255*128/255+64/255*64/255);colour('Native colour filter scale 1').forEach((v,i)=>expect(v).toBeCloseTo(k[i],6));
 expect(fx.snapshot().colourFilter.visible).toBe(true);
 // Past one the second draw takes the rest, so the two compound to 1 + K.
 fx.update({r:255,g:255,b:255,a:255},{r:255,g:128,b:0,a:255});
 const k1=colour('Native colour filter scale 1'),k2=colour('Native colour filter scale 2'),sum=[2,1+128/255,1];
 expect(quads()['Native colour filter scale 2']).toBe(true);
 for(let i=0;i<3;i++)expect((1+k1[i])*(1+k2[i])).toBeCloseTo(1+sum[i],6);
 // The goggles read the copied frame: the native passes over it, then.
 fx.update({r:128,g:64,b:32,a:128},{r:64,g:64,b:64,a:64},{vision:'nightvision'});
 expect(quads()).toMatchObject({'Native colour filter pass 1':true,'Native colour filter pass 2':true,'Native colour filter scale 1':false,'Native colour filter scale 2':false});
});
