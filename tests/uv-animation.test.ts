import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ANIM_ANIMATION,UV_ANIMATION_DICTIONARY,UV_ANIMATION_LINEAR,UV_ANIMATION_PARAM,UV_ANIMATION_PLUGIN,UvAnimationPlayer,applyUvAffine,readUvAnimationDictionary,readUvAnimationPlugin,uvKeyframeMatrix,type UvAnimation} from '../src/assets/uvAnimation';
import {readDff} from '../src/assets/dff';
/** RenderWare chunk: type, size, version, payload. */
function chunk(type:number,payload:Uint8Array){const out=new Uint8Array(12+payload.length),v=new DataView(out.buffer);v.setUint32(0,type,true);v.setUint32(4,payload.length,true);v.setUint32(8,0x1803ffff,true);out.set(payload,12);return out;}
const concat=(...parts:Uint8Array[])=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
const name32=(name:string)=>{const out=new Uint8Array(32);for(let i=0;i<name.length&&i<31;i++)out[i]=name.charCodeAt(i);return out;};
/** rwID_ANIMANIMATION payload: version, type, numFrames, flags, duration, custom data, keyframes. */
function animation(name:string,type:number,duration:number,frames:{time:number;uv:number[];prev:number}[],channels=[0,0,0,0,0,0,0,0]){
 const head=new Uint8Array(5*4+4+32+8*4),v=new DataView(head.buffer);
 v.setInt32(0,0x100,true);v.setInt32(4,type,true);v.setInt32(8,frames.length,true);v.setInt32(12,0,true);v.setFloat32(16,duration,true);v.setInt32(20,0,true);head.set(name32(name),24);channels.forEach((c,i)=>v.setInt32(56+i*4,c,true));
 const body=new Uint8Array(frames.length*32),b=new DataView(body.buffer);
 frames.forEach((f,i)=>{b.setFloat32(i*32,f.time,true);f.uv.forEach((n,j)=>b.setFloat32(i*32+4+j*4,n,true));b.setInt32(i*32+28,f.prev,true);});
 return chunk(ANIM_ANIMATION,concat(head,body));
}
function dictionary(...anims:Uint8Array[]){const count=new Uint8Array(4);new DataView(count.buffer).setInt32(0,anims.length,true);return chunk(UV_ANIMATION_DICTIONARY,concat(chunk(1,count),...anims));}
// The leading keyframe's prev field holds whatever pointer the exporter left there, as in the shipped files.
const scroll=()=>animation('scroll',UV_ANIMATION_LINEAR,2,[{time:0,uv:[1,0,0,1,0,0],prev:-28306722},{time:2,uv:[1,0,0,1,1,0],prev:0}]);

test('reads a UV animation dictionary and a material\'s animation slots as librw and rpuvanim.c lay them out',()=>{
 const spin=animation('spin',UV_ANIMATION_PARAM,1,[{time:0,uv:[0,1,1,0,0,0],prev:0},{time:1,uv:[Math.PI/2,1,1,0,0,0],prev:0}],[1,0,0,0,0,0,0,0]);
 const [a,b]=readUvAnimationDictionary(dictionary(scroll(),spin).subarray(12));
 expect(a).toMatchObject({name:'scroll',type:UV_ANIMATION_LINEAR,duration:2,nodeToUvChannel:[0,0,0,0,0,0,0,0]});
 expect(a.frames.map(f=>f.time)).toEqual([0,2]);expect([...a.frames[1].uv]).toEqual([1,0,0,1,1,0]);expect(a.frames.map(f=>f.prev)).toEqual([0,0]);
 expect(b).toMatchObject({name:'spin',type:UV_ANIMATION_PARAM,duration:1,nodeToUvChannel:[1,0,0,0,0,0,0,0]});
 const mask=new Uint8Array(4+64),v=new DataView(mask.buffer);v.setUint32(0,0b101,true);mask.set(name32('scroll'),4);mask.set(name32('spin'),36);
 expect(readUvAnimationPlugin(chunk(1,mask))).toEqual([{slot:0,name:'scroll'},{slot:2,name:'spin'}]);
 expect(()=>readUvAnimationDictionary(dictionary(scroll()).subarray(12).subarray(0,40))).toThrow();
});

