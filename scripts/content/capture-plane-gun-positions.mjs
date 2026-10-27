/** CVehicle gun offsets initialized in code (not a contiguous float table), plus the aircraft gun dummy records. */
import {readExecutable,SOURCE} from './lib/ios-executable.mjs';
const e=await readExecutable(process.argv[2]),instructions=[];
const word=a=>{const w=e.word(a);instructions.push({address:`0x${a.toString(16)}`,word:`0x${w.toString(16)}`});return w;};
const movFloat=(a,b)=>{
 const w=word(a);if(a===0x10048691c){if(w!==0x320a1fea)throw Error('Expected ORR W10, WZR, #0x3fc00000.');return 1.5;}
 if((w&0x7f800000)!==0x52800000)throw Error('Expected MOVZ W constant.');
 let bits=(((w>>>5)&65535)*2**(((w>>>21)&3)*16))>>>0;
 if(b){const k=word(b);if((k&0x7f800000)!==0x72800000||(k&31)!==(w&31)||((k>>>21)&3)!==0)throw Error('Expected matching low MOVK W.');bits=((bits&0xffff0000)|((k>>>5)&65535))>>>0;}
 const out=Buffer.alloc(4);out.writeUInt32LE(bits);return out.readFloatLE();
};
e.expectCode([[0x100483c74,0x2d538520],[0x100483c78,0xbd40a522],[0x100483d60,0xb0003149],[0x100483d64,0x913a2129],
 [0x100486880,0xd0003128],[0x100486884,0x913a2108],[0x100486890,0x2900251f],[0x10048689c,0xb9000909]]);
const hunter=[0,movFloat(0x100486888,0x10048688c),movFloat(0x100486894,0x100486898)];
const maverick=[0,movFloat(0x1004868a8,0x1004868ac),movFloat(0x1004868b4)];
const records=[
 {model:425,name:'Hunter',offset:hunter},
 {model:487,name:'Maverick',offset:maverick},
 {model:497,name:'Police Maverick',offset:[...maverick]},
 {model:447,name:'Seasparrow',offset:[maverick[2],movFloat(0x1004868d4,0x1004868d8),movFloat(0x1004868e0,0x1004868e4)]},
 {model:548,name:'Cargobob',offset:[0,movFloat(0x1004868f4,0x1004868f8),movFloat(0x100486900,0x100486904)]},
 {model:476,name:'Rustler',offset:[movFloat(0x100486914,0x100486918),movFloat(0x10048691c),movFloat(0x100486924,0x100486928)]},
 {model:520,name:'Hydra',offset:[movFloat(0x100486950,0x100486954),movFloat(0x100486958,0x10048695c),movFloat(0x100486964,0x100486968)]},
 {model:576,name:'Tornado',offset:[0,0,0]},
 {model:464,name:'RC Baron',offset:[0,movFloat(0x100486988,0x10048698c),0]},
];
const rustlerStep=movFloat(0x100486938,0x10048693c),expected=[[0,4.41,-1.27],[0,2.85,-.5],[0,2.85,-.5],[-.5,2.4,-.785],[0,6.87,-1.65],[2.19,1.5,-.58],[1.48,.44,-.52],[0,0,0],[0,.45,0]];
if(records.some((r,i)=>r.offset.some((v,j)=>v!==Math.fround(expected[i][j])))||rustlerStep!==Math.fround(.2))throw Error('Unexpected native plane gun constant.');
const dummyRecords=[['helicopter',0x10064bca8],['plane',0x10064bf88]].map(([type,address])=>{
 const at=e.offset(address),pointer=Number(e.file.readBigUInt64LE(at)),nameAt=e.offset(pointer),name=e.file.subarray(nameAt,e.file.indexOf(0,nameAt)).toString(),id=e.file.readInt32LE(at+8),flags=e.file.readUInt32LE(at+12);
 if(name!=='miscpos_a'||id!==13||flags!==9)throw Error('Unexpected aircraft gun dummy descriptor.');
 return {type,address:`0x${address.toString(16)}`,name,id,flags};
});
console.log(JSON.stringify({source:SOURCE,function:'CVehicle::GetPlaneGunsPosition',pcAddress:'0x6D4290',arm64Address:'0x100483c60',
 pcReference:'https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Vehicle/Vehicle.cpp',
 notes:['The Hunter global (PC VehicleGunOffset[0]) is missing from the reversed data; the pinned initializer supplies (0, 4.41, -1.27). This differs from scripted FIRE_HUNTER_GUN (0, 4.8, -1.3).',
 'The other model constants and Rustler spacing agree with the reversed PC function. The PC source returns a nonzero model dummy before applying the Rustler fallback offset; this capture does not replace that PC branch ordering.',
 'CVehicleModelInfo::PreprocessHierarchy transforms the dummy through its parents up to, but excluding, the clump root. Descriptor flags 9 identify a dummy.',
 'This captures positions and dummy identity; PC versus mobile second-barrel mirroring and full firing/FX behavior are outside this table.'],dummyRecords,records,rustlerStep,instructions},null,2));
