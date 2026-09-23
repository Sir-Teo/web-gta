import {expect,test} from 'vitest';
import {Group,Quaternion,Vector3} from 'three';
import {NativeIkChain,ARM_LIMITS,eulerDegToQuat,quatToEulerDeg,stepIkBlend} from '../src/animation/nativeIkChain';

test('QuatToEuler and EulerToQuat round-trip the Tait-Bryan XYZ angles away from gimbal lock',()=>{
 for(const e of [[10,20,30],[-45,5,-120],[80,-60,170]] as [number,number,number][]){
  const back=quatToEulerDeg(eulerDegToQuat(e));
  back.forEach((v,i)=>expect(v).toBeCloseTo(e[i],4));
 }
});

test('the blend step keeps the original lerp: a target renewed every frame is approached, one left alone is reached',()=>{
 // UpdatePointArmInfo every 1/30 s frame: 250 ms ahead each time, so the step is 33.3 / (250 − 33.3) of what remains.
 let blend=0;for(let frame=0;frame<30;frame++){const now=frame*1000/30;blend=stepIkBlend(blend,1,now,now+250,1000/30);}
 expect(blend).toBeGreaterThan(.98);expect(blend).toBeLessThan(1);
 expect(stepIkBlend(.4,0,1000,900,1000/30)).toBe(0);
});

/** A straight three-bone arm along +X hanging off a pivot, the forearm hinged about Z as the SA rigs are. */
function arm(){
 const neck=new Group(),clavicle=new Group(),upper=new Group(),fore=new Group(),hand=new Group();
 neck.add(clavicle);clavicle.add(upper);upper.position.set(.2,0,0);upper.add(fore);fore.position.set(.3,0,0);fore.add(hand);hand.position.set(.3,0,0);
 // A bent elbow, as the aim clips' ready frames leave it, and a gun hand whose local Y (PointArm's effector offset)
 // runs along the arm.
 fore.quaternion.setFromAxisAngle(new Vector3(0,0,1),-100*Math.PI/180);
 hand.quaternion.setFromAxisAngle(new Vector3(0,0,1),-Math.PI/2);
 // Bones own their matrices, as the game's rigs do (the solver writes them directly).
 for(const o of [neck,clavicle,upper,fore,hand]){o.updateMatrix();o.matrixAutoUpdate=false;}
 neck.updateMatrixWorld(true);
 return {neck,clavicle,upper,fore,hand};
}

test('the point-arm chain straightens toward the target and never bends the elbow the wrong way',()=>{
 const {neck,clavicle,upper,fore,hand}=arm();
 const chain=new NativeIkChain(neck,[{object:hand,limits:ARM_LIMITS.hand},{object:fore,limits:ARM_LIMITS.foreArm,hinge:[-160,0]},{object:upper,limits:ARM_LIMITS.upperArm},{object:clavicle,limits:ARM_LIMITS.clavicle}],new Vector3(0,.05,0),.5);
 chain.blend=1;const target=new Vector3(20,0,0);
 for(let frame=0;frame<60;frame++){chain.moveToTarget(target);chain.blendKeyframes();neck.updateMatrixWorld(true);}
 const shoulder=new Vector3().setFromMatrixPosition(upper.matrixWorld),wrist=new Vector3().setFromMatrixPosition(hand.matrixWorld);
 const pointing=wrist.clone().sub(shoulder).normalize();
 expect(pointing.dot(target.clone().sub(shoulder).normalize())).toBeGreaterThan(.98);
 const elbow=quatToEulerDeg(new Quaternion().setFromRotationMatrix(fore.matrix))[2];
 expect(elbow).toBeLessThanOrEqual(1e-6);expect(elbow).toBeGreaterThan(-45);
});

test('blend zero leaves the animated pose untouched',()=>{
 const {neck,clavicle,upper,fore,hand}=arm(),before=fore.matrix.clone();
 const chain=new NativeIkChain(neck,[{object:hand,limits:ARM_LIMITS.hand},{object:fore,limits:ARM_LIMITS.foreArm,hinge:[-160,0]},{object:upper,limits:ARM_LIMITS.upperArm},{object:clavicle,limits:ARM_LIMITS.clavicle}]);
 chain.moveToTarget(new Vector3(0,5,0));chain.blendKeyframes();
 fore.matrix.elements.forEach((v,i)=>expect(v).toBeCloseTo(before.elements[i],6));
});
