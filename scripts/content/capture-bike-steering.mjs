/** Fork-axis and quaternion instructions from the pinned ARM64 CBike::PreRender. */
import {readExecutable,SOURCE} from './lib/ios-executable.mjs';
const expected=[
 [0x100455644,0xbd408aa0],[0x100455650,0x1e210800],[0x10045565c,0x1e211800],
 [0x100455660,0x94025d25],[0x100455664,0x1e214021],[0x100455670,0x910043e0],
 [0x100455678,0xbd483660],[0x10045567c,0x1e214000],[0x100455688,0x97f9d666],
 [0x100455698,0x9101c3e0],[0x1004556c0,0x97f9d0f9],
 [0x1004556d0,0x1e202940],[0x1004556dc,0x1e202920],[0x1004556e8,0x1e202900],[0x1004556f4,0x97f9d193],
];
const executable=await readExecutable(process.argv[2]);executable.expectCode(expected);
const float=address=>executable.file.readFloatLE(executable.offset(address));
if(float(0x10058c9c0)!==Math.fround(Math.PI)||float(0x10058c830)!==180)throw Error('Unexpected native rake conversion constants.');
console.log(JSON.stringify({source:SOURCE,function:'CBike::PreRender',slice:'0x100455604–0x1004556f4',
 notes:['Read the model rake at modelInfo+0x88, multiply by float32 pi and divide by 180.',
 'Build axis (0, sin(rake), -cos(rake)) and quaternion angle -vehicle.steerAngle (vehicle+0x834).',
 'Set the fork matrix to identity, apply that quaternion matrix and restore the original XYZ translation.'],
 constants:{pi:float(0x10058c9c0),degrees:float(0x10058c830)},
 instructions:expected.map(([address,word])=>({address:`0x${address.toString(16)}`,word:`0x${word.toString(16)}`}))},null,2));
