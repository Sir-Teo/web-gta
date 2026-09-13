import * as THREE from 'three';
import {projectCorona} from '../../src/render/coronaProjection';
Object.assign(window,{coronaProjectionProbe:()=>{
  const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(160,96);
  const camera=new THREE.PerspectiveCamera(55,160/96,.08,650);camera.position.set(8,20,30);camera.lookAt(-20,3,-40);camera.updateMatrixWorld(true);
  const scene=new THREE.Scene(),geometry=new THREE.PlaneGeometry(4,4),material=new THREE.MeshBasicMaterial({color:0xff0000,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);mesh.quaternion.copy(camera.quaternion);scene.add(mesh);
  const results=[];
  for(const offset of [false,true]){
    if(offset)camera.setViewOffset(320,192,40,24,160,96);
    for(const [x,y] of [[0,0],[-8,4],[7,-3]]){
      mesh.position.copy(new THREE.Vector3(x,y,-40).applyMatrix4(camera.matrixWorld));renderer.render(scene,camera);
      const projected=projectCorona(camera,mesh.position,160,96,70)!,gl=renderer.getContext(),pixel=new Uint8Array(4);
      gl.readPixels(Math.floor(projected.x),95-Math.floor(projected.y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);results.push([...pixel]);
    }
  }
  geometry.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss();return results;
}});
