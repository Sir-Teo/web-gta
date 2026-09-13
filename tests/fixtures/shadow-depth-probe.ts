import * as THREE from 'three';
import {ProjectedShadow} from '../../src/render/ProjectedShadow';
import {nativeShadowNearClip} from '../../src/render/nativeShadowDepth';
Object.assign(window,{shadowDepthProbe:()=>{
 const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(64,64);document.body.append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(60,1,.1,1000);camera.position.z=5;camera.setViewOffset(64,64,2,0,64,64);camera.lookAt(0,0,0);
 const original=camera.projectionMatrix.clone(),scene=new THREE.Scene(),shadow=new ProjectedShadow(3);scene.add(shadow.mesh);
 const texture=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);texture.needsUpdate=true;
 shadow.update([{positions:new Float32Array([-1,-1,0,1,-1,0,0,1,0]),uvs:new Float32Array(6),lights:new Uint8Array([255,255,255]),faces:new Uint32Array(3)}],texture,255,0);
 const material=shadow.mesh.material;
 // Observe the production vertex path's actual fragment depth at increased
 // sensitivity. Disable color blending only in this diagnostic measurement.
 material.blending=THREE.NoBlending;material.fragmentShader='void main(){gl_FragColor=vec4(fract(gl_FragCoord.z*10000.0),0.0,0.0,1.0);}';material.needsUpdate=true;
 const read=()=>{renderer.render(scene,camera);const p=new Uint8Array(4),gl=renderer.getContext();gl.readPixels(32,32,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return p[0];};
 const biased=read(),projection=(material.uniforms.shadowDepthProjection.value as THREE.Matrix4).clone(),polygonOffset=material.polygonOffset;
 const callback=material.onBeforeRender;material.onBeforeRender=()=>{material.uniforms.useShadowDepthProjection.value=false;material.polygonOffset=false;};const ordinary=read();material.onBeforeRender=callback;const repeated=read();
 const expected=(near:number)=>{const depth=1000/(1000-near)*(1-near/5);return (depth*10000-Math.floor(depth*10000))*255;};
 const result={biased,ordinary,repeated,expectedBiased:expected(nativeShadowNearClip(.1,1000,0)),expectedOrdinary:expected(.1),cameraUnchanged:camera.projectionMatrix.equals(original)&&camera.near===.1,xyUnchanged:projection.elements.every((value,i)=>i===10||i===14||value===original.elements[i]),polygonOffset};
 shadow.dispose();texture.dispose();renderer.dispose();renderer.domElement.remove();return result;
}});
