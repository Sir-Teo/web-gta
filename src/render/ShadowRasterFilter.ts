import {Camera,ClampToEdgeWrapping,LinearFilter,Mesh,NoBlending,NoColorSpace,PlaneGeometry,Scene,ShaderMaterial,Vector2,Vector4,WebGLRenderTarget,type Texture,type WebGLRenderer} from 'three';
/** CShadowCamera resample and paired bilinear blur, converted from D3D9 pixel
 * centers to WebGL. Input is a borrowed 2x-size linear/clamped intensity raster. */
export class ShadowRasterFilter {
 private targets:WebGLRenderTarget[];
 private scene=new Scene();private camera=new Camera();
 private geometry=new PlaneGeometry(2,2);
 private material=new ShaderMaterial({uniforms:{source:{value:null},offset:{value:new Vector2()}},vertexShader:'varying vec2 sampleUv; void main(){sampleUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',fragmentShader:'uniform sampler2D source;uniform vec2 offset;varying vec2 sampleUv;void main(){gl_FragColor=vec4(texture2D(source,sampleUv+offset).rgb,1.0);}',depthTest:false,depthWrite:false,toneMapped:false,blending:NoBlending});
 private disposed=false;
 constructor(readonly size=64){
  if(!Number.isInteger(size)||size<8||size>512||(size&(size-1)))throw new Error('Invalid shadow filter size.');
  this.targets=[0,1].map(()=>{
   const target=new WebGLRenderTarget(size,size,{minFilter:LinearFilter,magFilter:LinearFilter,wrapS:ClampToEdgeWrapping,wrapT:ClampToEdgeWrapping,generateMipmaps:false,depthBuffer:false,stencilBuffer:false});target.texture.colorSpace=NoColorSpace;return target;
  });
  const quad=new Mesh(this.geometry,this.material);quad.frustumCulled=false;this.scene.add(quad);
 }
 get texture(){return this.targets[0].texture;}
 get target(){return this.targets[0];}
 update(renderer:WebGLRenderer,input:Texture,passes:number){
  if(this.disposed)throw new Error('Shadow filter is disposed.');
  if(!Number.isInteger(passes)||passes<0||passes>16)throw new Error('Invalid shadow blur pass count.');
  if(this.targets.some(t=>t.texture===input))throw new Error('Shadow filter cannot sample its own output.');
  const image=input.image as {width?:number;height?:number}|undefined;
  if(image?.width!==this.size*2||image?.height!==this.size*2||input.minFilter!==LinearFilter||input.magFilter!==LinearFilter||input.wrapS!==ClampToEdgeWrapping||input.wrapT!==ClampToEdgeWrapping||input.colorSpace!==NoColorSpace)throw new Error('Shadow filter requires a double-size linear clamped intensity raster.');
  const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),viewport=renderer.getViewport(new Vector4()),scissor=renderer.getScissor(new Vector4()),scissorTest=renderer.getScissorTest();
  const auto=renderer.autoClear,xr=renderer.xr.enabled,shadows=renderer.shadowMap.autoUpdate,pending=renderer.shadowMap.needsUpdate;
  const draw=(source:Texture,destination:WebGLRenderTarget,offset:number)=>{
   this.material.uniforms.source.value=source;
   // Native screen V grows downward; framebuffer texture V grows upward.
   this.material.uniforms.offset.value.set(offset,-offset);
   renderer.setRenderTarget(destination);renderer.setViewport(0,0,this.size,this.size);renderer.render(this.scene,this.camera);
  };
  try{
   renderer.autoClear=false;renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.setScissorTest(false);
   // Native +0.5/size UV starts at integer D3D9 pixel centers. WebGL already
   // samples at half-pixel centers, so the resample needs no additional offset.
   draw(input,this.targets[0],0);
   for(let i=0;i<passes;i++){draw(this.targets[0].texture,this.targets[1],.5/this.size);draw(this.targets[1].texture,this.targets[0],-.5/this.size);}
  }finally{
   this.material.uniforms.source.value=null;
   renderer.autoClear=auto;renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadows;renderer.shadowMap.needsUpdate=pending;
   renderer.setRenderTarget(target,face,mip);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
  }
  return this.texture;
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.targets.forEach(t=>t.dispose());this.geometry.dispose();this.material.dispose();}
}
