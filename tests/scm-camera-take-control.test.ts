import {expect,test} from 'vitest';
import {ScmCamera,MODE_CAM_ON_A_STRING,MODE_FIXED,MODE_FOLLOWPED} from '../src/engine/ScmCamera';

test('CCamera::TakeControl puts the camera on an entity, yields to a cutscene, and is cleared by the restores',()=>{
 const camera=new ScmCamera();
 camera.takeControl({kind:'vehicle',handle:9},MODE_FIXED,2,2);
 expect(camera.targetEntity).toEqual({kind:'vehicle',handle:9});expect(camera.modeToGoTo).toBe(MODE_FIXED);
 expect(camera.lookingAtPlayer).toBe(false);expect(camera.lookingAtVector).toBe(false);expect(camera.whoIsInControlOfTheCamera).toBe(2);
 // MODE_NONE picks the entity's own camera.
 camera.takeControl({kind:'ped',handle:3},0,2,2);expect(camera.modeToGoTo).toBe(MODE_FOLLOWPED);
 camera.takeControl({kind:'vehicle',handle:9},0,2,2);expect(camera.modeToGoTo).toBe(MODE_CAM_ON_A_STRING);
 // A cutscene holds the camera: the script's request waits.
 camera.whoIsInControlOfTheCamera=1;camera.takeControl({kind:'ped',handle:4},MODE_FIXED,2,2);expect(camera.targetEntity).toEqual({kind:'vehicle',handle:9});
 // The no-entity form and the restores drop the entity.
 camera.whoIsInControlOfTheCamera=2;camera.takeControlNoEntity({x:1,y:2,z:3},2,2);expect(camera.targetEntity).toBeUndefined();
 camera.takeControl({kind:'ped',handle:4},MODE_FIXED,2,2);
 camera.restore({inVehicle:false,enteringCar:false,exitingCar:false} as never);expect(camera.targetEntity).toBeUndefined();expect(camera.lookingAtPlayer).toBe(true);
});