test('a linear animation scrolls the texture, a param one rotates about its centre, and playback restarts past the duration',()=>{
 const [anim]=readUvAnimationDictionary(dictionary(scroll()).subarray(12)),player=new UvAnimationPlayer([anim]);
 expect(player.channelMatrix(0)).toEqual([1,0,0,1,0,0]);
 player.addTime(.5);expect(player.channelMatrix(0)[4]).toBeCloseTo(.25);
 player.addTime(1);expect(player.channelMatrix(0)[4]).toBeCloseTo(.75);
 expect(applyUvAffine(player.channelMatrix(0),.5,.5)[0]).toBeCloseTo(1.25);
 // 1.5 + 0.6 passes the 2 s duration: AnimInterpolator::addTime starts the animation over at zero.
 player.addTime(.6);expect(player.channelMatrix(0)[4]).toBe(0);
 // A channel-1 animation leaves channel 0 alone.
 const other:UvAnimation={...anim,nodeToUvChannel:[1,0,0,0,0,0,0,0]};const second=new UvAnimationPlayer([other]);second.addTime(1);
 expect(second.channelMatrix(0)).toEqual([1,0,0,1,0,0]);expect(second.channelMatrix(1)[4]).toBeCloseTo(.5);
 // Param keyframes: theta, s0, s1, skew, x, y. A quarter turn about (0.5, 0.5) sends (1, 0.5) to (0.5, 1).
 const quarter=uvKeyframeMatrix(UV_ANIMATION_PARAM,[Math.PI/2,1,1,0,0,0]),[u,v]=applyUvAffine(quarter,1,.5);
 expect(u).toBeCloseTo(.5);expect(v).toBeCloseTo(1);
 // The param angle interpolates the short way round.
 const wrap:UvAnimation={name:'w',type:UV_ANIMATION_PARAM,flags:0,duration:1,nodeToUvChannel:[0,0,0,0,0,0,0,0],frames:[{time:0,uv:[Math.PI*.9,1,1,0,0,0],prev:0},{time:1,uv:[-Math.PI*.9,1,1,0,0,0],prev:0}]};
 const wrapped=new UvAnimationPlayer([wrap]);wrapped.addTime(.5);const [wu,wv]=applyUvAffine(wrapped.channelMatrix(0),1,.5);
 // Half way the short way from 0.9π to −0.9π is π: (1, 0.5) turns to (0, 0.5).
 expect(wu).toBeCloseTo(0);expect(wv).toBeCloseTo(.5);
});

test('a dictionary ahead of a clump reaches the model with its animations',()=>{
 const plain=new Uint8Array(readFileSync(new URL('./fixtures/dragonff-model.dff',import.meta.url)));
 const model=readDff(concat(dictionary(scroll()),plain));
 expect(model.uvAnimations?.map(a=>a.name)).toEqual(['scroll']);
 expect(readDff(plain).uvAnimations).toBeUndefined();
});

test('a material\'s MatFX environment effect is read as librw lays it out', async () => {
 const {readMaterialEffects}=await import('../src/assets/dff');
 const tex=(name:string)=>{const n=new Uint8Array(name.length+1);for(let i=0;i<name.length;i++)n[i]=name.charCodeAt(i);const struct=new Uint8Array(4);new DataView(struct.buffer).setUint32(0,0x1106,true);return chunk(6,concat(chunk(1,struct),chunk(2,n),chunk(2,new Uint8Array(4))));};
 const head=new Uint8Array(4+4+4+4+4),v=new DataView(head.buffer);v.setUint32(0,2,true);v.setUint32(4,2,true);v.setFloat32(8,.5,true);v.setInt32(12,0,true);v.setInt32(16,1,true);
 const tail=new Uint8Array(4);new DataView(tail.buffer).setUint32(0,0,true);
 expect(readMaterialEffects(concat(head,tex('vehicleenvmap128'),tail))).toEqual({texture:'vehicleenvmap128',coefficient:.5,fbAlpha:false});
 // An effect without a texture, or a bump effect, yields no environment map.
 const none=new Uint8Array(20),nv=new DataView(none.buffer);nv.setUint32(0,2,true);nv.setUint32(4,2,true);nv.setFloat32(8,.5,true);nv.setInt32(12,0,true);nv.setInt32(16,0,true);
 expect(readMaterialEffects(none)).toBeUndefined();
});

test('the environment pass uses the texel alpha only when the effect asks for framebuffer alpha', async () => {
 const {nativeEnvMap}=await import('../src/assets/nativeEnvMap');const {MeshBasicMaterial,Texture}=await import('three');
 const plain=nativeEnvMap(new MeshBasicMaterial(),new Texture(),.5),alpha=nativeEnvMap(new MeshBasicMaterial(),new Texture(),.5,true);
 expect(plain.userData.nativeEnv).toMatchObject({coefficient:.5,fbAlpha:false});expect(alpha.userData.nativeEnv.fbAlpha).toBe(true);
 const shader={uniforms:{} as any,vertexShader:'#include <fog_vertex>',fragmentShader:'#include <opaque_fragment>'};
 plain.onBeforeCompile(shader as any,{} as any);
 expect(shader.uniforms.nativeEnvDisableFba.value).toBe(1);expect(shader.fragmentShader).toContain('max( diffuseColor.a, nativeEnvDisableFba )');expect(shader.vertexShader).toContain('vNativeEnvUv');
 const alphaShader={uniforms:{} as any,vertexShader:'#include <fog_vertex>',fragmentShader:'#include <opaque_fragment>'};alpha.onBeforeCompile(alphaShader as any,{} as any);
 expect(alphaShader.uniforms.nativeEnvDisableFba.value).toBe(0);expect(plain.customProgramCacheKey()).toContain('native-env');
});
