import {ClampToEdgeWrapping,Color,LinearFilter,Mesh,MeshBasicMaterial,NoBlending,NoColorSpace,Vector4,WebGLRenderTarget,type Camera,type Material,type Object3D,type WebGLRenderer} from 'three';

/** Pose-driven intensity raster for the projected-shadow pass. Renders only the
 * borrowed actor hierarchy, without reparenting it or advancing its animation.
 * This is the unblurred mask stage; native camera orientation/filtering are separate. */
export class CharacterSilhouette {
 readonly target:WebGLRenderTarget;
 private material=new MeshBasicMaterial({color:0xffffff,blending:NoBlending,toneMapped:false});
 private disposed=false;
 constructor(size=128){
  if(!Number.isInteger(size)||size<16||size>1024||(size&(size-1)))throw new Error('Invalid silhouette raster size.');
  this.target=new WebGLRenderTarget(size,size,{minFilter:LinearFilter,magFilter:LinearFilter,wrapS:ClampToEdgeWrapping,wrapT:ClampToEdgeWrapping,generateMipmaps:false,depthBuffer:true,stencilBuffer:false});
  this.target.texture.colorSpace=NoColorSpace;this.target.texture.name='Character silhouette intensity';
 }
 get texture(){return this.target.texture;}
 update(renderer:WebGLRenderer,actor:Object3D,camera:Camera){
  if(this.disposed)throw new Error('Character silhouette is disposed.');
  const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
  const viewport=renderer.getViewport(new Vector4()),scissor=renderer.getScissor(new Vector4()),scissorTest=renderer.getScissorTest();
  const clear=renderer.getClearColor(new Color()),alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear;
  const xr=renderer.xr.enabled,shadows=renderer.shadowMap.autoUpdate,shadowPending=renderer.shadowMap.needsUpdate;
  const meshes:{mesh:Mesh;material:Material|Material[];frustum:boolean}[]=[];
  try{
   actor.updateWorldMatrix(true,true);camera.updateWorldMatrix(true,false);
   actor.traverse(object=>{
    if(!(object instanceof Mesh))return;
    meshes.push({mesh:object,material:object.material,frustum:object.frustumCulled});
    object.material=this.material;object.frustumCulled=false;
   });
   renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.autoClear=false;
   renderer.setRenderTarget(this.target);renderer.setViewport(0,0,this.target.width,this.target.height);renderer.setScissorTest(false);renderer.setClearColor(0x000000,1);renderer.clear(true,true,false);
   renderer.render(actor,camera);
  }finally{
   for(const {mesh,material,frustum} of meshes){mesh.material=material;mesh.frustumCulled=frustum;}
   renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadows;renderer.shadowMap.needsUpdate=shadowPending;renderer.autoClear=autoClear;
   renderer.setRenderTarget(target,face,mip);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setClearColor(clear,alpha);
  }
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.target.dispose();this.material.dispose();}
}
