import {applyWindowedCameraProjection} from '../../src/render/cameraProjection';
import * as THREE from 'three';
import {TexturedSun} from '../../src/render/TexturedSun';
import {nativeTexture} from '../../src/assets/nativeTexture';
import type {SunCoronaState} from '../../src/render/SunCoronas';
Object.assign(window,{sunRasterProbe:()=>{
  const renderer=new THREE.WebGLRenderer({antialias:false}),scene=new THREE.Scene(),pass=new TexturedSun(scene);
  const camera=new THREE.PerspectiveCamera(60,2,.1,500);camera.updateMatrixWorld(true);
  const texture=nativeTexture({name:'diagnostic coronastar',filter:1,addressU:3,addressV:3,hasAlpha:false,
    mips:[{width:2,height:2,data:new Uint8ClampedArray([255,0,0,255,0,255,0,255,0,0,255,255,255,255,0,255])}]});
  const state:SunCoronaState={position:new THREE.Vector3(0,0,-101.5),direction:new THREE.Vector3(0,0,-1),color:[1,1,1],intensity:255,size:10,offScreen:false,justCreated:false};
  const results=[];
  for(const [width,height,depth,fov] of [[200,100,100,70],[100,200,100,70],[200,100,200,70],[200,100,200,35],[200,100,100,100]]){
    renderer.setSize(width,height);applyWindowedCameraProjection(camera,width,height,fov);state.position.z=-depth-1.5;
    pass.update(camera,texture,state,undefined,fov);renderer.render(scene,camera);
    const gl=renderer.getContext(),pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const bounds={left:width,right:-1,bottom:height,top:-1};
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const at=(y*width+x)*4;if(pixels[at]||pixels[at+1]||pixels[at+2]){bounds.left=Math.min(bounds.left,x);bounds.right=Math.max(bounds.right,x);bounds.bottom=Math.min(bounds.bottom,y);bounds.top=Math.max(bounds.top,y);}}
    const sample=(x:number,y:number)=>[...pixels.slice((y*width+x)*4,(y*width+x)*4+3)];
    const left=Math.round((bounds.left+width/2)/2),right=Math.round((bounds.right+width/2)/2),top=Math.round((bounds.top+height/2)/2),bottom=Math.round((bounds.bottom+height/2)/2);
    results.push({width,height,depth,fov,bounds,corners:[sample(left,top),sample(right,top),sample(left,bottom),sample(right,bottom)]});
  }
  const depthCases=[];
  renderer.setSize(100,100);applyWindowedCameraProjection(camera,100,100,70);
  for(const [depth,far] of [[501,500],[500,500],[499,500],[750000,1000001],[1000000,1000001]]){
    camera.far=far;camera.updateProjectionMatrix();state.position.z=-depth;state.size=depth*.05;
    pass.update(camera,texture,state,undefined);renderer.render(scene,camera);
    const gl=renderer.getContext(),pixels=new Uint8Array(100*100*4);gl.readPixels(0,0,100,100,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let maximum=0;for(let i=0;i<pixels.length;i++)if(i%4!==3)maximum=Math.max(maximum,pixels[i]);
    depthCases.push({depth,far,maximum});
  }
  pass.dispose();texture.dispose();renderer.dispose();renderer.forceContextLoss();return {results,depthCases};
}});
