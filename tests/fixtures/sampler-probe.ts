import * as THREE from 'three';
import {nativeTexture} from '../../src/assets/nativeTexture';
const renderer=new THREE.WebGLRenderer();renderer.setSize(1,1);document.body.append(renderer.domElement);
(window as any).sampleNativeFilter=(filter:number,lod:number,oneLevel=false)=>{
 const mips=[{width:2,height:2,data:new Uint8ClampedArray([255,0,0,255,0,0,255,255,255,0,0,255,0,0,255,255])},
 {width:1,height:1,data:new Uint8ClampedArray([0,255,0,255])}];
 const map=nativeTexture({name:'filter diagnostic',filter,addressU:3,addressV:3,hasAlpha:false,mips:oneLevel?mips.slice(0,1):mips});
 const material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,uniforms:{map:{value:map},lod:{value:lod}},
 vertexShader:'void main(){gl_Position=vec4(position,1.0);}',
 fragmentShader:'uniform sampler2D map; uniform float lod; out vec4 pixel; void main(){pixel=textureLod(map,vec2(0.5),lod);}'});
 const geometry=new THREE.PlaneGeometry(2,2),scene=new THREE.Scene();scene.add(new THREE.Mesh(geometry,material));
 const target=new THREE.WebGLRenderTarget(1,1),pixel=new Uint8Array(4);
 try{renderer.setRenderTarget(target);renderer.render(scene,new THREE.Camera());renderer.readRenderTargetPixels(target,0,0,1,1,pixel);return [...pixel];}
 finally{renderer.setRenderTarget(null);target.dispose();material.dispose();geometry.dispose();map.dispose();}
};
