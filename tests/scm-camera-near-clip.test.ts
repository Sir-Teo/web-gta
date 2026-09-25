import {expect,test} from 'vitest';
import {ScmCamera} from '../src/engine/ScmCamera';

test('SET_NEAR_CLIP holds until the camera is restored, either way',()=>{
 const camera=new ScmCamera();
 expect(camera.useNearClipScript).toBe(false);
 camera.setNearClipScript(.1);
 expect([camera.useNearClipScript,camera.nearClipScript]).toEqual([true,.1]);
 camera.restore({inVehicle:false,enteringCar:false,exitingCar:false});
 expect(camera.useNearClipScript).toBe(false);
 camera.setNearClipScript(.2);camera.restoreWithJumpCut({inVehicle:false,enteringCar:false,exitingCar:false});
 expect(camera.useNearClipScript).toBe(false);
});
