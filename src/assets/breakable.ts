import {BinaryReader,requireAsset} from './binary';

/** Rockstar breakable geometry plugin (rwID 0x0253F2FD), read by BreakableStreamRead
 * (0x59CEC0, gta-reversed 0076f901). The triangle soup BreakObject_c throws around
 * when CObject::ObjectDamage breaks a COL_DAMAGE_EFFECT_BREAKABLE object. */
export const BREAKABLE_PLUGIN=0x253f2fd;
export interface BreakableInfo {
 /** eBreakablePluginPositionRule: 0 object origin, 1 collision bounding-box centre. */
 positionRule:number;
 positions:Float32Array;uvs:Float32Array;colors:Uint8Array;
 /** Three vertex indices per triangle. */
 triangles:Uint16Array;
 /** Material per triangle. */
 materialIds:Uint16Array;
 textures:string[];masks:string[];
 /** BreakInfoColor: a float RGB multiplier per material. */
 materialColors:Float32Array;
}
const name32=(bytes:Uint8Array)=>{const end=bytes.indexOf(0);return new TextDecoder('latin1').decode(end<0?bytes:bytes.subarray(0,end));};

/** Undefined when the section header is zero (the plugin is present but empty). */
export function readBreakable(bytes:Uint8Array):BreakableInfo|undefined{
 const r=new BinaryReader(bytes);
 if(!r.u32())return undefined;
 // BreakInfo_t is written raw: 32-bit counts and stale pointers, 0x34 bytes.
 const header=new DataView(r.take(0x34).slice().buffer);
 const positionRule=header.getUint32(0,true),vertices=header.getUint16(4,true),triangleCount=header.getUint16(20,true),materials=header.getUint16(32,true);
 requireAsset(positionRule<=1,'Invalid breakable position rule.');
 requireAsset(vertices>0&&triangleCount>0&&materials>0,'Empty breakable geometry.');
 const floats=(count:number)=>{const view=new DataView(r.take(count*4).slice().buffer);return Float32Array.from({length:count},(_,i)=>view.getFloat32(i*4,true));};
 const shorts=(count:number)=>{const view=new DataView(r.take(count*2).slice().buffer);return Uint16Array.from({length:count},(_,i)=>view.getUint16(i*2,true));};
 const positions=floats(vertices*3),uvs=floats(vertices*2),colors=r.take(vertices*4).slice();
 const triangles=shorts(triangleCount*3),materialIds=shorts(triangleCount);
 const textures=Array.from({length:materials},()=>name32(r.take(32))),masks=Array.from({length:materials},()=>name32(r.take(32)));
 const materialColors=floats(materials*3);
 requireAsset(r.position===bytes.length,'Unexpected breakable plugin payload.');
 requireAsset(triangles.every(i=>i<vertices)&&materialIds.every(i=>i<materials),'Breakable triangle references an invalid vertex or material.');
 requireAsset([...positions,...uvs,...materialColors].every(Number.isFinite),'Breakable geometry has non-finite values.');
 return {positionRule,positions,uvs,colors,triangles,materialIds,textures,masks,materialColors};
}
