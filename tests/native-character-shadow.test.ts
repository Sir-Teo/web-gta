import {expect,test} from 'vitest';
import {Group,Vector3,type WebGLRenderer} from 'three';
import {NativeCharacterShadow,type ShadowReceiverQuery} from '../src/render/NativeCharacterShadow';
import type {NativeCharacter} from '../src/render/NativeCharacter';
test('shadow ownership clears failed queries, recovers, freezes intensity on pause and resets on replacement',()=>{
 const shadow=new NativeCharacterShadow(),root=new Group(),character={root,shadowSphere:()=>({center:new Vector3(0,1,0),radius:1}),shadowPosition:()=>new Vector3()} as unknown as NativeCharacter;
 const renderer={} as WebGLRenderer,view=new Vector3(0,1,4),empty:ShadowReceiverQuery=()=>({chunks:[],candidateCount:0,triangleCount:0,vertexCount:0});
 shadow.draw.mesh.visible=true;
 shadow.update(renderer,character,()=>{throw new Error('Candidate budget exceeded');},view,720,138,false);
 expect(shadow.snapshot()).toMatchObject({visible:false,intensity:3,error:'Candidate budget exceeded'});
 shadow.update(renderer,character,empty,view,720,138,true);expect(shadow.snapshot()).toMatchObject({visible:false,intensity:3,error:null});
 root.visible=false;shadow.update(renderer,character,empty,view,720,138,false);expect(shadow.snapshot().intensity).toBe(0);
 root.visible=true;shadow.update(renderer,character,empty,view,720,138,false);expect(shadow.snapshot().intensity).toBe(3);
 shadow.reset();expect(shadow.snapshot()).toMatchObject({visible:false,intensity:0,vertices:0,strength:0,error:null});
 shadow.dispose();shadow.dispose();shadow.update(renderer,character,empty,view,720,138,false);expect(shadow.snapshot().visible).toBe(false);
});
test('shadow distance fade follows the root bone rather than the capture sphere',()=>{
 const shadow=new NativeCharacterShadow(),root=new Group(),position=new Vector3(0,100,0);
 const character={root,shadowSphere:()=>({center:new Vector3(100,1,100),radius:1}),shadowPosition:()=>position.clone()} as unknown as NativeCharacter;
 const renderer={} as WebGLRenderer,empty:ShadowReceiverQuery=()=>({chunks:[],candidateCount:0,triangleCount:0,vertexCount:0});
 for(let i=0;i<34;i++)shadow.update(renderer,character,empty,new Vector3(0,0,7.5),720,138,false);
 expect(shadow.snapshot().strength).toBe(138);
 shadow.update(renderer,character,empty,new Vector3(0,-100,11.25),720,138,false);expect(shadow.snapshot().strength).toBe(69);
 shadow.update(renderer,character,empty,new Vector3(0,100,15),720,138,false);expect(shadow.snapshot().strength).toBe(0);
 shadow.dispose();
});
