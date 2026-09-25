import * as THREE from 'three';
import {postFxPasses,type PostFxColour,NIGHT_VISION_TINT,NIGHT_VISION_FLASH_STEP,NIGHT_VISION_GRAIN,INFRARED_COLOUR,INFRARED_TINT,INFRARED_MAIN_COLOUR,INFRARED_GRAIN,infraredExpansions,nightVisionFlash,NIGHT_VISION_SWITCH_ON_FX_TIME,waterGreen,underWaterColour,underWaterWave,underWaterXOffset,WATER_Y_OFFSET,WATER_FX_START_UNDERWATERNESS} from '../world/nativePostEffects';
export type VisionMode='nightvision'|'infrared'|null;
type Quad=THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
const VERTEX='void main(){gl_Position=vec4(position.xy,0.,1.);}';
/** CPostEffects::Render over the drawn frame. The capture object copies the drawing buffer into a texture first
 * (RwRasterRenderFast into pRasterFrontBuffer), then the quads draw in the native order with the native blends:
 * ColourFilter's two passes (front buffer x pass colour, source alpha added to the frame), NightVision's one-frame
 * switch-on flash (the front buffer added int(count) times at 8/255, folded into one draw), its ZERO / SRCCOLOR
 * tint of (32, 255, 32) and Grain(48), InfraredVision's four additive draws of the front buffer in (255, 60, 40)
 * grown by 0.3 px steps, its (255, 64, 255) tint and Grain(64); the rain grain follows at order 1000. No depth,
 * no fog, nearest sampling, clamped addressing. The vision light setups (SetLightsForNightVision and the infrared
 * object lights) are not in the reference. */
