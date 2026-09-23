import {test,expect} from '@playwright/test';

test('aiming a pistol turns CJ\'s head to the aim point and releases it after, and the torso turns for the arm',async({page})=>{
 test.setTimeout(120000);await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:45000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.keyboard.press('Tab');await page.locator('[data-weapon="22"]').click();
 await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 const probe=()=>page.evaluate(()=>{
  const nc=(window as any).__game.render().nativeCharacter,THREE={Vector3:nc.root.position.constructor,Quaternion:nc.root.quaternion.constructor};
  const head=nc.bone(5),o=head.getWorldPosition(new THREE.Vector3()),forward=nc.headForward();
  const point=nc.weaponAimPoint,to=point?point.clone().sub(o).normalize():null;
  return {looking:nc.aimLooking,blend:nc.headLookBlend,dot:to?forward.dot(to):null};
 });
 await page.mouse.move(750,420);await page.mouse.down({button:'right'});
 // AimGun renews the LookAt once the aim clip passes 0.98 (1/8 s at 8 per second), and it blends in over 250 ms.
 await expect.poll(async()=>(await probe()).blend,{timeout:5000}).toBeGreaterThan(0.95);
 const aimed=await probe();
 await page.mouse.up({button:'right'});
 // AbortIK blends the look out over 250 ms and the chain ends.
 await expect.poll(async()=>(await probe()).looking,{timeout:5000}).toBe(false);
 const released=await probe();
 expect(aimed.looking).toBe(true);
 expect(aimed.dot).toBeGreaterThan(0.9);
 expect(released.blend).toBe(0);

 // CPedIK::RotateTorsoForArm: 70° to the left turns spine1 and the neck 12.5° each; 30° does nothing; 100° to the
 // right is a flat 20° (10° each).
 const turn=await page.evaluate(()=>{
  const nc=(window as any).__game.render().nativeCharacter,THREE={Vector3:nc.root.position.constructor,Quaternion:nc.root.quaternion.constructor};
  const spine=nc.bone(3),neck=nc.bone(4),origin=new THREE.Vector3().setFromMatrixPosition(nc.root.matrixWorld);
  const at=(deg:number)=>{const h=nc.renderedHeading+deg*Math.PI/180;return origin.clone().add(new THREE.Vector3(Math.sin(h),0,Math.cos(h)).multiplyScalar(10));};
  const angle=(deg:number)=>{
   const a=spine.matrix.clone(),b=neck.matrix.clone();nc.rotateTorsoForArm(at(deg));
   const q=(m:any)=>new THREE.Quaternion().setFromRotationMatrix(m);
   const r=[q(a).angleTo(q(spine.matrix))*180/Math.PI,q(b).angleTo(q(neck.matrix))*180/Math.PI];
   // The shoulder line's yaw about world up (counter-clockwise from above, as SA headings run) shows which way
   // the chest went.
   nc.root.updateMatrixWorld(true);const line=()=>{const r=nc.bone(21).getWorldPosition(new THREE.Vector3()).sub(nc.bone(31).getWorldPosition(new THREE.Vector3()));return Math.atan2(-r.z,r.x);};
   const after=line();spine.matrix.copy(a);neck.matrix.copy(b);nc.root.updateMatrixWorld(true);const before=line();
   return [...r.map(v=>+v.toFixed(2)),Math.sign(+(after-before).toFixed(3))];
  };
  return {left70:angle(70),left30:angle(30),right100:angle(-100)};
 });
 // The last entry is the direction the chest turned: toward the target each time.
 expect(turn.left70).toEqual([12.5,12.5,1]);
 expect(turn.left30).toEqual([0,0,0]);
 expect(turn.right100).toEqual([10,10,-1]);
});
