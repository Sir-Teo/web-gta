import * as THREE from 'three';
import {ShadowRasterFilter} from '../../src/render/ShadowRasterFilter';
Object.assign(window,{shadowFilterProbe:()=>{
 const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(32,32);document.body.append(renderer.domElement);
 const inputBytes=new Uint8Array(16*16*4);for(let i=0;i<16*16;i++){inputBytes[i*4+3]=255;}
 // A 2x2 block resamples to one full-intensity interior texel, plus a corner block for clamp behavior.
 for(const [x,y] of [[6,8],[7,8],[6,9],[7,9],[0,0],[1,0],[0,1],[1,1]])inputBytes.set([255,255,255,255],(y*16+x)*4);
 const input=new THREE.DataTexture(inputBytes,16,16);input.minFilter=input.magFilter=THREE.LinearFilter;input.needsUpdate=true;
 const filter=new ShadowRasterFilter(8),prior=new THREE.WebGLRenderTarget(16,16);renderer.setRenderTarget(prior);renderer.setViewport(1,2,10,11);renderer.setScissor(2,3,8,9);renderer.setScissorTest(true);renderer.shadowMap.needsUpdate=true;
 const state=()=>({target:renderer.getRenderTarget()===prior,viewport:renderer.getViewport(new THREE.Vector4()).toArray(),scissor:renderer.getScissor(new THREE.Vector4()).toArray(),test:renderer.getScissorTest(),auto:renderer.autoClear,pending:renderer.shadowMap.needsUpdate});
 const before=state();const samples=[0,1,2].map(passes=>{
  filter.update(renderer,input,passes);const bytes=new Uint8Array(8*8*4);renderer.readRenderTargetPixels(filter.target,0,0,8,8,bytes);return Array.from({length:64},(_,i)=>bytes[i*4]);
 });
 filter.update(renderer,input,2,true);const combinedBytes=new Uint8Array(8*8*4);renderer.readRenderTargetPixels(filter.target,0,0,8,8,combinedBytes);const combined=Array.from({length:64},(_,i)=>combinedBytes[i*4]);
 inputBytes.fill(255);input.needsUpdate=true;filter.update(renderer,input,0,true);const gradientBytes=new Uint8Array(8*8*4);renderer.readRenderTargetPixels(filter.target,0,0,8,8,gradientBytes);const gradient=Array.from({length:64},(_,i)=>gradientBytes[i*4]);
 filter.update(renderer,input,0,false);const resetBytes=new Uint8Array(8*8*4);renderer.readRenderTargetPixels(filter.target,0,0,8,8,resetBytes);const reset=Array.from({length:64},(_,i)=>resetBytes[i*4]);
 const after=state();filter.dispose();input.dispose();prior.dispose();renderer.dispose();renderer.domElement.remove();return {samples,combined,gradient,reset,before,after};
}});