export class NativePostEffects {
 readonly group=new THREE.Group();
 private front:THREE.FramebufferTexture;
 private size={width:0,height:0};
 private resolution=new THREE.Vector2(1,1);
 private capture:THREE.Mesh;
 private filterPasses:Quad[];
 private flash:Quad;private nightTint:Quad;private nightGrain:Quad;
 /** CPostEffects::DarknessFilter's black quad. */
 private darkness:Quad;
 private infraredPasses:Quad[];private infraredTint:Quad;private infraredMain:Quad;private infraredGrain:Quad;
 private grainTexture:THREE.DataTexture;private grainPixels=new Uint8Array(256*256*4);
 private ripple:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;private rippleRows=0;
 /** s_WaterGreen and the last underwater state. */
 private waterGreenValue=0;private underWaterState={active:false,depth:0};
 /** CPostEffects::m_bColorEnable. */
 colourFilterEnabled=true;
 /** m_bDarknessFilter and m_DarknessFilterAlpha (SET_DARKNESS_EFFECT; 170 by default). */
 darknessFilter=false;darknessAlpha=170;
 /** m_bHeatHazeFX (SET_HEATHAZE_EFFECT). HeatHazeFX itself is unreversed and not drawn. */
 heatHazeFX=false;
 /** ScriptDarknessFilterSwitch: -1 is the default alpha, anything else clamped to a byte. */
 scriptDarknessFilterSwitch(enable:boolean,alpha:number){this.darknessFilter=enable;this.darknessAlpha=alpha===-1?170:Math.max(0,Math.min(255,alpha));}
 /** ScriptResetForEffects, from RestorePlayerStuffDuringResurrection: the script's heat haze and darkness go. */
 scriptResetForEffects(){this.heatHazeFX=false;this.darknessFilter=false;}
 /** The pass colours last handed to ColourFilter (bytes). */
 private passes:[PostFxColour,PostFxColour]|undefined;
 private factor:[number,number,number]=[0,0,0];
 vision:VisionMode=null;
 /** m_fNightVisionSwitchOnFXCount: reset to 50 while night vision is off, spent by the flash. */
 private flashCount=NIGHT_VISION_SWITCH_ON_FX_TIME;
 private flashDraws=0;
 constructor(scene?:THREE.Scene,private random:()=>number=Math.random){
  this.group.name='Native post effects';this.group.matrixAutoUpdate=false;
  this.front=new THREE.FramebufferTexture(1,1);this.front.minFilter=this.front.magFilter=THREE.NearestFilter;this.front.wrapS=this.front.wrapT=THREE.ClampToEdgeWrapping;
  const invisible=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,depthTest:false,transparent:true});
  this.capture=new THREE.Mesh(new THREE.PlaneGeometry(2,2),invisible);this.capture.name='Native front buffer capture';this.capture.frustumCulled=false;this.capture.renderOrder=998;this.capture.matrixAutoUpdate=false;
  this.capture.onBeforeRender=renderer=>{this.ensureSize(renderer);renderer.copyFramebufferToTexture(this.front);};
  const frontQuad=(name:string,order:number,blendSrc:THREE.BlendingSrcFactor,blendDst:THREE.BlendingDstFactor,fragment:string,uniforms:Record<string,THREE.IUniform>)=>{
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:{front:{value:this.front},resolution:{value:this.resolution},...uniforms},transparent:true,depthTest:false,depthWrite:false,fog:false,
    blending:THREE.CustomBlending,blendSrc,blendDst,blendEquation:THREE.AddEquation,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneFactor,vertexShader:VERTEX,fragmentShader:fragment}));
   mesh.name=name;mesh.frustumCulled=false;mesh.visible=false;mesh.renderOrder=order;mesh.matrixAutoUpdate=false;this.group.add(mesh);return mesh as Quad;
  };
  // RwIm2D with the front buffer raster: texel x vertex colour, vertex alpha.
  const modulated='uniform sampler2D front;uniform vec2 resolution;uniform vec3 colour;uniform float alpha;uniform float expand;void main(){vec2 uv=(gl_FragCoord.xy+expand)/(resolution+2.*expand);gl_FragColor=vec4(texture2D(front,uv).rgb*colour,alpha);}';
  const flat='uniform vec3 colour;uniform float alpha;void main(){gl_FragColor=vec4(colour,alpha);}';
  const grain='uniform sampler2D grain;uniform vec2 uvScale;uniform float alpha;varying vec2 vUv;void main(){vec4 t=texture2D(grain,vUv*uvScale);gl_FragColor=vec4(t.rgb,t.a*alpha);}';
  const colourUniforms=()=>({colour:{value:new THREE.Vector3(1,1,1)},alpha:{value:1},expand:{value:0}});
  this.filterPasses=[frontQuad('Native colour filter pass 1',999.1,THREE.SrcAlphaFactor,THREE.OneFactor,modulated,colourUniforms()),frontQuad('Native colour filter pass 2',999.2,THREE.SrcAlphaFactor,THREE.OneFactor,modulated,colourUniforms())];
  // DarknessFilter: a black quad over the screen at the filter's alpha, after the colour filter.
  this.darkness=frontQuad('Native darkness filter',999.25,THREE.SrcAlphaFactor,THREE.OneMinusSrcAlphaFactor,flat,colourUniforms());
  this.flash=frontQuad('Native night vision flash',999.3,THREE.OneFactor,THREE.OneFactor,modulated,colourUniforms());
  this.nightTint=frontQuad('Native night vision tint',999.4,THREE.ZeroFactor,THREE.SrcColorFactor,flat,colourUniforms());
  this.infraredPasses=infraredExpansions().map((_,i)=>frontQuad(`Native infrared pass ${i+1}`,999.3+i*.01,THREE.OneFactor,THREE.OneFactor,modulated,colourUniforms()));
  this.infraredTint=frontQuad('Native infrared tint',999.4,THREE.ZeroFactor,THREE.SrcColorFactor,flat,colourUniforms());
  // InfraredVision's last step, SetFilterMainColour: the frame copy in m_InfraredVisionMainCol, added.
  this.infraredMain=frontQuad('Native infrared main colour',999.45,THREE.OneFactor,THREE.OneFactor,modulated,colourUniforms());
  this.grainTexture=new THREE.DataTexture(this.grainPixels,256,256,THREE.RGBAFormat);this.grainTexture.wrapS=this.grainTexture.wrapT=THREE.RepeatWrapping;this.grainTexture.magFilter=this.grainTexture.minFilter=THREE.LinearFilter;
  const grainQuad=(name:string)=>{
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:{grain:{value:this.grainTexture},uvScale:{value:new THREE.Vector2(1,1)},alpha:{value:0}},transparent:true,depthTest:false,depthWrite:false,fog:false,blending:THREE.NormalBlending,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:grain}));
   mesh.name=name;mesh.frustumCulled=false;mesh.visible=false;mesh.renderOrder=999.5;mesh.matrixAutoUpdate=false;this.group.add(mesh);return mesh as Quad;
  };
  this.nightGrain=grainQuad('Native night vision grain');this.infraredGrain=grainQuad('Native infrared grain');
  // UnderWaterRipple: a strip of rows over the screen sampling the captured front buffer with swaying u.
  // ImmediateModeRenderStatesSet draws with rwCULLMODECULLNONE.
  this.ripple=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.ShaderMaterial({uniforms:{front:{value:this.front},colour:{value:new THREE.Vector3(1,1,1)}},transparent:true,depthTest:false,depthWrite:false,fog:false,blending:THREE.NormalBlending,side:THREE.DoubleSide,
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D front;uniform vec3 colour;varying vec2 vUv;void main(){gl_FragColor=vec4(texture2D(front,vUv).rgb*colour,1.);}'}));
  this.ripple.name='Native underwater ripple';this.ripple.frustumCulled=false;this.ripple.visible=false;this.ripple.renderOrder=1000.5;this.ripple.matrixAutoUpdate=false;this.group.add(this.ripple);
  this.group.add(this.capture);
  scene?.add(this.group);
 }
 private ensureSize(renderer:THREE.WebGLRenderer){
  const gl=renderer.getContext(),width=Math.max(1,gl.drawingBufferWidth),height=Math.max(1,gl.drawingBufferHeight);
  if(width===this.size.width&&height===this.size.height)return;
  this.size={width,height};this.resolution.set(width,height);
  this.front.dispose();this.front=new THREE.FramebufferTexture(width,height);this.front.minFilter=this.front.magFilter=THREE.NearestFilter;this.front.wrapS=this.front.wrapT=THREE.ClampToEdgeWrapping;
  for(const q of [...this.filterPasses,this.flash,...this.infraredPasses])q.material.uniforms.front.value=this.front;this.ripple.material.uniforms.front.value=this.front;
 }
 private setQuad(quad:Quad,visible:boolean,colour?:readonly [number,number,number],alpha=1,expand=0){
  quad.visible=visible;if(!visible)return;
  const u=quad.material.uniforms;(u.colour.value as THREE.Vector3).set(colour![0]/255,colour![1]/255,colour![2]/255);u.alpha.value=alpha;if(u.expand)u.expand.value=expand;
 }
 private setGrain(quad:Quad,strength:number,width:number,height:number){
  quad.visible=strength>0;if(!quad.visible)return;
  for(let i=0;i<this.grainPixels.length;i+=4){const v=Math.trunc(this.random()*256);this.grainPixels[i]=this.grainPixels[i+1]=this.grainPixels[i+2]=this.grainPixels[i+3]=v;}
  this.grainTexture.needsUpdate=true;
  // SCREEN_STRETCH_X(1.5) repeats across the width, scaled by height over width vertically.
  const ux=1.5*width/640;(quad.material.uniforms.uvScale.value as THREE.Vector2).set(ux,height/width*ux);quad.material.uniforms.alpha.value=strength/255;
 }
 /** UnderWaterRipple over the captured frame: the rows' texture coordinates sway with time, the colour darkens with depth. */
 private updateUnderWater(underwaterness:number,waterDepth:number,timeMs:number,timeStep:number,width:number,height:number){
  const active=underwaterness>=WATER_FX_START_UNDERWATERNESS;
  // The colour takes s_WaterGreen before this frame's step; the sway's x offset takes it after.
  const greenBefore=this.waterGreenValue;
  this.waterGreenValue=waterGreen(this.waterGreenValue,active,timeStep);this.underWaterState={active,depth:active?waterDepth:0};
  this.ripple.visible=active;if(!active)return;
  const c=underWaterColour(greenBefore,waterDepth);(this.ripple.material.uniforms.colour.value as THREE.Vector3).set(c[0]/255,c[1]/255,c[2]/255);
  // SCREEN_STRETCH_Y scales by the screen height over DEFAULT_SCREEN_HEIGHT, 448.
  const yoffset=Math.max(1,WATER_Y_OFFSET*height/448),xoffset=underWaterXOffset(this.waterGreenValue,width);
  const ys:number[]=[];for(let y=0;y<height;y=Math.trunc(y+yoffset))ys.push(y);ys.push(ys.length?Math.trunc(ys[ys.length-1]+yoffset):0);
  const rows=ys.length,geometry=this.ripple.geometry;
  if(rows!==this.rippleRows){
   this.rippleRows=rows;const positions=new Float32Array(rows*2*3),uvs=new Float32Array(rows*2*2),indices:number[]=[];
   for(let r=0;r+1<rows;r++){const a=r*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
   geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
  }
  const positions=geometry.getAttribute('position') as THREE.BufferAttribute,uvs=geometry.getAttribute('uv') as THREE.BufferAttribute;
  const right=Math.trunc(2*xoffset)+width;
  for(let r=0;r<rows;r++){
   const y=ys[r],wave=underWaterWave(y,timeMs,xoffset),ndcY=1-2*y/height;
   // Screen y grows downward and the captured texture's v grows upward.
   positions.setXYZ(r*2,-1,ndcY,0);positions.setXYZ(r*2+1,right/width*2-1,ndcY,0);
   uvs.setXY(r*2,(wave+xoffset)/width,1-y/height);uvs.setXY(r*2+1,(width+wave-xoffset)/width,1-y/height);
  }
  positions.needsUpdate=true;uvs.needsUpdate=true;
 }
 /** One frame: the timecycle post-effect colours (bytes), the goggles, the extra multiplier, the frame's native steps,
  * the game time and the camera's water state. */
 update(pass1:PostFxColour|undefined,pass2:PostFxColour|undefined,options:{vision?:VisionMode;laRiotsLightMult?:number;extraMult?:number;timeStep?:number;timeMs?:number;underwaterness?:number;waterDepth?:number}={}){
  const vision=options.vision??null;this.vision=vision;
  // Render: the darkness filter while neither vision mode is on.
  this.setQuad(this.darkness,this.darknessFilter&&!vision,[0,0,0],this.darknessAlpha/255);
  const width=this.size.width||1,height=this.size.height||1;
  this.updateUnderWater(options.underwaterness??0,options.waterDepth??0,options.timeMs??0,options.timeStep??1,width,height);
  if(this.colourFilterEnabled&&pass1&&pass2){
   const passes=postFxPasses(pass1,pass2,{vision:!!vision,laRiotsLightMult:options.laRiotsLightMult,extraMult:options.extraMult});
   const finite=passes.every(p=>[p.r,p.g,p.b,p.a].every(Number.isFinite));
   this.passes=finite?passes:undefined;
   this.factor=finite?[0,1,2].map(i=>Math.min(1,[passes[0].r,passes[0].g,passes[0].b][i]/255*passes[0].a/255+[passes[1].r,passes[1].g,passes[1].b][i]/255*passes[1].a/255)) as [number,number,number]:[0,0,0];
   for(const [i,quad] of this.filterPasses.entries()){const p=passes[i];this.setQuad(quad,finite&&p.a>0,[p.r,p.g,p.b],p.a/255);}
  }else{this.passes=undefined;this.factor=[0,0,0];for(const quad of this.filterPasses)quad.visible=false;}
  // NightVision: the switch-on count sits at 50 while the goggles are off and is spent on the first lit frame.
  if(vision==='nightvision'){
   const flash=nightVisionFlash(this.flashCount,options.timeStep??1);this.flashCount=flash.next;this.flashDraws=flash.draws;
   this.setQuad(this.flash,flash.draws>0,[Math.min(255,flash.draws*NIGHT_VISION_FLASH_STEP),Math.min(255,flash.draws*NIGHT_VISION_FLASH_STEP),Math.min(255,flash.draws*NIGHT_VISION_FLASH_STEP)]);
   this.setQuad(this.nightTint,true,NIGHT_VISION_TINT);this.setGrain(this.nightGrain,NIGHT_VISION_GRAIN,width,height);
  }else{this.flashCount=NIGHT_VISION_SWITCH_ON_FX_TIME;this.flashDraws=0;this.flash.visible=false;this.nightTint.visible=false;this.nightGrain.visible=false;}
  if(vision==='infrared'){
   for(const [i,quad] of this.infraredPasses.entries())this.setQuad(quad,true,INFRARED_COLOUR,1,infraredExpansions()[i]);
   this.setQuad(this.infraredTint,true,INFRARED_TINT);this.setQuad(this.infraredMain,true,INFRARED_MAIN_COLOUR,100/255);
   this.setGrain(this.infraredGrain,INFRARED_GRAIN,width,height);
  }else{for(const quad of this.infraredPasses)quad.visible=false;this.infraredTint.visible=false;this.infraredMain.visible=false;this.infraredGrain.visible=false;}
  this.capture.visible=this.filterPasses.some(q=>q.visible)||this.flash.visible||this.infraredPasses.some(q=>q.visible)||this.ripple.visible;
 }
 /** The colour filter's quads, for a probe that draws the frame with and without them. */
 get colourFilterQuads(){return this.filterPasses;}
 snapshot(){return {colourFilter:{enabled:this.colourFilterEnabled,visible:this.filterPasses.some(q=>q.visible),factor:this.factor.map(v=>+v.toFixed(4)),passes:this.passes},vision:this.vision,darkness:{enabled:this.darknessFilter,alpha:this.darknessAlpha,visible:this.darkness.visible},heatHazeFX:this.heatHazeFX,flashDraws:this.flashDraws,captureSize:{...this.size},underwater:{...this.underWaterState,green:+this.waterGreenValue.toFixed(2),rows:this.rippleRows,visible:this.ripple.visible}};}
 dispose(){this.group.removeFromParent();this.front.dispose();this.grainTexture.dispose();this.group.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.geometry.dispose();(m.material as THREE.Material).dispose();}});}
}
