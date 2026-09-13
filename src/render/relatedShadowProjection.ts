import {Matrix4,type OrthographicCamera} from 'three';
/** Candidate mapping from reVC's CastShadowEntityXYZ, not yet verified for SA.
 * Converts runtime world positions to framebuffer U/V and normalized projection depth.
 * Keep this separate from both capture orientation and generic footprint UVs. */
export function viceCityShadowProjection(camera:OrthographicCamera){
 const radius=camera.right;
 if(!Number.isFinite(radius)||radius<=0||camera.left!==-radius||camera.top!==radius||camera.bottom!==-radius||camera.zoom!==1||camera.parent||camera.view?.enabled)throw new Error('Related shadow projection requires a square unparented capture camera.');
 camera.updateMatrixWorld(true);
 if(!camera.matrixWorld.elements.every(Number.isFinite)||Math.abs(camera.matrixWorld.determinant())<1e-12)throw new Error('Invalid related shadow camera transform.');
 // Recover RW left/up/forward from Three right/up/back, then apply the
 // source's local -45 degree X pre-concatenation before inversion.
 const frame=camera.matrixWorld.clone().multiply(new Matrix4().makeScale(-1,1,-1)).multiply(new Matrix4().makeRotationX(-Math.PI/4));
 const horizontal=-.5/(radius*.9),depth=1/(radius*.8);
 // Source U offset is .5, V offset is zero. Flip V for framebuffer textures.
 const mapping=new Matrix4().makeTranslation(.5,1,0).multiply(new Matrix4().makeScale(horizontal,-horizontal,depth)).multiply(frame.invert());
 // General 4x4 inversion can round homogeneous W away from one even for
 // this strictly affine camera transform. Preserve its exact affine contract.
 mapping.elements[3]=mapping.elements[7]=mapping.elements[11]=0;mapping.elements[15]=1;
 return mapping;
}
