import {expect,test} from 'vitest';
import {Group,Vector3,type WebGLRenderer} from 'three';
import {NativeCharacterShadow,type ShadowReceiverQuery} from '../src/render/NativeCharacterShadow';
import type {NativeCharacter} from '../src/render/NativeCharacter';
test('shadow ownership clears failed queries, recovers, freezes intensity on pause and resets on replacement',()=>{
 const shadow=new NativeCharacterShadow(),root=new Group(),character={root,shadowSphere:()=>({center:new Vector3(0,1,0),radius:1})} as unknown as NativeCharacter;
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
