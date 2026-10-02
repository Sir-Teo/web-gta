import {expect,test} from 'vitest';
import {AIM_ASSIST_KEEP,AIM_ASSIST_TAKE,AIM_CROSSHAIR_NDC,aimAssistTurn,pickAimTarget,type AimCandidate} from '../src/input/aimAssist';
const ray={origin:{x:0,y:1.5,z:0},direction:{x:0,y:0,z:-1}},player={x:0,y:1,z:-2};
/** A ped `distance` ahead of the camera and `angle` radians to the right of the ray. */
const ped=(handle:number,angle:number,distance=10,extra:Partial<AimCandidate>={}):AimCandidate=>({handle,position:{x:Math.sin(angle)*distance,y:1.5,z:-Math.cos(angle)*distance},...extra});
test('touch aim assist takes the ped nearest the crosshair in front, never the crew, a downed ped or one out of reach',()=>{
 expect(pickAimTarget([ped(1,.2),ped(2,.05),ped(3,-.1)],ray,player,40)?.handle).toBe(2);
 // Past the take angle, behind the camera, or beyond the gun's reach: nothing.
 expect(pickAimTarget([ped(1,AIM_ASSIST_TAKE+.05),ped(2,Math.PI)],ray,player,40)).toBeUndefined();
 expect(pickAimTarget([ped(1,0,60)],ray,player,40)).toBeUndefined();
 expect(pickAimTarget([ped(1,0,10,{crew:true}),ped(2,0,12,{down:true})],ray,player,40)).toBeUndefined();
 // A ped attacking the player counts as nearer the crosshair than a bystander.
 expect(pickAimTarget([ped(1,.05),ped(2,.08,10,{attacking:true})],ray,player,40)?.handle).toBe(2);
 // Out of sight (behind a wall) is passed over for the next.
 expect(pickAimTarget([ped(1,.02),ped(2,.1)],ray,player,40,undefined,c=>c.handle!==1)?.handle).toBe(2);
});
test('the ped already taken keeps the crosshair until it moves well away from it',()=>{
 expect(pickAimTarget([ped(1,.4),ped(2,.01)],ray,player,40,1)?.handle).toBe(1);
 expect(pickAimTarget([ped(1,AIM_ASSIST_KEEP+.05),ped(2,.01)],ray,player,40,1)?.handle).toBe(2);
});
test('the assist turns the camera toward a point off the crosshair, and not at all for one on it',()=>{
 const fov=52*Math.PI/180,aspect=16/9;
 expect(aimAssistTurn(AIM_CROSSHAIR_NDC,fov,aspect,1)).toEqual({yaw:-0,pitch:-0});
 // Right of and above the crosshair: the yaw falls (turning right) and the pitch falls (looking up).
 const turn=aimAssistTurn({x:.5,y:.5},fov,aspect,1);expect(turn.yaw).toBeLessThan(0);expect(turn.pitch).toBeLessThan(0);
 // The whole way is the angle between them; a share of it is that share.
 const tanY=Math.tan(fov/2);expect(turn.pitch).toBeCloseTo(-(Math.atan(.5*tanY)-Math.atan(AIM_CROSSHAIR_NDC.y*tanY)),12);
 expect(aimAssistTurn({x:.5,y:.5},fov,aspect,.25).yaw).toBeCloseTo(turn.yaw*.25,12);
});
