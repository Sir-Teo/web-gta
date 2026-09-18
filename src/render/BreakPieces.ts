import {BufferAttribute,BufferGeometry,DoubleSide,DynamicDrawUsage,Group,Mesh,ShaderMaterial,type Scene,type Texture} from 'three';
import {transformPoint,type NativeBreakManager,type NativeBreakObject} from '../simulation/nativeBreakObject';

/** BreakObject_c::Render (0x59E480): each group's triangles are transformed by the
 * group matrix and drawn through RwIm3D with the prelit colours, the group texture
 * and alpha from the frames left, blended SRCALPHA / INVSRCALPHA. Fog and the
 * draw-last pass split are not reproduced. */
const vertexShader=`attribute vec4 aColor;varying vec4 vColor;varying vec2 vUv;
void main(){vColor=aColor;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fragmentShader=`uniform sampler2D map;uniform bool hasMap;varying vec4 vColor;varying vec2 vUv;
void main(){vec4 c=vColor;if(hasMap)c*=texture2D(map,vUv);if(c.a<=0.0)discard;gl_FragColor=c;}`;

interface Drawn {serial:number;root:Group;meshes:Mesh<BufferGeometry,ShaderMaterial>[];textures:Texture[]}
export class BreakPieces {
 private drawn=new Map<NativeBreakObject,Drawn>();
 constructor(private scene:Scene){}
 /** Textures resolved by name from the object's dictionary when it broke. */
 private pending=new Map<NativeBreakObject,{serial:number;textures:Map<string,Texture>}>();
 attach(object:NativeBreakObject,textures:Map<string,Texture>){this.pending.set(object,{serial:object.serial,textures});}
 private build(object:NativeBreakObject):Drawn{
  const entry=this.pending.get(object),textures=entry&&entry.serial===object.serial?entry.textures:new Map<string,Texture>();
  this.pending.delete(object);
  const root=new Group();root.name='BreakObject';
  const meshes=object.groups.map(group=>{
   const count=group.triangles.length*3,geometry=new BufferGeometry();
   geometry.setAttribute('position',new BufferAttribute(new Float32Array(count*3),3).setUsage(DynamicDrawUsage));
   const uv=new Float32Array(count*2),color=new Float32Array(count*4);
   group.triangles.forEach((t,i)=>{uv.set(t.uvs,i*6);for(let k=0;k<3;k++)color.set([t.colors[k*3]/255,t.colors[k*3+1]/255,t.colors[k*3+2]/255,1],(i*3+k)*4);});
   geometry.setAttribute('uv',new BufferAttribute(uv,2));
   geometry.setAttribute('aColor',new BufferAttribute(color,4).setUsage(DynamicDrawUsage));
   const map=group.texture?textures.get(group.texture.toLowerCase()):undefined;
   const material=new ShaderMaterial({vertexShader,fragmentShader,uniforms:{map:{value:map??null},hasMap:{value:!!map}},transparent:true,side:DoubleSide});
   const mesh=new Mesh(geometry,material);mesh.frustumCulled=false;root.add(mesh);return mesh;
  });
  this.scene.add(root);
  return {serial:object.serial,root,meshes,textures:[...textures.values()]};
 }
 private release(drawn:Drawn){
  drawn.root.removeFromParent();
  for(const mesh of drawn.meshes){mesh.geometry.dispose();mesh.material.dispose();}
  for(const texture of drawn.textures)texture.dispose();
 }
 /** Rewrite vertex positions and alphas for every active break object. */
 sync(manager:NativeBreakManager){
  for(const object of manager.objects){
   let drawn=this.drawn.get(object);
   if(drawn&&(!object.active||drawn.serial!==object.serial)){this.release(drawn);this.drawn.delete(object);drawn=undefined;}
   if(!object.active)continue;
   if(!drawn){drawn=this.build(object);this.drawn.set(object,drawn);}
   object.groups.forEach((group,g)=>{
    const geometry=drawn!.meshes[g].geometry,position=geometry.getAttribute('position') as BufferAttribute,color=geometry.getAttribute('aColor') as BufferAttribute;
    const alpha=object.alpha(group)/255;
    group.triangles.forEach((t,i)=>{for(let k=0;k<3;k++){
     const p=transformPoint(group.matrix,t.positions.subarray(k*3,k*3+3)),v=i*3+k;
     // Native Z-up to the renderer's Y-up.
     position.setXYZ(v,p[0],p[2],-p[1]);color.setW(v,alpha);
    }});
    position.needsUpdate=true;color.needsUpdate=true;
   });
  }
 }
 get count(){return this.drawn.size;}
 dispose(){for(const drawn of this.drawn.values())this.release(drawn);this.drawn.clear();this.pending.clear();}
}
