import {expect,test} from 'vitest';
import {colourFilterFactor,colourMultFactor,lightingFromCol,postFxPasses,screenExtraMult,SCREEN_EXTRA_MULT_BASE_CAP} from '../src/world/nativePostEffects';
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
