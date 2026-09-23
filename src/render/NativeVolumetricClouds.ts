import * as THREE from 'three';
import {nativeRasterOutput} from '../assets/nativeRasterOutput';
import {MAX_VOLUMETRIC_CLOUDS,VOLUMETRIC_CLOUD_MODEL,VolumetricCloudField,type VolumetricCloudFrame} from '../world/nativeVolumetricClouds';
/** CClouds::VolumetricCloudsRender's draw half: one mesh holding every cloud's three quads, filled each frame from
 * the field's state. Depth tested against the world and alpha blended without writing depth, culling neither side
 * (ImmediateModeRenderStatesSet). Native (x, y, z up) becomes renderer (x, z, -y). */
export class NativeVolumetricClouds {
 readonly field:VolumetricCloudField;
 readonly mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
 private positions:Float32Array;private colours:Float32Array;
 private drawn=0;
 constructor(scene?:THREE.Scene,random:()=>number=Math.random){
  this.field=new VolumetricCloudField(random);
  const vertices=MAX_VOLUMETRIC_CLOUDS*VOLUMETRIC_CLOUD_MODEL.length;
  this.positions=new Float32Array(vertices*3);this.colours=new Float32Array(vertices*4);
  const uvs=new Float32Array(vertices*2);
  for(let i=0;i<vertices;i++){const m=VOLUMETRIC_CLOUD_MODEL[i%VOLUMETRIC_CLOUD_MODEL.length];uvs[i*2]=m.u;uvs[i*2+1]=1-m.v;}
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color',new THREE.BufferAttribute(this.colours,4).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  geometry.setDrawRange(0,0);
  const material=nativeRasterOutput(new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,fog:false}));
  this.mesh=new THREE.Mesh(geometry,material);
  this.mesh.name='Native volumetric clouds';this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=5;this.mesh.matrixAutoUpdate=false;
  scene?.add(this.mesh);
 }
 /** The `cloudhigh` raster from particle.txd. */
 setTexture(texture:THREE.Texture|undefined){this.mesh.material.map=texture??null;this.mesh.material.needsUpdate=true;}
 update(frame:VolumetricCloudFrame){
  const draws=this.mesh.material.map?this.field.update(frame):[];
  const grey=this.field.colour/255;
  let vertex=0;
  for(const draw of draws){
   for(let k=0;k<VOLUMETRIC_CLOUD_MODEL.length;k++){
    const m=VOLUMETRIC_CLOUD_MODEL[k],alpha=draw.quadAlpha[Math.floor(k/6)]/255;
    const x=draw.pos[0]+m.x*draw.size[0],y=draw.pos[1]+m.y*draw.size[1],z=draw.pos[2]+m.z*draw.size[2];
    const o=vertex*3;this.positions[o]=x;this.positions[o+1]=z;this.positions[o+2]=-y;
    const c=vertex*4;this.colours[c]=grey;this.colours[c+1]=grey;this.colours[c+2]=grey;this.colours[c+3]=alpha;
    vertex++;
   }
  }
  this.drawn=draws.length;
  const geometry=this.mesh.geometry;
  geometry.setDrawRange(0,vertex);
  // Ranges are only cleared when the mesh is drawn; a hidden mesh would pile them up frame after frame.
  const position=geometry.getAttribute('position') as THREE.BufferAttribute,color=geometry.getAttribute('color') as THREE.BufferAttribute;
  position.clearUpdateRanges();color.clearUpdateRanges();
  position.addUpdateRange(0,vertex*3);color.addUpdateRange(0,vertex*4);
  geometry.getAttribute('position').needsUpdate=true;geometry.getAttribute('color').needsUpdate=true;
  this.mesh.visible=vertex>0;
 }
 snapshot(){return {...this.field.snapshot(),drawn:this.drawn,visible:this.mesh.visible,textured:!!this.mesh.material.map};}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
