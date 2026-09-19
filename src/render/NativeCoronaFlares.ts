import * as THREE from 'three';
import {SUN_FLARE,type FlareSprite} from '../world/nativeCoronaFlares';

const CAPACITY=SUN_FLARE.length;
const vertexShader=`attribute vec2 corner;attribute vec2 center;attribute vec2 extent;attribute vec3 tint;varying vec2 vUv;varying vec3 vTint;
void main(){vUv=vec2(corner.x*.5+.5,.5-corner.y*.5);vTint=tint;gl_Position=vec4(center+corner*extent,0.,1.);}`;
// The sprite's own colour bytes modulate the raster in display space; additive (ONE, ONE).
const fragmentShader=`uniform sampler2D raster;varying vec2 vUv;varying vec3 vTint;
void main(){vec3 c=texture2D(raster,vUv).rgb*vTint;c=mix(pow((c+.055)/1.055,vec3(2.4)),c/12.92,step(c,vec3(.04045)));gl_FragColor=vec4(c,0.);
 #include <colorspace_fragment>
}`;
/** The flare sprites of CCoronas::Render: 2D `coronastar` quads sized in raster pixels, additive and drawn without
 * depth, right after the coronas. */
export class NativeCoronaFlaresMesh {
 private mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private center=new Float32Array(CAPACITY*8);private extent=new Float32Array(CAPACITY*8);private tint=new Float32Array(CAPACITY*12);
 drawn=0;
 /** Test hook: hides the sprites without changing what the frame computes. */
 hidden=false;
 constructor(scene:THREE.Scene){
  const geometry=new THREE.BufferGeometry(),corner=new Float32Array(CAPACITY*8),index=new Uint16Array(CAPACITY*6);
  for(let i=0;i<CAPACITY;i++){corner.set([-1,1,1,1,1,-1,-1,-1],i*8);index.set([0,1,2,0,2,3].map(v=>i*4+v),i*6);}
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(CAPACITY*12),3));
  geometry.setAttribute('corner',new THREE.BufferAttribute(corner,2));
  geometry.setAttribute('center',new THREE.BufferAttribute(this.center,2).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('extent',new THREE.BufferAttribute(this.extent,2).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('tint',new THREE.BufferAttribute(this.tint,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(new THREE.BufferAttribute(index,1));geometry.setDrawRange(0,0);
  this.mesh=new THREE.Mesh(geometry,new THREE.ShaderMaterial({uniforms:{raster:{value:null}},vertexShader,fragmentShader,transparent:true,depthTest:false,depthWrite:false,
   side:THREE.DoubleSide,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,fog:false}));
  this.mesh.name='Native corona flares';this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=6.05;
  scene.add(this.mesh);
 }
 /** `raster` is the drawing buffer the sprite sizes are in pixels of. */
 frame(sprites:readonly FlareSprite[],raster:{width:number;height:number},texture:THREE.Texture|undefined){
  let n=0;
  if(texture&&raster.width>0&&raster.height>0)for(const sprite of sprites){
   if(n>=CAPACITY)break;
   for(let v=0;v<4;v++){
    this.center.set(sprite.position,(n*4+v)*2);
    this.extent.set([sprite.halfSize*2/raster.width,sprite.halfSize*2/raster.height],(n*4+v)*2);
    this.tint.set([sprite.color[0]/255,sprite.color[1]/255,sprite.color[2]/255],(n*4+v)*3);
   }
   n++;
  }
  this.drawn=n;this.mesh.visible=n>0&&!this.hidden;this.mesh.geometry.setDrawRange(0,n*6);
  if(n){
   this.mesh.material.uniforms.raster.value=texture;
   for(const name of ['center','extent','tint'])(this.mesh.geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate=true;
  }
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
