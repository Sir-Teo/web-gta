/** CPedModelInfo's twelve bone-bound collision spheres from both slices of the pinned executable. */
import {readExecutable,SOURCE} from './lib/ios-executable.mjs';
const e=await readExecutable(process.argv[2]),base=0x10064afc8;
const expected=[[5,9,.05,.15],[3,3,.2,.2],[3,3,0,.2],[2,4,-.1,.2],[32,5,.06,.14],[22,6,.06,.14],[33,5,.05,.14],[23,6,.05,.14],[42,7,-.1,.18],[52,8,-.1,.18],[43,7,-.18,.16],[53,8,-.18,.16]];
const records=expected.map(([bone,piece,x,radius],i)=>{
 const offset=e.offset(base+i*32),v7=0x5c7180+i*28;
 const read=(p,pad)=>({bone:e.file.readInt32LE(p+pad),piece:e.file.readInt32LE(p+pad+4),center:Array.from({length:3},(_,j)=>e.file.readFloatLE(p+pad+8+j*4)),radius:e.file.readFloatLE(p+pad+20)});
 const record=read(offset,8),armv7=read(v7,4),wanted={bone,piece,center:[Math.fround(x),0,0],radius:Math.fround(radius)};
 if(JSON.stringify(record)!==JSON.stringify(wanted)||JSON.stringify(armv7)!==JSON.stringify(wanted))throw Error(`Unexpected native pedestrian hit sphere ${i}.`);
 return record;
});
console.log(JSON.stringify({source:SOURCE,table:'CPedModelInfo::m_pColNodeInfos',pcAddress:'0x8A6308',arm64Address:`0x${base.toString(16)}`,arm64Stride:32,armv7FileOffset:'0x5c7180',armv7Stride:28,
 consumer:'https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Models/PedModelInfo.cpp',
 notes:['CreateHitColModelSkinned copies these radii and body-piece IDs; AnimatePedColModelSkinnedWorld transforms each center by its current skeleton bone.',
 'The first unused name/pointer field takes eight bytes on ARM64, four on ARMv7. All twelve table records agree across the two slices.',
 'CWorld::ProcessLineOfSightSectorList permits the animated model with bIncludeBikers and bTestForShotInVehicle even while ordinary ped collision is off. This capture does not establish the writer of that eligibility flag.'],records},null,2));
