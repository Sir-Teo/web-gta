import {Camera,ClampToEdgeWrapping,DataTexture,LinearFilter,Mesh,NoBlending,NoColorSpace,PlaneGeometry,Scene,ShaderMaterial,Vector2,Vector4,WebGLRenderTarget,type Texture,type WebGLRenderer} from 'three';
/** CShadowCamera resample and paired bilinear blur, converted from D3D9 pixel
 * centers to WebGL. Input is a borrowed 2x-size linear/clamped intensity raster. */
export class ShadowRasterFilter {
 private targets:WebGLRenderTarget[];
 private scene=new Scene();private camera=new Camera();
 private geometry=new PlaneGeometry(2,2);
 private material=new ShaderMaterial({uniforms:{source:{value:null},offset:{value:new Vector2()},gradient:{value:null},gradientOffset:{value:new Vector2()},applyGradient:{value:false}},vertexShader:'varying vec2 sampleUv; void main(){sampleUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',fragmentShader:'uniform sampler2D source;uniform sampler2D gradient;uniform vec2 offset;uniform vec2 gradientOffset;uniform bool applyGradient;varying vec2 sampleUv;void main(){vec3 color=texture2D(source,sampleUv+offset).rgb;if(applyGradient)color*=texture2D(gradient,sampleUv+gradientOffset).rgb;gl_FragColor=vec4(color,1.0);}',depthTest:false,depthWrite:false,toneMapped:false,blending:NoBlending});
 private disposed=false;private gradient:DataTexture;private output=0;
 constructor(readonly size=64){
  if(!Number.isInteger(size)||size<8||size>512||(size&(size-1)))throw new Error('Invalid shadow filter size.');
  const bytes=new Uint8Array(size*size*4);
  // Native rows are written top-down, starting at 128 and decrementing by 64/size.
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const value=Math.trunc(128-(size-1-y)*64/size);bytes.set([value,value,value,255],(y*size+x)*4);}
  this.gradient=new DataTexture(bytes,size,size);this.gradient.minFilter=this.gradient.magFilter=LinearFilter;this.gradient.needsUpdate=true;
  this.material.uniforms.gradient.value=this.gradient;this.material.uniforms.gradientOffset.value.set(-.5/size,.5/size);
  this.targets=[0,1].map(()=>{
   const target=new WebGLRenderTarget(size,size,{minFilter:LinearFilter,magFilter:LinearFilter,wrapS:ClampToEdgeWrapping,wrapT:ClampToEdgeWrapping,generateMipmaps:false,depthBuffer:false,stencilBuffer:false});target.texture.colorSpace=NoColorSpace;return target;
  });
  const quad=new Mesh(this.geometry,this.material);quad.frustumCulled=false;this.scene.add(quad);
 }
 get texture(){return this.targets[this.output].texture;}
 get target(){return this.targets[this.output];}
 update(renderer:WebGLRenderer,input:Texture,passes:number,gradient=false){
  if(this.disposed)throw new Error('Shadow filter is disposed.');
  if(typeof gradient!=='boolean')throw new Error('Invalid shadow gradient selection.');
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
   this.output=0;this.material.uniforms.applyGradient.value=false;
   draw(input,this.targets[0],0);
   for(let i=0;i<passes;i++){draw(this.targets[0].texture,this.targets[1],.5/this.size);draw(this.targets[1].texture,this.targets[0],-.5/this.size);}
   if(gradient){this.material.uniforms.applyGradient.value=true;draw(this.targets[0].texture,this.targets[1],0);this.output=1;}
  }finally{
   this.material.uniforms.source.value=null;this.material.uniforms.applyGradient.value=false;
   renderer.autoClear=auto;renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadows;renderer.shadowMap.needsUpdate=pending;
   renderer.setRenderTarget(target,face,mip);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
  }
  return this.texture;
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.targets.forEach(t=>t.dispose());this.gradient.dispose();this.geometry.dispose();this.material.dispose();}
}
